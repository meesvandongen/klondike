# Klondike

A desktop Klondike Solitaire built with **Tauri** + Rust, styled after the Windows Vista edition: deep green felt, classic playing-card layout, native window menu, and the same overall card scale.

## Features

- Classic Klondike rules — draw one or draw three (Options dialog or `View` menu)
- **Guaranteed-winnable deals** — every new game is verified solvable by a built-in Klondike solver before it's dealt
- Drag-and-drop with multi-card stacks; single-click auto-sends a card to the foundations
- SVG-illustrated face cards (J / Q / K) with crowns and plumes
- Undo (`Ctrl/Cmd+Z`), Hint (`H`), Auto-Complete (`Ctrl/Cmd+A`), New Game (`F2`)
- Persistent statistics (games played, win %, best time, best score) in `localStorage`
- Native window menu (Game / Edit / View / Help) on macOS, Windows, and Linux
- Vista-style window dialogs for stats, options, and the win screen

## Prerequisites

- Node.js 20+
- Rust toolchain (stable)
- Platform-specific build dependencies — see <https://tauri.app/start/prerequisites/>

## Running locally

```bash
npm install
npm run dev
```

## Building executables

```bash
npm run build
```

Output goes to `src-tauri/target/release/bundle/`:

- macOS: `bundle/dmg/Klondike_*.dmg`
- Windows: `bundle/nsis/Klondike_*-setup.exe`
- Linux: `bundle/deb/*.deb`, `bundle/appimage/*.AppImage`

## CI

`.github/workflows/build.yml` builds Tauri bundles for macOS (universal `.dmg`) and Windows (NSIS `.exe`) on every push / PR. The job uploads the executables directly as artifacts (no zipping) and attaches them to a GitHub Release when a `v*` tag is pushed.
