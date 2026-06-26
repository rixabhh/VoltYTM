use crate::adblock::{self, NetworkDecision};
use serde::Serialize;
use std::io;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use tauri::Url;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

const MAX_HEADER_BYTES: usize = 64 * 1024;

#[derive(Clone, Debug)]
pub struct AdblockProxy {
    url: Url,
    stats: Arc<ProxyStatsInner>,
}

#[derive(Debug, Default)]
struct ProxyStatsInner {
    allowed: AtomicU64,
    blocked: AtomicU64,
    failed: AtomicU64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyStatus {
    pub enabled: bool,
    pub url: String,
    pub allowed_requests: u64,
    pub blocked_requests: u64,
    pub failed_requests: u64,
}

impl AdblockProxy {
    pub fn proxy_url(&self) -> Url {
        self.url.clone()
    }

    pub fn status(&self) -> ProxyStatus {
        ProxyStatus {
            enabled: true,
            url: self.url.to_string(),
            allowed_requests: self.stats.allowed.load(Ordering::Relaxed),
            blocked_requests: self.stats.blocked.load(Ordering::Relaxed),
            failed_requests: self.stats.failed.load(Ordering::Relaxed),
        }
    }
}

pub async fn start() -> anyhow::Result<AdblockProxy> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await?;
    let address = listener.local_addr()?;
    let proxy = AdblockProxy {
        url: Url::parse(&format!("http://{address}"))?,
        stats: Arc::new(ProxyStatsInner::default()),
    };

    let stats = Arc::clone(&proxy.stats);
    tauri::async_runtime::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _)) => {
                    let stats = Arc::clone(&stats);
                    tauri::async_runtime::spawn(async move {
                        if let Err(error) = handle_connection(stream, stats.clone()).await {
                            stats.failed.fetch_add(1, Ordering::Relaxed);
                            tracing::debug!(%error, "adblock proxy connection failed");
                        }
                    });
                }
                Err(error) => {
                    stats.failed.fetch_add(1, Ordering::Relaxed);
                    tracing::warn!(%error, "adblock proxy accept failed");
                }
            }
        }
    });

    Ok(proxy)
}

async fn handle_connection(mut inbound: TcpStream, stats: Arc<ProxyStatsInner>) -> io::Result<()> {
    let buffer = read_headers(&mut inbound).await?;
    let header_end = find_header_end(&buffer)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing header terminator"))?;
    let header = std::str::from_utf8(&buffer[..header_end])
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;

    let mut lines = header.lines();
    let request_line = lines
        .next()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing request line"))?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let target = parts.next().unwrap_or_default();
    let version = parts.next().unwrap_or("HTTP/1.1");

    if method.eq_ignore_ascii_case("CONNECT") {
        return handle_connect(inbound, target, stats).await;
    }

    handle_http_request(inbound, &buffer, header_end, method, target, version, header, stats).await
}

async fn handle_connect(
    mut inbound: TcpStream,
    authority: &str,
    stats: Arc<ProxyStatsInner>,
) -> io::Result<()> {
    if should_block_authority(authority) {
        stats.blocked.fetch_add(1, Ordering::Relaxed);
        inbound
            .write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n")
            .await?;
        return Ok(());
    }

    stats.allowed.fetch_add(1, Ordering::Relaxed);
    let mut outbound = TcpStream::connect(authority).await?;
    inbound
        .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        .await?;
    tokio::io::copy_bidirectional(&mut inbound, &mut outbound).await?;
    Ok(())
}

async fn handle_http_request(
    mut inbound: TcpStream,
    buffer: &[u8],
    header_end: usize,
    method: &str,
    target: &str,
    version: &str,
    header: &str,
    stats: Arc<ProxyStatsInner>,
) -> io::Result<()> {
    let parsed = parse_http_target(target, header)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing target host"))?;

    if adblock::classify_url(&parsed.full_url).unwrap_or(NetworkDecision::Allow)
        != NetworkDecision::Allow
    {
        stats.blocked.fetch_add(1, Ordering::Relaxed);
        inbound
            .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n")
            .await?;
        return Ok(());
    }

    stats.allowed.fetch_add(1, Ordering::Relaxed);
    let mut outbound = TcpStream::connect(&parsed.authority).await?;
    let rewritten = rewrite_request_header(method, &parsed.origin_form, version, header);
    outbound.write_all(rewritten.as_bytes()).await?;
    outbound.write_all(&buffer[header_end..]).await?;
    tokio::io::copy_bidirectional(&mut inbound, &mut outbound).await?;
    Ok(())
}

fn read_headers(stream: &mut TcpStream) -> impl std::future::Future<Output = io::Result<Vec<u8>>> + '_ {
    async move {
        let mut buffer = Vec::with_capacity(4096);
        loop {
            let mut chunk = [0_u8; 2048];
            let read = stream.read(&mut chunk).await?;
            if read == 0 {
                break;
            }
            buffer.extend_from_slice(&chunk[..read]);
            if find_header_end(&buffer).is_some() {
                break;
            }
            if buffer.len() > MAX_HEADER_BYTES {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "proxy request header too large",
                ));
            }
        }
        Ok(buffer)
    }
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|position| position + 4)
}

fn should_block_authority(authority: &str) -> bool {
    let candidate = format!("https://{}/", authority.trim());
    adblock::classify_url(&candidate).unwrap_or(NetworkDecision::Allow) != NetworkDecision::Allow
}

#[derive(Debug, Eq, PartialEq)]
struct ParsedHttpTarget {
    authority: String,
    full_url: String,
    origin_form: String,
}

fn parse_http_target(target: &str, header: &str) -> Option<ParsedHttpTarget> {
    if let Ok(url) = Url::parse(target) {
        let host = url.host_str()?;
        let port = url.port_or_known_default()?;
        let origin_form = match url.query() {
            Some(query) => format!("{}?{query}", url.path()),
            None => url.path().to_string(),
        };

        return Some(ParsedHttpTarget {
            authority: format!("{host}:{port}"),
            full_url: target.to_string(),
            origin_form,
        });
    }

    let host = header
        .lines()
        .find_map(|line| line.strip_prefix("Host:").or_else(|| line.strip_prefix("host:")))?
        .trim();

    Some(ParsedHttpTarget {
        authority: normalize_host_authority(host, 80),
        full_url: format!("http://{host}{target}"),
        origin_form: target.to_string(),
    })
}

fn normalize_host_authority(host: &str, default_port: u16) -> String {
    if host.rsplit_once(':').is_some() || host.starts_with('[') {
        host.to_string()
    } else {
        format!("{host}:{default_port}")
    }
}

fn rewrite_request_header(method: &str, target: &str, version: &str, header: &str) -> String {
    let mut lines = header.lines();
    let _ = lines.next();
    let mut rewritten = format!("{method} {target} {version}\r\n");
    for line in lines {
        if !line.is_empty() {
            rewritten.push_str(line);
            rewritten.push_str("\r\n");
        }
    }
    rewritten.push_str("\r\n");
    rewritten
}

#[cfg(test)]
mod tests {
    use super::{parse_http_target, should_block_authority, ParsedHttpTarget};

    #[test]
    fn allows_googlevideo_stream_connects() {
        assert!(!should_block_authority(
            "rr2---sn-q4flrney.googlevideo.com:443"
        ));
    }

    #[test]
    fn blocks_doubleclick_connects() {
        assert!(should_block_authority("securepubads.g.doubleclick.net:443"));
    }

    #[test]
    fn parses_absolute_http_targets() {
        let parsed = parse_http_target(
            "http://music.youtube.com/api/stats/ads?ver=2",
            "GET http://music.youtube.com/api/stats/ads?ver=2 HTTP/1.1\r\n\r\n",
        );

        assert_eq!(
            parsed,
            Some(ParsedHttpTarget {
                authority: "music.youtube.com:80".to_string(),
                full_url: "http://music.youtube.com/api/stats/ads?ver=2".to_string(),
                origin_form: "/api/stats/ads?ver=2".to_string(),
            })
        );
    }
}
