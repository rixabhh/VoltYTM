use anyhow::Result;
use tauri::{AppHandle, Manager, Url, WebviewWindowBuilder};

const CHROME_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const INIT_SCRIPT: &str = include_str!("../scripts/init.js");

pub fn setup_main_window(app: &AppHandle, proxy_url: Option<Url>) -> Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_user_agent(CHROME_USER_AGENT)?;
        window.eval(&format!(
            "window.__VOLTYTM_PROXY__ = '{}';",
            proxy_url.map(|u| u.to_string()).unwrap_or_default()
        ))?;
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(
        app,
        "main",
        tauri::WebviewUrl::External("https://music.youtube.com".parse()?),
    );

    if let Some(proxy_url) = proxy_url {
        builder = builder.proxy_url(proxy_url);
    }

    builder
        .title("VoltYTM")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(false)
        .center()
        .visible(true)
        .user_agent(CHROME_USER_AGENT)
        .initialization_script(INIT_SCRIPT)
        .build()?;

    Ok(())
}
