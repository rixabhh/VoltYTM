mod adblock;
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

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("warn")),
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
        .setup(|app| {
            let handle = app.handle().clone();
            let proxy = tauri::async_runtime::block_on(proxy::start())?;
            let proxy_url = proxy.proxy_url();
            handle.manage(proxy);

            window::setup_main_window(&handle, Some(proxy_url))?;
            tray::setup_tray(&handle)?;
            menu::setup_menu(&handle)?;
            shortcuts::register_defaults(&handle)?;
            plugins::initialize(&handle)?;
            session::initialize(&handle)?;

            let updater_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                updater::check_for_updates(updater_handle).await;
            });

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
            session::get_ytm_cookies,
            session::persist_cookies,
        ])
        .run(tauri::generate_context!())
        .expect("error while running VoltYTM");
}
