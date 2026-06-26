use tauri::AppHandle;

pub fn initialize(_app: &AppHandle) -> tauri::Result<()> {
    tracing::debug!("plugin backend registry initialized");
    Ok(())
}
