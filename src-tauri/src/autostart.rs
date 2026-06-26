use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

const APP_NAME: &str = "VoltYTM";
const APP_ID: &str = "com.rixabhh.voltytm";

#[derive(Debug, Serialize, Deserialize)]
pub struct AutostartStatus {
    pub enabled: bool,
}

pub fn is_autostart_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let HKCU = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = HKCU.open_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            KEY_READ,
        ) {
            return key.get_value::<String, _>(APP_NAME).is_ok();
        }
        false
    }

    #[cfg(target_os = "macos")]
    {
        let plist_path = launch_agent_path();
        plist_path.exists()
    }

    #[cfg(target_os = "linux")]
    {
        let desktop_path = autostart_desktop_path();
        desktop_path.exists()
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        false
    }
}

pub fn enable_autostart() -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let exe = std::env::current_exe()?.to_string_lossy().to_string();
        let HKCU = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = HKCU.create_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            KEY_ALL_ACCESS,
        )?;
        key.set_value(APP_NAME, &format!("\"{}\" --minimized", exe))?;
    }

    #[cfg(target_os = "macos")]
    {
        let plist_path = launch_agent_path();
        if let Some(parent) = plist_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let exe = std::env::current_exe()?.to_string_lossy().to_string();
        let plist = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{APP_ID}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{exe}</string>
        <string>--minimized</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/tmp/{APP_ID}.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/{APP_ID}.stderr.log</string>
</dict>
</plist>"#
        );
        std::fs::write(&plist_path, plist)?;
    }

    #[cfg(target_os = "linux")]
    {
        let desktop_path = autostart_desktop_path();
        if let Some(parent) = desktop_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let exe = std::env::current_exe()?.to_string_lossy().to_string();
        let desktop = format!(
            r#"[Desktop Entry]
Type=Application
Name={APP_NAME}
Exec={exe} --minimized
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
"#
        );
        std::fs::write(&desktop_path, desktop)?;
    }

    Ok(())
}

pub fn disable_autostart() -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let HKCU = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = HKCU.open_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            KEY_ALL_ACCESS,
        ) {
            let _ = key.delete_value(APP_NAME);
        }
    }

    #[cfg(target_os = "macos")]
    {
        let plist_path = launch_agent_path();
        if plist_path.exists() {
            std::fs::remove_file(&plist_path)?;
            // Unload the agent
            let _ = std::process::Command::new("launchctl")
                .args(["unload", &plist_path.to_string_lossy()])
                .output();
        }
    }

    #[cfg(target_os = "linux")]
    {
        let desktop_path = autostart_desktop_path();
        if desktop_path.exists() {
            std::fs::remove_file(&desktop_path)?;
        }
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn launch_agent_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home)
        .join("Library")
        .join("LaunchAgents")
        .join(format!("{APP_ID}.plist"))
}

#[cfg(target_os = "linux")]
fn autostart_desktop_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home)
        .join(".config")
        .join("autostart")
        .join(format!("{APP_ID}.desktop"))
}

#[tauri::command]
pub async fn get_autostart_status() -> Result<AutostartStatus, String> {
    Ok(AutostartStatus {
        enabled: is_autostart_enabled(),
    })
}

#[tauri::command]
pub async fn set_autostart(enabled: bool) -> Result<AutostartStatus, String> {
    if enabled {
        enable_autostart().map_err(|e| e.to_string())?;
    } else {
        disable_autostart().map_err(|e| e.to_string())?;
    }
    Ok(AutostartStatus {
        enabled: is_autostart_enabled(),
    })
}
