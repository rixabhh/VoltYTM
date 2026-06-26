# Changelog

## 1.0.0

### Core
- Native Tauri v2 desktop application for Windows, macOS, and Linux
- Rust-backed ad blocking with local HTTP proxy and renderer request interception
- Chrome user agent spoofing for full YouTube Music experience
- Cookie persistence across app restarts
- Auto-updater with GitHub Releases integration
- System tray with playback controls (play/pause, next, previous)
- Native application menus (macOS app menu, Windows/Linux file menu)
- Global media key shortcuts (play/pause, next, previous, stop)

### Plugins (23 built-in)
- **Ad Blocking** — Dual-layer network filtering (proxy + renderer interceptors)
- **Synced Lyrics** — Time-synced lyrics from lrclib.net, Netease, and lyrics.ovh
- **Crossfade** — Smooth audio transitions between tracks
- **Download** — MP3/FLAC/AAC/OGG/WAV with configurable quality and metadata
- **Playback Speed** — 0.25x–3x with pitch preservation toggle
- **Key & BPM** — Real-time musical key and tempo detection
- **Discord RPC** — Discord Rich Presence integration
- **Last.fm** — Automatic track scrobbling
- **SponsorBlock** — Skip sponsored segments
- **Notifications** — Desktop notifications on track change
- **Sleep Timer** — Countdown or end-of-track stop
- **Audio Device** — Switch between output devices
- **Volume Normalizer** — Automatic loudness normalization
- **Mini Player** — Compact floating player panel
- **Picture-in-Picture** — Native PiP mode
- **Skip Silence** — Fast-forward silent sections
- **Do Not Track** — Privacy headers and tracker blocking
- **Disable Autoplay** — Pause on track change
- **Skip Disliked** — Auto-skip thumbs-down tracks
- **Compact Sidebar** — Condensed sidebar layout
- **Navigation** — Back/forward browser buttons
- **Unobtrusive Player** — Dim player bar when idle
- **Theming** — Dark, AMOLED, Catppuccin Mocha, and Gruvbox themes

### Build & CI
- GitHub Actions CI on Windows, macOS, and Linux
- Release workflow with multi-platform builds
- Automated GitHub Releases with draft mode
