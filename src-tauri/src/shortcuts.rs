use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub fn register_defaults(app: &AppHandle) -> tauri::Result<()> {
    let shortcuts = [
        ("MediaPlayPause", "document.querySelector('tp-yt-paper-icon-button#play-pause-button')?.click()"),
        ("MediaTrackNext", "document.querySelector('.next-button')?.click()"),
        ("MediaTrackPrevious", "document.querySelector('.previous-button')?.click()"),
        ("MediaStop", "document.querySelector('video')?.pause()"),
    ];

    for (key, js) in shortcuts {
        let app_clone = app.clone();
        let js = js.to_string();
        if let Err(error) = app.global_shortcut()
            .on_shortcut(key, move |_app, _shortcut, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }
                if let Some(window) = app_clone.get_webview_window("main") {
                    let _ = window.eval(&js);
                }
            }) {
            tracing::warn!(%key, %error, "failed to register default media shortcut");
        }
    }

    tracing::debug!("registered default media global shortcuts");
    Ok(())
}
