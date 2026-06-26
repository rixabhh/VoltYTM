use serde_json::{json, Value};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Manager,
};

fn toast(app: &AppHandle, message: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let msg = message.replace('\\', "\\\\").replace('`', "\\`").replace('$', "\\$");
        let _ = window.eval(&format!(
            r#"(function() {{
                var t = document.createElement('div');
                t.textContent = '{}';
                t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:99999;font-family:sans-serif;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.1);animation:vtFade 2.5s forwards;';
                document.body.appendChild(t);
                setTimeout(function(){{ t.remove(); }}, 2500);
            }})();"#,
            msg
        ));
        let _ = window.eval(r#"if(!document.getElementById('vt-toast-anim')){var s=document.createElement('style');s.id='vt-toast-anim';s.textContent='@keyframes vtFade{0%{opacity:1;transform:translateX(-50%) translateY(0)}70%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-10px)}}';document.head.appendChild(s)}"#);
    }
}

pub fn setup_menu(app: &AppHandle) -> tauri::Result<()> {
    let playback_menu = SubmenuBuilder::new(app, "Playback")
        .item(&MenuItemBuilder::with_id("pb-crossfade", "Toggle Crossfade").build(app)?)
        .item(&MenuItemBuilder::with_id("pb-normalize", "Toggle Normalize Volume").build(app)?)
        .item(&MenuItemBuilder::with_id("pb-skip-silence", "Toggle Skip Silence").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("pb-sleep", "Sleep Timer").build(app)?)
        .item(&MenuItemBuilder::with_id("pb-pip", "Picture in Picture").build(app)?)
        .build()?;

    let extensions_menu = SubmenuBuilder::new(app, "Extensions")
        .item(&MenuItemBuilder::with_id("ext-sponsorblock", "Toggle SponsorBlock").build(app)?)
        .item(&MenuItemBuilder::with_id("ext-lyrics", "Toggle Synced Lyrics").build(app)?)
        .item(&MenuItemBuilder::with_id("ext-lastfm", "Toggle Last.fm").build(app)?)
        .item(&MenuItemBuilder::with_id("ext-discord", "Toggle Discord").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("ext-download", "Download Current Track").build(app)?)
        .item(&MenuItemBuilder::with_id("ext-key-bpm", "Toggle Key & BPM").build(app)?)
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
        .item(&MenuItemBuilder::with_id("view-mini", "Mini Player").build(app)?)
        .item(&MenuItemBuilder::with_id("view-fullscreen", "Fullscreen")
            .accelerator("F11")
            .build(app)?)
        .build()?;

    let tools_menu = SubmenuBuilder::new(app, "Tools")
        .item(&MenuItemBuilder::with_id("tools-autostart", "Toggle Start on Boot").build(app)?)
        .item(&MenuItemBuilder::with_id("tools-dnt", "Toggle Privacy Mode").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("tools-copy-url", "Copy Current URL")
            .accelerator("CmdOrCtrl+Shift+C")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("tools-restart", "Restart App").build(app)?)
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

    let app_clone = app.clone();
    app.on_menu_event(move |app, event| {
        let id = event.id().as_ref();

        // Toggle plugin config and show feedback
        let toggle_js = |config_path: &str, label: &str| {
            let app = app.clone();
            let config_path = config_path.to_string();
            let label = label.to_string();
            tauri::async_runtime::spawn(async move {
                let result: Result<Value, _> = crate::commands::read_config(&app).await;
                if let Ok(mut config) = result {
                    let parts: Vec<&str> = config_path.split('.').collect();
                    let mut current = &mut config;
                    for part in &parts {
                        current = current
                            .as_object_mut()
                            .unwrap()
                            .entry(part.to_string())
                            .or_insert_with(|| json!({}));
                    }
                    let enabled = current.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
                    if let Some(obj) = current.as_object_mut() {
                        obj.insert("enabled".into(), json!(!enabled));
                    }
                    let _ = crate::commands::write_config(&app, &config).await;
                    let status = if !enabled { "ON" } else { "OFF" };
                    toast(&app, &format!("{label}: {status}"));
                }
            });
        };

        match id {
            "ext-sponsorblock" => toggle_js("plugins.sponsorblock", "SponsorBlock"),
            "ext-lyrics" => toggle_js("plugins.syncedLyrics", "Synced Lyrics"),
            "ext-lastfm" => toggle_js("plugins.lastfm", "Last.fm"),
            "ext-discord" => toggle_js("plugins.discord", "Discord"),
            "ext-key-bpm" => toggle_js("plugins.keyBpm", "Key & BPM"),
            "pb-crossfade" => toggle_js("plugins.crossfade", "Crossfade"),
            "pb-normalize" => toggle_js("plugins.volumeNormalizer", "Volume Normalizer"),
            "pb-skip-silence" => toggle_js("plugins.skipSilence", "Skip Silence"),
            "tools-dnt" => toggle_js("plugins.doNotTrack", "Privacy Mode"),
            "tools-autostart" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let result = crate::autostart::set_autostart(true).await;
                    match result {
                        Ok(status) => {
                            let msg = if status.enabled { "Start on Boot: ON" } else { "Start on Boot: OFF" };
                            toast(&app, msg);
                        }
                        Err(e) => toast(&app, &format!("Error: {e}")),
                    }
                });
            }

            // JS-only actions
            "view-reload" => eval(app, "window.location.reload()"),
            "view-force-reload" => eval(app, "window.location.reload(true)"),
            "view-fullscreen" => eval(app, "document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()"),
            "view-zoom-in" => eval(app, "(function(){var z=parseFloat(document.body.dataset.vtZoom||'1');z=Math.min(2,z+0.1);document.body.dataset.vtZoom=z;document.body.style.transform='scale('+z+')';document.body.style.transformOrigin='0 0';document.body.style.width=(100/z)+'%';document.body.style.height=(100/z)+'%';})()"),
            "view-zoom-out" => eval(app, "(function(){var z=parseFloat(document.body.dataset.vtZoom||'1');z=Math.max(0.5,z-0.1);document.body.dataset.vtZoom=z;document.body.style.transform='scale('+z+')';document.body.style.transformOrigin='0 0';document.body.style.width=(100/z)+'%';document.body.style.height=(100/z)+'%';})()"),
            "view-zoom-reset" => eval(app, "(function(){document.body.dataset.vtZoom='1';document.body.style.transform='';document.body.style.width='';document.body.style.height='';})()"),
            "view-search" => eval(app, "var s=document.querySelector('input#input, input[placeholder*=\"Search\"]');if(s){s.focus();s.select()}"),
            "pb-pip" => eval(app, "document.querySelector('video')?.requestPictureInPicture?.()"),
            "ext-download" => eval(app, "document.getElementById('voltytm-dl-btn')?.click()"),
            "view-mini" => eval(app, "document.getElementById('voltytm-mini-btn')?.click()"),
            "tools-copy-url" => eval(app, "navigator.clipboard.writeText(window.location.href).then(function(){})"),
            "tools-restart" => app.restart(),
            "help-github" => { let _ = open::that("https://github.com/rixabhh/VoltYTM"); }
            "help-issues" => { let _ = open::that("https://github.com/rixabhh/VoltYTM/issues"); }
            _ => {}
        }
    });

    Ok(())
}

fn eval(app: &AppHandle, js: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(js);
    }
}

use serde_json::{json, Value};
