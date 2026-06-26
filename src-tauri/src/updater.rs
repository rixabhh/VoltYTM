use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

pub async fn check_for_updates(app: AppHandle) {
    tokio::time::sleep(std::time::Duration::from_secs(3)).await;

    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                tracing::info!("update available: {}", update.version);
                let _ = app.emit("update-available", &update.version);
            }
            Ok(None) => tracing::debug!("VoltYTM is up to date"),
            Err(error) => tracing::warn!("update check failed: {error}"),
        },
        Err(error) => tracing::warn!("updater unavailable: {error}"),
    }
}
