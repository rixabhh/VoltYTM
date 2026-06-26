use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show VoltYTM", true, None::<&str>)?;
    let play_pause = MenuItem::with_id(app, "play-pause", "Play / Pause", true, None::<&str>)?;
    let next = MenuItem::with_id(app, "next", "Next Track", true, None::<&str>)?;
    let prev = MenuItem::with_id(app, "prev", "Previous Track", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit VoltYTM", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &show,
        &separator,
        &play_pause,
        &next,
        &prev,
        &separator,
        &quit,
    ])?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("VoltYTM")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "play-pause" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval(
                        "document.querySelector('tp-yt-paper-icon-button#play-pause-button')?.click()",
                    );
                }
            }
            "next" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval("document.querySelector('.next-button')?.click()");
                }
            }
            "prev" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval("document.querySelector('.previous-button')?.click()");
                }
            }
            "quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}
