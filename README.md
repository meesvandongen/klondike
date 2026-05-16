# Solitaire Suite

Five classic solitaire variants — **Klondike**, **FreeCell**, **Spider** (1-suit), **TriPeaks** and **Pyramid** — built with [Tauri](https://tauri.app) + Rust, styled after the Windows Vista native edition: deep felt background, classic playing-card layout, native window menu, and shared card scale.

Each variant ships as its own executable (Klondike.exe / FreeCell.dmg / etc.) with its own icon and identifier.

## Variants

| Variant   | Mechanic           | Notes                                                   |
|-----------|--------------------|---------------------------------------------------------|
| Klondike  | Drag, click-to-act | Guaranteed-winnable deals via built-in solver           |
| FreeCell  | Drag, click-to-act | 4 free cells, near-100% solvable random deals           |
| Spider    | Drag, click-to-act | 1-suit (8 sequences of Spades), stock deals 10 at once  |
| TriPeaks  | Click only         | Chain consecutive ranks (A↔K wraps) for bonus points    |
| Pyramid   | Click only         | Pair cards summing to 13; 3 stock recycles              |

## Shared base

The frontend lives entirely under `src/`. A `src/shared/` directory provides the reusable infrastructure used by every variant:

- `deck.js`       — suits, ranks, glyphs, deck builder
- `card.js`       — DOM card factory + SVG face-card art
- `drag.js`       — pointer-capture-based drag/drop manager (used by drag-based games)
- `modal.js`      — Vista-style dialog
- `menu.js`       — Tauri menu listener + dispatch
- `hotkeys.js`    — `F2`, `Ctrl/Cmd+Z`, `H`, `Ctrl/Cmd+A` mapping + Escape/Enter modal handling
- `stats.js`      — per-game localStorage stats
- `status.js`     — status-bar updater
- `overlay.js`    — "dealing…" overlay
- `styles.css`    — shared Vista board / card / modal / status styling
- `utils.js`      — `formatTime`, `cssVarPx`, `shuffle`, `clone`

Each variant directory (`src/<game>/`) contains only the game-specific bits:

- `game.js`  — rules engine (state, moves, win, undo, hint, auto-complete)
- `solver.js` — *Klondike only*, used for winnable-deal verification
- `main.js`  — wires rendering, drag/click, dialogs and menu to the engine
- `index.html`, `styles.css` — board layout overrides

The native menu (Game / Edit / View / Help) is defined once in `src-tauri/src/lib.rs` and emits a generic `menu` event; each variant decides how to handle the action (or whether to ignore it).

## Prerequisites

- Node.js 20+
- Rust toolchain (stable)
- Tauri platform prerequisites — see <https://tauri.app/start/prerequisites/>

## Running a variant locally

```bash
npm install

npm run dev:klondike
npm run dev:freecell
npm run dev:spider
npm run dev:tripeaks
npm run dev:pyramid
```

## Building executables

```bash
npm run build:klondike
npm run build:freecell
npm run build:spider
npm run build:tripeaks
npm run build:pyramid
```

Each command writes to `src-tauri/target/release/bundle/`:

- macOS: `bundle/dmg/<Variant>_*.dmg`
- Windows: `bundle/nsis/<Variant>_*-setup.exe`
- Linux: `bundle/deb/*.deb`, `bundle/appimage/*.AppImage`

## CI

`.github/workflows/build.yml` runs a **(platform × variant)** matrix — 10 parallel jobs — building each variant for macOS (universal `.dmg`) and Windows (NSIS `.exe`). Each job uploads its own executable as an artifact (no zipping); on a `v*` tag push, every artifact is attached to a GitHub Release.
