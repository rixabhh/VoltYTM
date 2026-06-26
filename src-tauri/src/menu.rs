use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Manager,
};

pub fn setup_menu(app: &AppHandle) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        let app_menu = SubmenuBuilder::new(app, "VoltYTM")
            .about(Some(tauri::menu::AboutMetadata {
                name: Some("VoltYTM".to_string()),
                version: Some(env!("CARGO_PKG_VERSION").to_string()),
                ..Default::default()
            }))
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .quit()
            .build()?;

        let view_menu = SubmenuBuilder::new(app, "View")
            .item(&MenuItemBuilder::with_id("settings", "Settings")
                .accelerator("CmdOrCtrl+,")
                .build(app)?)
            .separator()
            .fullscreen()
            .build()?;

        let window_menu = SubmenuBuilder::new(app, "Window")
            .minimize()
            .separator()
            .bring_all_to_front()
            .build()?;

        let menu = MenuBuilder::new(app)
            .item(&app_menu)
            .item(&view_menu)
            .item(&window_menu)
            .build()?;

        app.set_menu(menu)?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let reload = MenuItemBuilder::with_id("reload", "Reload")
            .accelerator("CmdOrCtrl+R")
            .build(app)?;
        let quit = MenuItemBuilder::with_id("quit", "Quit")
            .accelerator("CmdOrCtrl+Q")
            .build(app)?;
        let file_menu = SubmenuBuilder::new(app, "File")
            .item(&reload)
            .separator()
            .item(&quit)
            .build()?;
        let menu = MenuBuilder::new(app).item(&file_menu).build()?;

        app.set_menu(menu)?;
    }

    app.on_menu_event(|app, event| match event.id().as_ref() {
        "reload" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval("window.location.reload()");
            }
        }
        "quit" => app.exit(0),
        _ => {}
    });

    Ok(())
}
