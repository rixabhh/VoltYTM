<p align="center">
  <img src="assets/icon.png" width="120" alt="VoltYTM Logo" />
</p>

<h1 align="center">VoltYTM</h1>

<p align="center">
  A native desktop client for YouTube Music.<br/>
  Built with Tauri v2 + Rust. Fast, lightweight, and feature-rich.
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#download">Download</a> &bull;
  <a href="#plugins">Plugins</a> &bull;
  <a href="#development">Development</a> &bull;
  <a href="#license">License</a>
</p>

---

## What is VoltYTM?

VoltYTM is a standalone desktop application that wraps YouTube Music in a native webview, delivering a fast, ad-free experience with built-in plugins for scrobbling, lyrics, downloads, and more. It runs natively on Windows, macOS, and Linux without the overhead of a full browser.

## Features

### Ad-Free Experience
Built-in ad blocking at two layers — a native network proxy and renderer-level request interception. Music streams are never affected.

### Synced Lyrics
Real-time time-synced lyrics displayed alongside playback. Powered by multiple lyrics databases for maximum coverage.

### Download Music
Download tracks as MP3, FLAC, AAC, OGG, or WAV with configurable quality (up to 320 kbps), embedded metadata, and album art.

### Playback Speed Control
Slow down or speed up any track from 0.25x to 3x. Pitch preservation toggle for clean speed changes or the classic "slowed" aesthetic.

### Crossfade
Smooth audio transitions between tracks. Configurable fade duration for gapless playback.

### Picture-in-Picture
Floating mini player that stays on top of other windows. Always see what's playing.

### Key & BPM Detection
Real-time analysis that displays the musical key and BPM of any track.

### Discord Rich Presence
Show what you're listening to on your Discord profile with album art and timestamps.

### Last.fm Scrobbling
Automatic track scrobbling with configurable progress threshold.

### SponsorBlock
Skips sponsored segments, intros, outros, and other community-reported sections.

### Sleep Timer
Set a countdown timer or stop playback at the end of the current track.

### Volume Normalization
Automatic loudness normalization to keep volume consistent across tracks.

### Audio Output Picker
Switch between speakers, headphones, and Bluetooth devices without leaving the app.

### Mini Player
Compact floating panel with album art, track info, and playback controls.

### Native Notifications
Desktop notifications when a new track starts.

### Skip Silence
Automatically fast-forwards through silent sections of tracks.

### Theme Support
Multiple built-in themes (Dark, AMOLED, Catppuccin Mocha, Gruvbox) with custom CSS theme support.

### Privacy
Do Not Track headers, tracker blocking, and no telemetry collection.

### Customizable
Configurable keyboard shortcuts, navigation controls, compact sidebar, and unobtrusive player mode.

## Download

Visit the [Releases](https://github.com/rixabhh/VoltYTM/releases) page to download the latest version for your platform.

| Platform | Format |
|---|---|
| Windows | `.msi` installer |
| macOS | `.dmg` (Apple Silicon + Intel) |
| Linux | `.deb`, `.AppImage` |

### Requirements

- **Windows**: WebView2 Runtime (usually pre-installed on Windows 10/11)
- **macOS**: macOS 10.15 or later
- **Linux**: `libwebkit2gtk-4.1-0` and `libayatana-appindicator3-1`

## Plugins

VoltYTM ships with 23 built-in plugins. All can be toggled on or off from the settings panel.

| Plugin | Description | Default |
|---|---|---|
| Ad Blocking | Network-level ad and tracker blocking | On |
| Synced Lyrics | Time-synced lyrics display | On |
| Crossfade | Smooth transitions between tracks | Off |
| Download | Download tracks as audio files | On |
| Playback Speed | 0.25x-3x speed with pitch control | On |
| Key & BPM | Musical key and tempo detection | Off |
| Discord RPC | Discord Rich Presence integration | Off |
| Last.fm | Track scrobbling | Off |
| SponsorBlock | Skip sponsored segments | On |
| Notifications | Desktop notifications on track change | On |
| Sleep Timer | Countdown or end-of-track stop | On |
| Audio Device | Switch audio output devices | On |
| Volume Normalizer | Automatic loudness normalization | Off |
| Mini Player | Compact floating player panel | On |
| Picture-in-Picture | Native PiP mode | On |
| Skip Silence | Fast-forward silent sections | Off |
| Do Not Track | Privacy headers and tracker blocking | On |
| Disable Autoplay | Pause on track change | Off |
| Skip Disliked | Auto-skip thumbs-down tracks | Off |
| Compact Sidebar | Condensed sidebar layout | Off |
| Navigation | Back/forward browser buttons | On |
| Unobtrusive Player | Dim player bar when idle | Off |
| Playback Speed | Speed control with presets | On |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 9+
- [Rust](https://rustup.rs/) 1.85+
- Platform-specific dependencies (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

### Setup

```bash
git clone https://github.com/rixabhh/VoltYTM.git
cd VoltYTM
corepack enable
corepack pnpm install
```

### Run in Development

```bash
corepack pnpm tauri dev
```

### Build for Production

```bash
corepack pnpm tauri build
```

### Run Tests

```bash
# Frontend tests
corepack pnpm run test

# Rust tests
cargo test --manifest-path src-tauri/Cargo.toml
```

### Project Structure

```
VoltYTM/
├── src/                    # Svelte frontend (settings UI)
│   ├── App.svelte          # Settings panel
│   ├── lib/bridge.ts       # Tauri IPC wrapper
│   ├── plugins/            # TypeScript plugin definitions
│   └── types/              # Shared types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── lib.rs          # App setup and plugin registration
│   │   ├── commands.rs     # Tauri commands (IPC handlers)
│   │   ├── adblock.rs      # URL classifier for ad blocking
│   │   ├── proxy.rs        # Local HTTP proxy for network filtering
│   │   ├── discord.rs      # Discord IPC integration
│   │   ├── session.rs      # Cookie persistence
│   │   ├── shortcuts.rs    # Global media key registration
│   │   ├── tray.rs         # System tray setup
│   │   ├── menu.rs         # Native application menu
│   │   ├── updater.rs      # Auto-update logic
│   │   └── window.rs       # WebView configuration
│   ├── scripts/init.js     # Injected into YouTube Music page
│   ├── themes/             # Bundled CSS themes
│   └── tauri.conf.json     # Tauri configuration
├── tests/                  # Frontend tests
└── .github/workflows/      # CI/CD pipelines
```

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Disclaimer

**No Affiliation**

This project, and its contributors, are not affiliated with, authorized by, endorsed by, or in any way officially connected with Google LLC, YouTube, or any of their subsidiaries or affiliates. This is an independent, non-profit, and unofficial application developed by a team of volunteers with the goal of providing a desktop experience.

**Trademarks**

The names "Google" and "YouTube Music", as well as related names, marks, emblems, and images, are registered trademarks of their respective owners. Any use of these trademarks is for identification and reference purposes only and does not imply any association with the trademark holder. We have no intention of infringing upon these trademarks or causing harm to the trademark holders.

**Limitation of Liability**

This application is provided "AS IS", and you use it at your own risk. In no event shall the developers or contributors be liable for any claim, damages, or other liability, including any legal consequences, arising from, out of, or in connection with the software or the use or other dealings in the software. The responsibility for any and all outcomes of using this software rests entirely with the user.
