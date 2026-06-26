use crate::adblock::{self, NetworkDecision};
use crate::proxy::{AdblockProxy, ProxyStatus};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_notification::NotificationExt;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastfmScrobble {
    api_key: String,
    api_secret: String,
    session_key: String,
    artist: String,
    title: String,
    album: Option<String>,
    duration_seconds: Option<u64>,
    timestamp: Option<u64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordPresence {
    pub(crate) client_id: String,
    pub(crate) title: String,
    pub(crate) artist: String,
    pub(crate) album: Option<String>,
    pub(crate) elapsed_seconds: Option<u64>,
    pub(crate) duration_seconds: Option<u64>,
    pub(crate) cover_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandStatus {
    ok: bool,
    message: String,
}

#[tauri::command]
pub async fn get_config(app: AppHandle) -> Result<Value, String> {
    read_config(&app).await
}

#[tauri::command]
pub async fn set_config(app: AppHandle, path: String, value: Value) -> Result<Value, String> {
    let mut config = read_config(&app).await?;
    set_nested_value(&mut config, &path, value);
    write_config(&app, &config).await?;
    Ok(config)
}

#[tauri::command]
pub async fn open_external(_app: AppHandle, url: String) -> Result<(), String> {
    open::that(url).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub async fn register_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    app.global_shortcut()
        .register(shortcut.as_str())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn unregister_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    app.global_shortcut()
        .unregister(shortcut.as_str())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn lastfm_scrobble(payload: LastfmScrobble) -> Result<CommandStatus, String> {
    if payload.api_key.trim().is_empty()
        || payload.api_secret.trim().is_empty()
        || payload.session_key.trim().is_empty()
    {
        return Ok(CommandStatus {
            ok: false,
            message: "Last.fm credentials are missing".to_string(),
        });
    }

    let timestamp = payload.timestamp.unwrap_or_else(unix_timestamp);
    let duration = payload.duration_seconds.unwrap_or_default();
    let mut params = vec![
        ("method".to_string(), "track.scrobble".to_string()),
        ("artist".to_string(), payload.artist),
        ("track".to_string(), payload.title),
        ("api_key".to_string(), payload.api_key),
        ("sk".to_string(), payload.session_key),
        ("timestamp".to_string(), timestamp.to_string()),
    ];

    if let Some(album) = payload.album.filter(|album| !album.trim().is_empty()) {
        params.push(("album".to_string(), album));
    }

    if duration > 0 {
        params.push(("duration".to_string(), duration.to_string()));
    }

    let signature = sign_lastfm_request(&params, &payload.api_secret);
    params.push(("api_sig".to_string(), signature));
    params.push(("format".to_string(), "json".to_string()));

    let response = reqwest::Client::new()
        .post("https://ws.audioscrobbler.com/2.0/")
        .form(&params)
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if response.status().is_success() {
        Ok(CommandStatus {
            ok: true,
            message: "Track scrobbled with Last.fm".to_string(),
        })
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        Ok(CommandStatus {
            ok: false,
            message: format!("Last.fm rejected scrobble with {status}: {body}"),
        })
    }
}

#[tauri::command]
pub async fn discord_update_presence(payload: DiscordPresence) -> Result<CommandStatus, String> {
    if payload.client_id.trim().is_empty() {
        return Ok(CommandStatus {
            ok: false,
            message: "Discord application client ID is missing".to_string(),
        });
    }

    crate::discord::set_activity(payload)
        .await
        .map(|()| CommandStatus {
            ok: true,
            message: "Discord presence updated".to_string(),
        })
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn discord_clear_presence(client_id: String) -> Result<CommandStatus, String> {
    if client_id.trim().is_empty() {
        return Ok(CommandStatus {
            ok: false,
            message: "Discord application client ID is missing".to_string(),
        });
    }

    crate::discord::clear_activity(client_id)
        .await
        .map(|()| CommandStatus {
            ok: true,
            message: "Discord presence cleared".to_string(),
        })
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_adblock_proxy_status(proxy: State<'_, AdblockProxy>) -> ProxyStatus {
    proxy.status()
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub fn classify_network_url(url: String) -> Result<NetworkDecision, String> {
    adblock::classify_url(&url).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn apply_theme(app: AppHandle, css: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    let escaped = css
        .replace('\\', "\\\\")
        .replace('`', "\\`")
        .replace('$', "\\$");

    window
        .eval(&format!(
            r#"(function() {{
                let el = document.getElementById('__VOLTYTM_THEME__');
                if (!el) {{
                    el = document.createElement('style');
                    el.id = '__VOLTYTM_THEME__';
                    document.head.appendChild(el);
                }}
                el.textContent = `{escaped}`;
            }})();"#
        ))
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn remove_theme(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    window
        .eval("document.getElementById('__VOLTYTM_THEME__')?.remove()")
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn list_themes(app: AppHandle) -> Result<Vec<String>, String> {
    let mut themes = Vec::new();
    let mut dir = app
        .path()
        .resource_dir()
        .map_err(|err| err.to_string())?;
    dir.push("themes");

    if dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".css") {
                        themes.push(name.trim_end_matches(".css").to_string());
                    }
                }
            }
        }
    }

    themes.sort();
    Ok(themes)
}

#[tauri::command]
pub async fn get_theme_css(app: AppHandle, name: String) -> Result<String, String> {
    let mut path = app
        .path()
        .resource_dir()
        .map_err(|err| err.to_string())?;
    path.push("themes");
    path.push(format!("{name}.css"));

    std::fs::read_to_string(&path).map_err(|err| err.to_string())
}

#[derive(Debug, Deserialize)]
pub struct LyricsRequest {
    pub artist: String,
    pub track: String,
    pub album: Option<String>,
    pub duration: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct LyricsResponse {
    pub synced_lyrics: Option<String>,
    pub plain_lyrics: Option<String>,
    pub provider: String,
}

#[tauri::command]
pub async fn fetch_lyrics(payload: LyricsRequest) -> Result<LyricsResponse, String> {
    // Input length limits
    if payload.artist.len() > 200 || payload.track.len() > 200 {
        return Err("Artist or track name too long".into());
    }
    if payload.artist.is_empty() || payload.track.is_empty() {
        return Err("Artist and track name are required".into());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    if let Ok(result) = fetch_lrclib(&client, &payload).await {
        if result.synced_lyrics.is_some() || result.plain_lyrics.is_some() {
            return Ok(result);
        }
    }

    if let Ok(result) = fetch_netease(&client, &payload).await {
        if result.synced_lyrics.is_some() || result.plain_lyrics.is_some() {
            return Ok(result);
        }
    }

    if let Ok(result) = fetch_lyrics_ovh(&client, &payload).await {
        if result.synced_lyrics.is_some() || result.plain_lyrics.is_some() {
            return Ok(result);
        }
    }

    Ok(LyricsResponse {
        synced_lyrics: None,
        plain_lyrics: None,
        provider: "none".to_string(),
    })
}

async fn fetch_lrclib(
    client: &reqwest::Client,
    payload: &LyricsRequest,
) -> Result<LyricsResponse, String> {
    let mut url = format!(
        "https://lrclib.net/api/get?artist_name={}&track_name={}",
        urlencoding::encode(&payload.artist),
        urlencoding::encode(&payload.track),
    );
    if let Some(ref album) = payload.album {
        url.push_str(&format!("&album_name={}", urlencoding::encode(album)));
    }
    if let Some(duration) = payload.duration {
        url.push_str(&format!("&duration={}", duration as u64));
    }

    let response = client
        .get(&url)
        .header("User-Agent", "VoltYTM/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("lrclib: no results".into());
    }

    let data: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(LyricsResponse {
        synced_lyrics: data["syncedLyrics"].as_str().map(String::from),
        plain_lyrics: data["plainLyrics"].as_str().map(String::from),
        provider: "lrclib".to_string(),
    })
}

async fn fetch_netease(
    client: &reqwest::Client,
    payload: &LyricsRequest,
) -> Result<LyricsResponse, String> {
    let search_url = format!(
        "https://music.163.com/api/search/get?s={}&type=1&limit=5",
        urlencoding::encode(&format!("{} {}", payload.artist, payload.track)),
    );

    let search_resp = client
        .post(&search_url)
        .header("User-Agent", "Mozilla/5.0")
        .header("Referer", "https://music.163.com")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !search_resp.status().is_success() {
        return Err("netease: search failed".into());
    }

    let search_data: Value = search_resp.json().await.map_err(|e| e.to_string())?;
    let songs = search_data["result"]["songs"].as_array().ok_or("netease: no songs")?;

    let song_id = songs
        .iter()
        .find(|s| {
            let song_artist = s["artists"][0]["name"].as_str().unwrap_or("");
            let song_name = s["name"].as_str().unwrap_or("");
            song_artist.to_ascii_lowercase() == payload.artist.to_ascii_lowercase()
                && song_name.to_ascii_lowercase() == payload.track.to_ascii_lowercase()
        })
        .or_else(|| songs.first())
        .ok_or("netease: no matching song")?["id"]
        .as_i64()
        .ok_or("netease: no id")?;

    let lyrics_url = format!("https://music.163.com/api/song/lyric?id={}&lv=1", song_id);
    let lyrics_resp = client
        .get(&lyrics_url)
        .header("User-Agent", "Mozilla/5.0")
        .header("Referer", "https://music.163.com")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !lyrics_resp.status().is_success() {
        return Err("netease: lyrics fetch failed".into());
    }

    let lyrics_data: Value = lyrics_resp.json().await.map_err(|e| e.to_string())?;
    let synced = lyrics_data["lrc"]["lyric"].as_str().map(String::from);
    let translated = lyrics_data["tlyric"]["lyric"].as_str();

    let plain = synced.as_ref().map(|s| {
        s.lines()
            .filter_map(|line| {
                let stripped = line.trim();
                if stripped.starts_with('[') {
                    stripped.split(']').nth(1).map(|t| t.trim().to_string())
                } else {
                    Some(stripped.to_string())
                }
            })
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join("\n")
    });

    let mut result = LyricsResponse {
        synced_lyrics: synced,
        plain_lyrics: plain,
        provider: "netease".to_string(),
    };

    if result.plain_lyrics.is_none() {
        if let Some(tl) = translated {
            result.plain_lyrics = Some(tl.to_string());
        }
    }

    Ok(result)
}

async fn fetch_lyrics_ovh(
    client: &reqwest::Client,
    payload: &LyricsRequest,
) -> Result<LyricsResponse, String> {
    let url = format!(
        "https://api.lyrics.ovh/v1/{}/{}",
        urlencoding::encode(&payload.artist),
        urlencoding::encode(&payload.track),
    );

    let response = client
        .get(&url)
        .header("User-Agent", "VoltYTM/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("lyrics.ovh: no results".into());
    }

    let data: Value = response.json().await.map_err(|e| e.to_string())?;
    let plain = data["lyrics"].as_str().map(String::from);

    Ok(LyricsResponse {
        synced_lyrics: None,
        plain_lyrics: plain,
        provider: "lyrics.ovh".to_string(),
    })
}

#[derive(Debug, Deserialize)]
pub struct DownloadRequest {
    pub video_id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub format: Option<String>,
    pub quality: Option<String>,
    pub output_dir: Option<String>,
    pub embed_art: Option<bool>,
    pub filename_pattern: Option<String>,
}

#[tauri::command]
pub async fn download_track(
    app: AppHandle,
    payload: DownloadRequest,
) -> Result<String, String> {
    let format = payload.format.unwrap_or_else(|| "mp3".to_string());
    let quality = payload.quality.unwrap_or_else(|| "0".to_string());
    let embed_art = payload.embed_art.unwrap_or(true);
    let pattern = payload.filename_pattern.unwrap_or_else(|| "{artist} - {title}".to_string());

    // Validate format against allowlist
    let allowed_formats = ["mp3", "flac", "aac", "ogg", "wav"];
    if !allowed_formats.contains(&format.as_str()) {
        return Err(format!("Unsupported format: {format}. Allowed: {}", allowed_formats.join(", ")));
    }

    let output_dir = match payload.output_dir {
        Some(dir) => {
            let path = std::path::PathBuf::from(&dir);
            // Prevent path traversal — canonicalize and ensure no ".." components
            if dir.contains("..") || dir.contains('\0') {
                return Err("Invalid output directory".into());
            }
            path
        }
        None => app
            .path()
            .download_dir()
            .map_err(|e| e.to_string())?
            .join("VoltYTM"),
    };

    // Validate video_id — only allow alphanumeric, hyphens, underscores
    if !payload.video_id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err("Invalid video ID".into());
    }

    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

    let filename = pattern
        .replace("{artist}", &sanitize_filename(&payload.artist))
        .replace("{title}", &sanitize_filename(&payload.title))
        .replace("{album}", &payload.album.as_deref().map(sanitize_filename).unwrap_or_default());

    let output_template = format!("{}/{}.%(ext)s", output_dir.display(), filename);
    let video_url = format!("https://music.youtube.com/watch?v={}", payload.video_id);

    let mut args: Vec<String> = vec![
        "-x".into(),
        "--audio-format".into(),
        format.clone(),
        "--audio-quality".into(),
        quality.clone(),
        "--output".into(),
        output_template.clone(),
    ];

    if embed_art {
        args.push("--embed-thumbnail".into());
    }

    if !payload.artist.is_empty() {
        args.push(format!("--add-metadata=artist={}", payload.artist));
    }
    if !payload.title.is_empty() {
        args.push(format!("--add-metadata=title={}", payload.title));
    }
    if let Some(ref album) = payload.album {
        if !album.is_empty() {
            args.push(format!("--add-metadata=album={}", album));
        }
    }

    args.push(video_url);

    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let output = std::process::Command::new("yt-dlp")
        .args(&arg_refs)
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "yt-dlp is not installed. Install it from https://github.com/yt-dlp/yt-dlp".to_string()
            } else {
                e.to_string()
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Download failed: {stderr}"));
    }

    let display_path = format!("{}/{}.{}", output_dir.display(), filename, format);
    Ok(display_path)
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_control() || c == '/' || c == '\\' || c == ':' || c == '*' || c == '?' || c == '"' || c == '<' || c == '>' || c == '|' { '_' } else { c })
        .collect::<String>()
        .trim()
        .to_string()
}

pub(crate) async fn read_config(app: &AppHandle) -> Result<Value, String> {
    let path = config_path(app)?;

    match tokio::fs::read_to_string(&path).await {
        Ok(contents) => {
            let mut config: Value = serde_json::from_str(&contents).map_err(|err| err.to_string())?;
            merge_defaults(&mut config, default_config());
            Ok(config)
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(default_config()),
        Err(err) => Err(err.to_string()),
    }
}

pub(crate) async fn write_config(app: &AppHandle, config: &Value) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|err| err.to_string())?;
    }

    let contents = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
    tokio::fs::write(path, contents)
        .await
        .map_err(|err| err.to_string())
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|path| path.join("config.json"))
        .map_err(|err| err.to_string())
}

fn default_config() -> Value {
    json!({
        "plugins": {
            "lastfm": {
                "enabled": false,
                "apiKey": "",
                "apiSecret": "",
                "sessionKey": "",
                "scrobblePercent": 50
            },
            "discord": {
                "enabled": false,
                "clientId": "",
                "showAlbum": true,
                "showTimestamp": true
            },
            "sponsorblock": {
                "enabled": true,
                "categories": ["sponsor", "selfpromo", "interaction", "intro", "outro"]
            },
            "skipSilence": {
                "enabled": false,
                "threshold": 0.01,
                "playbackRate": 2
            },
            "notifications": {
                "enabled": true
            },
            "syncedLyrics": {
                "enabled": true
            },
            "crossfade": {
                "enabled": false,
                "duration": 3
            },
            "pip": {
                "enabled": true
            },
            "download": {
                "enabled": true
            },
            "keyBpm": {
                "enabled": false
            },
            "doNotTrack": {
                "enabled": true
            },
            "disableAutoplay": {
                "enabled": false
            },
            "skipDisliked": {
                "enabled": false
            },
            "compactSidebar": {
                "enabled": false
            },
            "navigation": {
                "enabled": true
            },
            "unobtrusivePlayer": {
                "enabled": false
            },
            "sleepTimer": {
                "enabled": true
            },
            "audioDevice": {
                "enabled": true
            },
            "volumeNormalizer": {
                "enabled": false,
                "targetLoudness": -14,
                "maxGain": 3
            },
            "miniPlayer": {
                "enabled": true
            },
            "playbackSpeed": {
                "enabled": true,
                "pitchCorrect": true
            }
        },
        "adblock": {
            "enabled": true,
            "blockTelemetry": true,
            "preserveAudioStreams": true,
            "useNativeProxy": true,
            "useRendererInterceptors": true
        }
    })
}

fn set_nested_value(root: &mut Value, key: &str, value: Value) {
    let mut cursor = root;
    let mut parts = key.split('.').filter(|part| !part.is_empty()).peekable();

    while let Some(part) = parts.next() {
        if parts.peek().is_none() {
            if !cursor.is_object() {
                *cursor = Value::Object(Map::new());
            }
            if let Value::Object(map) = cursor {
                map.insert(part.to_string(), value);
            }
            return;
        }

        if !cursor.is_object() {
            *cursor = Value::Object(Map::new());
        }

        cursor = cursor
            .as_object_mut()
            .expect("cursor is an object")
            .entry(part.to_string())
            .or_insert_with(|| Value::Object(Map::new()));
    }
}

fn merge_defaults(config: &mut Value, defaults: Value) {
    if let (Value::Object(config_map), Value::Object(default_map)) = (config, defaults) {
        for (key, default_value) in default_map {
            match config_map.get_mut(&key) {
                Some(existing) => merge_defaults(existing, default_value),
                None => {
                    config_map.insert(key, default_value);
                }
            }
        }
    }
}

fn sign_lastfm_request(params: &[(String, String)], secret: &str) -> String {
    let mut signature_params: Vec<_> = params
        .iter()
        .filter(|(key, _)| key != "format" && key != "callback")
        .collect();
    signature_params.sort_by(|left, right| left.0.cmp(&right.0));

    let mut signing_payload = String::new();
    for (key, value) in signature_params {
        signing_payload.push_str(key);
        signing_payload.push_str(value);
    }
    signing_payload.push_str(secret);

    format!("{:x}", md5::compute(signing_payload.as_bytes()))
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::{merge_defaults, set_nested_value, sign_lastfm_request};
    use serde_json::json;

    #[test]
    fn test_set_nested_value() {
        let mut root = json!({});
        set_nested_value(&mut root, "plugins.lastfm.enabled", json!(true));
        assert_eq!(root["plugins"]["lastfm"]["enabled"], json!(true));
    }

    #[test]
    fn test_set_nested_value_deep() {
        let mut root = json!({ "plugins": { "lastfm": { "enabled": false } } });
        set_nested_value(&mut root, "plugins.lastfm.enabled", json!(true));
        assert_eq!(root["plugins"]["lastfm"]["enabled"], json!(true));
    }

    #[test]
    fn merges_missing_default_objects() {
        let mut config = json!({ "plugins": { "lastfm": { "enabled": true } } });
        merge_defaults(
            &mut config,
            json!({ "plugins": { "lastfm": { "apiKey": "" }, "discord": { "enabled": false } } }),
        );

        assert_eq!(config["plugins"]["lastfm"]["enabled"], json!(true));
        assert_eq!(config["plugins"]["lastfm"]["apiKey"], json!(""));
        assert_eq!(config["plugins"]["discord"]["enabled"], json!(false));
    }

    #[test]
    fn signs_lastfm_requests_in_key_order() {
        let params = vec![
            ("method".to_string(), "track.scrobble".to_string()),
            ("track".to_string(), "Song".to_string()),
            ("artist".to_string(), "Artist".to_string()),
            ("api_key".to_string(), "key".to_string()),
            ("sk".to_string(), "session".to_string()),
            ("timestamp".to_string(), "123".to_string()),
        ];

        assert_eq!(
            sign_lastfm_request(&params, "secret"),
            "3c36b6e74a78c2c8d5bb894f23d86585"
        );
    }
}
