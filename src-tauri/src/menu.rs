use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Manager,
};

pub fn setup_menu(app: &AppHandle) -> tauri::Result<()> {
    let playback_menu = SubmenuBuilder::new(app, "Playback")
        .item(&MenuItemBuilder::with_id("pb-speed", "Speed...").build(app)?)
        .item(&MenuItemBuilder::with_id("pb-crossfade", "Crossfade").build(app)?)
        .item(&MenuItemBuilder::with_id("pb-normalize", "Normalize Volume").build(app)?)
        .item(&MenuItemBuilder::with_id("pb-skip-silence", "Skip Silence").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("pb-sleep", "Sleep Timer").build(app)?)
        .item(&MenuItemBuilder::with_id("pb-pip", "Picture in Picture").build(app)?)
        .build()?;

    let extensions_menu = SubmenuBuilder::new(app, "Extensions")
        .item(&MenuItemBuilder::with_id("ext-sponsorblock", "SponsorBlock").build(app)?)
        .item(&MenuItemBuilder::with_id("ext-lyrics", "Synced Lyrics").build(app)?)
        .item(&MenuItemBuilder::with_id("ext-lastfm", "Last.fm").build(app)?)
        .item(&MenuItemBuilder::with_id("ext-discord", "Discord").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("ext-download", "Download Track").build(app)?)
        .item(&MenuItemBuilder::with_id("ext-key-bpm", "Key & BPM").build(app)?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&MenuItemBuilder::with_id("view-reload", "Reload")
            .accelerator("CmdOrCtrl+R")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("view-devtools", "Developer Tools")
            .accelerator("CmdOrCtrl+Shift+I")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("view-theme", "Theme...").build(app)?)
        .item(&MenuItemBuilder::with_id("view-mini", "Mini Player").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("view-fullscreen", "Fullscreen")
            .accelerator("F11")
            .build(app)?)
        .build()?;

    let tools_menu = SubmenuBuilder::new(app, "Tools")
        .item(&MenuItemBuilder::with_id("tools-autostart", "Start on Boot").build(app)?)
        .item(&MenuItemBuilder::with_id("tools-dnt", "Privacy Mode").build(app)?)
        .item(&MenuItemBuilder::with_id("tools-audio-device", "Audio Output...").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("tools-shortcuts", "Keyboard Shortcuts").build(app)?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItemBuilder::with_id("help-about", "About VoltYTM").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("help-github", "Source Code").build(app)?)
        .item(&MenuItemBuilder::with_id("help-issues", "Report a Bug").build(app)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&playback_menu)
        .item(&extensions_menu)
        .item(&view_menu)
        .item(&tools_menu)
        .item(&help_menu)
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(|app, event| {
        let id = event.id().as_ref();
        let js = match id {
            "view-reload" => Some("window.location.reload()"),
            "view-fullscreen" => Some("document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()"),
            "pb-pip" => Some("document.querySelector('video')?.requestPictureInPicture?.()"),
            _ => None,
        };

        if let Some(script) = js {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval(script);
            }
        }

        match id {
            "help-github" => { let _ = open::that("https://github.com/rixabhh/VoltYTM"); }
            "help-issues" => { let _ = open::that("https://github.com/rixabhh/VoltYTM/issues"); }
            "quit" => { app.exit(0); }
            _ => {}
        }
    });

    Ok(())
}
