use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::webview::cookie::time::OffsetDateTime;
use tauri::webview::Cookie;
use tauri::{AppHandle, Manager, Url};
use ts_rs::TS;

const MAIN_WINDOW_LABEL: &str = "main";
const YTM_URL: &str = "https://music.youtube.com/";
const PERSIST_INTERVAL_SECONDS: u64 = 300;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct SerializedCookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
    pub expires: Option<i64>,
    pub http_only: Option<bool>,
    pub secure: Option<bool>,
}

pub fn initialize(app: &AppHandle) -> tauri::Result<()> {
    let restore_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = restore_cookies(&restore_handle).await {
            tracing::debug!(%error, "unable to restore persisted YouTube Music cookies");
        }
    });

    let persist_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval =
            tokio::time::interval(std::time::Duration::from_secs(PERSIST_INTERVAL_SECONDS));
        loop {
            interval.tick().await;
            if let Err(error) = persist_cookies_for_app(&persist_handle).await {
                tracing::debug!(%error, "unable to persist YouTube Music cookies");
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn get_ytm_cookies(app: AppHandle) -> Result<Vec<SerializedCookie>, String> {
    read_webview_cookies(&app).await.map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn persist_cookies(app: AppHandle) -> Result<Vec<SerializedCookie>, String> {
    persist_cookies_for_app(&app)
        .await
        .map_err(|err| err.to_string())
}

async fn restore_cookies(app: &AppHandle) -> anyhow::Result<()> {
    let path = session_path(app)?;
    let contents = match tokio::fs::read_to_string(&path).await {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    };

    let cookies: Vec<SerializedCookie> = serde_json::from_str(&contents)?;
    let window = match app.get_webview_window(MAIN_WINDOW_LABEL) {
        Some(window) => window,
        None => return Ok(()),
    };

    for cookie in cookies {
        if let Some(cookie) = cookie.into_webview_cookie() {
            if let Err(error) = window.set_cookie(cookie) {
                tracing::debug!(%error, "unable to restore one YouTube Music cookie");
            }
        }
    }

    Ok(())
}

pub(crate) async fn persist_cookies_for_app(app: &AppHandle) -> anyhow::Result<Vec<SerializedCookie>> {
    let cookies = read_webview_cookies(app).await?;
    let path = session_path(app)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let contents = serde_json::to_string_pretty(&cookies)?;
    tokio::fs::write(path, contents).await?;
    Ok(cookies)
}

async fn read_webview_cookies(app: &AppHandle) -> anyhow::Result<Vec<SerializedCookie>> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| anyhow::anyhow!("main webview window is not available"))?;
    let url = Url::parse(YTM_URL)?;
    let cookies = window.cookies_for_url(url)?;

    Ok(cookies.into_iter().map(SerializedCookie::from).collect())
}

fn session_path(app: &AppHandle) -> tauri::Result<PathBuf> {
    app.path()
        .app_config_dir()
        .map(|path| path.join("session.json"))
}

impl SerializedCookie {
    fn into_webview_cookie(self) -> Option<Cookie<'static>> {
        if self.name.trim().is_empty() {
            return None;
        }

        let mut builder = Cookie::build((self.name, self.value));
        if let Some(domain) = self.domain.filter(|domain| !domain.trim().is_empty()) {
            builder = builder.domain(domain);
        }
        if let Some(path) = self.path.filter(|path| !path.trim().is_empty()) {
            builder = builder.path(path);
        }
        if let Some(expires) = self.expires {
            if let Ok(expires) = OffsetDateTime::from_unix_timestamp(expires) {
                builder = builder.expires(expires);
            }
        }
        if let Some(http_only) = self.http_only {
            builder = builder.http_only(http_only);
        }
        if let Some(secure) = self.secure {
            builder = builder.secure(secure);
        }

        Some(builder.build())
    }
}

impl From<Cookie<'static>> for SerializedCookie {
    fn from(cookie: Cookie<'static>) -> Self {
        Self {
            name: cookie.name().to_string(),
            value: cookie.value().to_string(),
            domain: cookie.domain().map(ToString::to_string),
            path: cookie.path().map(ToString::to_string),
            expires: cookie.expires_datetime().map(|expires| expires.unix_timestamp()),
            http_only: cookie.http_only(),
            secure: cookie.secure(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::SerializedCookie;

    #[test]
    fn skips_empty_cookie_names() {
        let cookie = SerializedCookie {
            name: String::new(),
            value: "value".to_string(),
            domain: None,
            path: None,
            expires: None,
            http_only: None,
            secure: None,
        };

        assert!(cookie.into_webview_cookie().is_none());
    }

    #[test]
    fn round_trips_basic_cookie_fields() {
        let cookie = SerializedCookie {
            name: "SID".to_string(),
            value: "abc".to_string(),
            domain: Some(".youtube.com".to_string()),
            path: Some("/".to_string()),
            expires: None,
            http_only: Some(true),
            secure: Some(true),
        }
        .into_webview_cookie()
        .expect("cookie");

        assert_eq!(cookie.name(), "SID");
        assert_eq!(cookie.value(), "abc");
        assert_eq!(cookie.domain(), Some("youtube.com"));
        assert_eq!(cookie.path(), Some("/"));
        assert_eq!(cookie.http_only(), Some(true));
        assert_eq!(cookie.secure(), Some(true));
    }
}
