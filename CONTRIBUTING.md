# Contributing to VoltYTM

Thank you for your interest in contributing to VoltYTM. This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Make your changes
5. Run tests and checks
6. Submit a pull request

## Development Setup

```bash
git clone https://github.com/your-username/VoltYTM.git
cd VoltYTM
corepack enable
corepack pnpm install
corepack pnpm tauri dev
```

## Before Submitting a PR

Run all checks to ensure your changes don't break anything:

```bash
# Build frontend
corepack pnpm run build

# Check Rust code compiles
cargo check --manifest-path src-tauri/Cargo.toml

# Run Rust tests
cargo test --manifest-path src-tauri/Cargo.toml

# Run frontend tests
corepack pnpm run test
```

## Code Guidelines

### Rust (Backend)

- Keep new desktop functionality in `src-tauri/src/` modules
- Do not add Electron or Node.js dependencies
- Register new Tauri commands in `lib.rs` under `invoke_handler`
- Add tests for new commands in `commands.rs`
- Use `anyhow` for error handling in non-command code
- Use `Result<T, String>` for Tauri command return types

### TypeScript (Frontend)

- Keep plugin renderer code in `src-tauri/scripts/init.js`
- Use the Tauri IPC bridge in `src/lib/bridge.ts` for all Rust communication
- Plugin definitions go in `src/plugins/`
- Shared types go in `src/types/`
- Follow the existing code style (no semicolons in Svelte, consistent formatting)

### Plugins

- Each plugin is a self-contained module in `init.js` under `rendererPlugins`
- Plugins receive a `config` object and should check `config.enabled` before starting
- Return a cleanup function from `start()` that removes all DOM elements and clears intervals
- Use the `invoke()` helper for Tauri IPC calls
- Add default config for new plugins in `commands.rs` `default_config()`

### CSS / UI

- Use consistent styling: `rgba(0,0,0,0.7)` backgrounds, `backdrop-filter: blur(8px)`, `border-radius: 50%` for buttons
- All floating buttons should be 40x40px circles
- Use the established color palette: `#4fd1b3` (accent), `#ff6b6b` (red), `#a78bfa` (purple)
- Test that UI elements don't overlap with YouTube Music's interface

## Architecture

VoltYTM uses a two-layer architecture:

1. **Rust backend** (`src-tauri/src/`) — handles system integration, networking, and native features
2. **Renderer scripts** (`src-tauri/scripts/init.js`) — injected into YouTube Music's webview for DOM manipulation and plugin execution

Communication flows through Tauri's IPC system. The frontend bridge (`src/lib/bridge.ts`) wraps all IPC calls with TypeScript types.

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include your OS, app version, and steps to reproduce
- For feature requests, describe the use case and expected behavior

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
