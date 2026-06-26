use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, CheckMenuItemBuilder},
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
        .item(&MenuItemBuilder::with_id("view-force-reload", "Force Reload")
            .accelerator("CmdOrCtrl+Shift+R")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("view-devtools", "Developer Tools")
            .accelerator("CmdOrCtrl+Shift+I")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("view-search", "Focus Search")
            .accelerator("CmdOrCtrl+K")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("view-zoom-in", "Zoom In")
            .accelerator("CmdOrCtrl+Shift+=")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("view-zoom-out", "Zoom Out")
            .accelerator("CmdOrCtrl+-")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("view-zoom-reset", "Reset Zoom")
            .accelerator("CmdOrCtrl+0")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("view-theme", "Theme...").build(app)?)
        .item(&MenuItemBuilder::with_id("view-mini", "Mini Player").build(app)?)
        .item(&MenuItemBuilder::with_id("view-fullscreen", "Fullscreen")
            .accelerator("F11")
            .build(app)?)
        .build()?;

    let tools_menu = SubmenuBuilder::new(app, "Tools")
        .item(&MenuItemBuilder::with_id("tools-autostart", "Start on Boot").build(app)?)
        .item(&MenuItemBuilder::with_id("tools-dnt", "Privacy Mode").build(app)?)
        .item(&MenuItemBuilder::with_id("tools-audio-device", "Audio Output...").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("tools-copy-url", "Copy Current URL")
            .accelerator("CmdOrCtrl+Shift+C")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("tools-shortcuts", "Keyboard Shortcuts").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("tools-restart", "Restart App")
            .accelerator("CmdOrCtrl+Shift+R")
            .build(app)?)
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

        // JS-based actions
        let js = match id {
            "view-reload" => Some("window.location.reload()"),
            "view-force-reload" => Some("window.location.reload(true)"),
            "view-fullscreen" => Some("document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()"),
            "view-zoom-in" => Some("document.body.style.zoom = (parseFloat(document.body.style.zoom || '1') + 0.1).toString()"),
            "view-zoom-out" => Some("document.body.style.zoom = Math.max(0.5, parseFloat(document.body.style.zoom || '1') - 0.1).toString()"),
            "view-zoom-reset" => Some("document.body.style.zoom = '1'"),
            "view-search" => Some("document.querySelector('input#input, input[placeholder*=\"Search\"], input[aria-label*=\"Search\"]')?.focus()"),
            "pb-pip" => Some("document.querySelector('video')?.requestPictureInPicture?.()"),
            _ => None,
        };

        if let Some(script) = js {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval(script);
            }
        }

        // Non-JS actions
        match id {
            "tools-copy-url" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval("navigator.clipboard.writeText(window.location.href)");
                }
            }
            "tools-restart" => {
                app.restart();
            }
            "help-github" => { let _ = open::that("https://github.com/rixabhh/VoltYTM"); }
            "help-issues" => { let _ = open::that("https://github.com/rixabhh/VoltYTM/issues"); }
            _ => {}
        }
    });

    Ok(())
}
