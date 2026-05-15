# Klondike

A desktop Klondike Solitaire built with Electron, styled after the Windows Vista edition: deep green felt, classic playing-card layout, native application menu, and the same overall card scale.

## Features

- Classic Klondike rules — draw one or draw three, configurable in the Options dialog
- Drag-and-drop and double-click auto-move to the foundations
- Undo (`Ctrl/Cmd+Z`), Hint (`H`), Auto-Complete (`Ctrl/Cmd+A`), New Game (`F2`)
- Persistent statistics (games played, win %, best time, best score)
- Native application menu on macOS / Windows / Linux
- Vista-style window dialogs for stats, options, and the win screen

## Running locally

```bash
npm install
npm start
```

## Building installers

```bash
# both, for current platform
npm run dist

# explicit platforms (run on matching OS, or via CI)
npm run dist:mac
npm run dist:win
```

Output goes to `release/`.

## CI

`.github/workflows/build.yml` builds macOS (`.dmg`, `.zip`) and Windows (`.exe` NSIS + portable) artifacts on every push / PR, and attaches them to a GitHub Release when a `v*` tag is pushed.
