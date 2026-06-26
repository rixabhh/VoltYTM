mod adblock;
mod autostart;
mod commands;
mod discord;
mod menu;
mod plugins;
mod proxy;
mod session;
mod shortcuts;
mod tray;
mod updater;
mod window;

use tauri::Manager;
use tracing_subscriber::EnvFilter;

pub fn run(start_minimized: bool) {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let handle = app.handle().clone();

            // Start proxy in background
            let proxy_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                match proxy::start().await {
                    Ok(proxy) => {
                        proxy_handle.manage(proxy);
                        tracing::info!("Ad-block proxy started");
                    }
                    Err(e) => {
                        tracing::warn!("Failed to start ad-block proxy: {e}");
                    }
                }
            });

            // Create main window
            if let Err(e) = window::setup_main_window(&handle) {
                tracing::error!("Failed to create main window: {e}");
                return Err(e.into());
            }

            // Start minimized if launched with --minimized
            if start_minimized {
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            // System tray
            if let Err(e) = tray::setup_tray(&handle) {
                tracing::warn!("Tray setup failed: {e}");
            }

            // Native menu
            if let Err(e) = menu::setup_menu(&handle) {
                tracing::warn!("Menu setup failed: {e}");
            }

            // Global media shortcuts
            if let Err(e) = shortcuts::register_defaults(&handle) {
                tracing::warn!("Shortcuts failed: {e}");
            }

            // Plugin initialization
            if let Err(e) = plugins::initialize(&handle) {
                tracing::warn!("Plugins init failed: {e}");
            }

            // Cookie session persistence
            if let Err(e) = session::initialize(&handle) {
                tracing::warn!("Session init failed: {e}");
            }

            // Background update check
            let updater_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                updater::check_for_updates(updater_handle).await;
            });

            // Close to tray — persist cookies and hide window
            if let Some(window) = handle.get_webview_window("main") {
                let close_handle = handle.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let h = close_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = session::persist_cookies_for_app(&h).await;
                        });
                        if let Some(w) = h.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                });
            }

            tracing::info!("VoltYTM started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::set_config,
            commands::open_external,
            commands::show_notification,
            commands::get_platform,
            commands::register_shortcut,
            commands::unregister_shortcut,
            commands::lastfm_scrobble,
            commands::discord_update_presence,
            commands::discord_clear_presence,
            commands::get_adblock_proxy_status,
            commands::get_app_version,
            commands::classify_network_url,
            commands::apply_theme,
            commands::remove_theme,
            commands::list_themes,
            commands::get_theme_css,
            commands::fetch_lyrics,
            commands::download_track,
            autostart::get_autostart_status,
            autostart::set_autostart,
            session::get_ytm_cookies,
            session::persist_cookies,
        ])
        .run(tauri::generate_context!())
        .expect("error while running VoltYTM");
}
