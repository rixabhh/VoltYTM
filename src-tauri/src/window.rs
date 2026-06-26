use anyhow::Result;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const CHROME_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

pub fn setup_main_window(app: &AppHandle) -> Result<()> {
    if app.get_webview_window("main").is_some() {
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app,
        "main",
        WebviewUrl::External("https://music.youtube.com".parse()?),
    )
    .title("VoltYTM")
    .inner_size(1280.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .resizable(true)
    .center()
    .visible(true)
    .user_agent(CHROME_USER_AGENT)
    .build()?;

    Ok(())
}
