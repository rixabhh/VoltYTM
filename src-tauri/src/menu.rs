use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Manager,
};

pub fn setup_menu(app: &AppHandle) -> tauri::Result<()> {
    let plugins_menu = SubmenuBuilder::new(app, "Plugins")
        .item(&MenuItemBuilder::with_id("plugin-sponsorblock", "SponsorBlock").build(app)?)
        .item(&MenuItemBuilder::with_id("plugin-lastfm", "Last.fm Scrobbling").build(app)?)
        .item(&MenuItemBuilder::with_id("plugin-discord", "Discord Rich Presence").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("plugin-settings", "Plugin Settings...").build(app)?)
        .build()?;

    let options_menu = SubmenuBuilder::new(app, "Options")
        .item(&MenuItemBuilder::with_id("opt-lyrics", "Synced Lyrics").build(app)?)
        .item(&MenuItemBuilder::with_id("opt-crossfade", "Crossfade").build(app)?)
        .item(&MenuItemBuilder::with_id("opt-normalize", "Volume Normalization").build(app)?)
        .item(&MenuItemBuilder::with_id("opt-skip-silence", "Skip Silence").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("opt-autostart", "Start at Login").build(app)?)
        .item(&MenuItemBuilder::with_id("opt-dnt", "Do Not Track").build(app)?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&MenuItemBuilder::with_id("view-reload", "Reload")
            .accelerator("CmdOrCtrl+R")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("view-devtools", "Developer Tools")
            .accelerator("CmdOrCtrl+Shift+I")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("view-speed", "Playback Speed").build(app)?)
        .item(&MenuItemBuilder::with_id("view-theme", "Theme...").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("view-fullscreen", "Toggle Fullscreen")
            .accelerator("F11")
            .build(app)?)
        .build()?;

    let nav_menu = SubmenuBuilder::new(app, "Navigation")
        .item(&MenuItemBuilder::with_id("nav-back", "Go Back")
            .accelerator("Alt+Left")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("nav-forward", "Go Forward")
            .accelerator("Alt+Right")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("nav-home", "Home").build(app)?)
        .item(&MenuItemBuilder::with_id("nav-library", "Library").build(app)?)
        .item(&MenuItemBuilder::with_id("nav-explore", "Explore").build(app)?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItemBuilder::with_id("help-about", "About VoltYTM").build(app)?)
        .item(&MenuItemBuilder::with_id("help-shortcuts", "Keyboard Shortcuts").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("help-github", "VoltYTM on GitHub").build(app)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&plugins_menu)
        .item(&options_menu)
        .item(&view_menu)
        .item(&nav_menu)
        .item(&help_menu)
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(|app, event| {
        let id = event.id().as_ref();
        let js = match id {
            "view-reload" => Some("window.location.reload()"),
            "view-fullscreen" => Some("document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()"),
            "nav-back" => Some("window.history.back()"),
            "nav-forward" => Some("window.history.forward()"),
            "nav-home" => Some("window.location.href = 'https://music.youtube.com'"),
            "nav-library" => Some("window.location.href = 'https://music.youtube.com/library'"),
            "nav-explore" => Some("window.location.href = 'https://music.youtube.com/explore'"),
            "help-github" => {
                let _ = open::that("https://github.com/rixabhh/VoltYTM");
                None
            }
            "quit" => {
                app.exit(0);
                None
            }
            _ => None,
        };

        if let Some(script) = js {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval(script);
            }
        }
    });

    Ok(())
}
