use crate::commands::DiscordPresence;
use anyhow::{anyhow, Context};
use serde_json::{json, Value};
use std::io;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

const OPCODE_HANDSHAKE: u32 = 0;
const OPCODE_FRAME: u32 = 1;

trait AsyncReadWrite: AsyncRead + AsyncWrite + Unpin + Send {}

impl<T> AsyncReadWrite for T where T: AsyncRead + AsyncWrite + Unpin + Send {}

type RpcStream = Box<dyn AsyncReadWrite>;

pub async fn set_activity(payload: DiscordPresence) -> anyhow::Result<()> {
    let activity = build_activity(&payload);
    let command = json!({
        "cmd": "SET_ACTIVITY",
        "args": {
            "pid": std::process::id(),
            "activity": activity,
        },
        "nonce": nonce(),
    });

    with_discord(payload.client_id, command).await
}

pub async fn clear_activity(client_id: String) -> anyhow::Result<()> {
    let command = json!({
        "cmd": "SET_ACTIVITY",
        "args": {
            "pid": std::process::id(),
            "activity": Value::Null,
        },
        "nonce": nonce(),
    });

    with_discord(client_id, command).await
}

async fn with_discord(client_id: String, command: Value) -> anyhow::Result<()> {
    let mut stream = connect_discord().await?;
    write_frame(
        &mut stream,
        OPCODE_HANDSHAKE,
        &json!({
            "v": 1,
            "client_id": client_id,
        }),
    )
    .await?;

    let _ = tokio::time::timeout(Duration::from_secs(2), read_frame(&mut stream)).await;
    write_frame(&mut stream, OPCODE_FRAME, &command).await?;
    Ok(())
}

fn build_activity(payload: &DiscordPresence) -> Value {
    let now = unix_timestamp();
    let mut timestamps = serde_json::Map::new();

    if let Some(elapsed) = payload.elapsed_seconds {
        timestamps.insert("start".to_string(), json!((now.saturating_sub(elapsed)) * 1000));
        if let Some(duration) = payload.duration_seconds.filter(|duration| *duration > elapsed) {
            timestamps.insert("end".to_string(), json!((now + (duration - elapsed)) * 1000));
        }
    }

    let mut activity = json!({
        "details": payload.title,
        "state": payload.artist,
        "type": 2,
        "instance": false,
    });

    if !timestamps.is_empty() {
        activity["timestamps"] = Value::Object(timestamps);
    }

    if payload.album.as_deref().is_some_and(|album| !album.trim().is_empty())
        || payload
            .cover_url
            .as_deref()
            .is_some_and(|cover_url| !cover_url.trim().is_empty())
    {
        activity["assets"] = json!({
            "large_image": payload.cover_url.as_deref().unwrap_or("voltytm"),
            "large_text": payload.album.as_deref().unwrap_or("VoltYTM"),
        });
    }

    activity
}

async fn write_frame(
    stream: &mut RpcStream,
    opcode: u32,
    payload: &Value,
) -> anyhow::Result<()> {
    let payload = serde_json::to_vec(payload)?;
    stream.write_all(&opcode.to_le_bytes()).await?;
    stream.write_all(&(payload.len() as u32).to_le_bytes()).await?;
    stream.write_all(&payload).await?;
    stream.flush().await?;
    Ok(())
}

async fn read_frame(stream: &mut RpcStream) -> anyhow::Result<Value> {
    let mut header = [0_u8; 8];
    stream.read_exact(&mut header).await?;
    let length = u32::from_le_bytes(header[4..8].try_into().expect("slice length")) as usize;
    let mut payload = vec![0_u8; length];
    stream.read_exact(&mut payload).await?;
    serde_json::from_slice(&payload).context("invalid Discord IPC frame")
}

#[cfg(windows)]
async fn connect_discord() -> anyhow::Result<RpcStream> {
    use tokio::net::windows::named_pipe::ClientOptions;

    let mut last_error = None;
    for index in 0..10 {
        let path = format!(r"\\.\pipe\discord-ipc-{index}");
        match ClientOptions::new().open(&path) {
            Ok(client) => return Ok(Box::new(client)),
            Err(error) => last_error = Some(error),
        }
    }

    Err(anyhow!(
        "Discord IPC pipe is unavailable: {}",
        last_error
            .unwrap_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no pipe candidates"))
    ))
}

#[cfg(unix)]
async fn connect_discord() -> anyhow::Result<RpcStream> {
    use tokio::net::UnixStream;

    let mut roots = Vec::new();
    if let Some(runtime_dir) = std::env::var_os("XDG_RUNTIME_DIR") {
        roots.push(runtime_dir);
    }
    if let Some(tmp_dir) = std::env::var_os("TMPDIR") {
        roots.push(tmp_dir);
    }
    roots.extend(["/tmp".into(), "/var/tmp".into(), "/usr/tmp".into()]);

    let mut last_error = None;
    for root in roots {
        for index in 0..10 {
            let path = std::path::Path::new(&root).join(format!("discord-ipc-{index}"));
            match UnixStream::connect(&path).await {
                Ok(stream) => return Ok(Box::new(stream)),
                Err(error) => last_error = Some(error),
            }
        }
    }

    Err(anyhow!(
        "Discord IPC socket is unavailable: {}",
        last_error
            .unwrap_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no socket candidates"))
    ))
}

#[cfg(not(any(windows, unix)))]
async fn connect_discord() -> anyhow::Result<RpcStream> {
    Err(anyhow!("Discord IPC is not supported on this platform"))
}

fn nonce() -> String {
    format!("voltytm-{}", unix_timestamp())
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::build_activity;
    use crate::commands::DiscordPresence;

    #[test]
    fn builds_music_presence_payload() {
        let activity = build_activity(&DiscordPresence {
            client_id: "client".to_string(),
            title: "Song".to_string(),
            artist: "Artist".to_string(),
            album: Some("Album".to_string()),
            elapsed_seconds: Some(10),
            duration_seconds: Some(120),
            cover_url: None,
        });

        assert_eq!(activity["details"], "Song");
        assert_eq!(activity["state"], "Artist");
        assert_eq!(activity["assets"]["large_text"], "Album");
        assert!(activity["timestamps"]["start"].is_number());
        assert!(activity["timestamps"]["end"].is_number());
    }
}
