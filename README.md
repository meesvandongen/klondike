# Solitaire Suite

Six classic card games — **Klondike**, **FreeCell**, **Spider** (1-suit), **TriPeaks**, **Pyramid** and **Hearts** — built with [Tauri](https://tauri.app) + Rust + SolidJS, styled after the Windows Vista native editions: deep felt background, classic playing-card layout, native window menu, and shared card scale.

Each variant ships as its own executable (Klondike.exe / FreeCell.dmg / etc.) with its own icon and identifier, and the whole suite is also published as a single static web bundle.

## Variants

| Variant   | Mechanic           | Notes                                                   |
|-----------|--------------------|---------------------------------------------------------|
| Klondike  | Drag, click-to-act | Guaranteed-winnable deals via built-in solver           |
| FreeCell  | Drag, click-to-act | 4 free cells, near-100% solvable random deals           |
| Spider    | Drag, click-to-act | 1-suit (8 sequences of Spades), stock deals 10 at once  |
| TriPeaks  | Click only         | Chain consecutive ranks (A↔K wraps) for bonus points    |
| Pyramid   | Click only         | Pair cards summing to 13; 3 stock recycles              |
| Hearts    | Click only         | Trick-taking against 3 AI opponents; avoid hearts + Q♠  |

## Shared base

The frontend lives entirely under `src/`. A `src/shared/` directory provides the reusable infrastructure used by every variant:

- `deck.ts`        — suits, ranks, glyphs, deck builder
- `Card.tsx`       — Solid card component + SVG face-card art
- `drag.ts`        — pointer-capture-based drag/drop manager (used by drag-based games)
- `Modal.tsx`      — Vista-style dialog
- `menu.ts`        — Tauri menu listener + dispatch
- `hotkeys.ts`     — `F2`, `Ctrl/Cmd+Z`, `H`, `Ctrl/Cmd+A` mapping + Escape/Enter modal handling
- `stats.ts`       — per-game localStorage stats
- `Status.tsx`     — status-bar (score / time / moves)
- `Overlay.tsx`    — "dealing…" overlay
- `styles.css`     — shared Vista board / card / modal / status styling
- `utils.ts`       — `formatTime`, `cssVarPx`, `shuffle`, `clone`

Each variant directory (`src/<game>/`) contains only the game-specific bits:

- `game.ts`  — rules engine (state, moves, win, undo, hint, auto-complete)
- `solver.ts` — *Klondike only*, used for winnable-deal verification
- `ai.ts` — *Hearts only*, passing + play heuristics for the bots
- `main.tsx` — wires rendering, drag/click, dialogs and menu to the engine
- `index.html`, `styles.css` — board layout overrides

The native menu (Game / Edit / View / Help) is defined once in `src-tauri/src/lib.rs` and emits a generic `menu` event; each variant decides how to handle the action (or whether to ignore it).

## Prerequisites

- Node.js 20+
- Rust toolchain (stable)
- Tauri platform prerequisites — see <https://tauri.app/start/prerequisites/>

## Running a variant locally

Desktop (Tauri shell):

```bash
npm install

npm run tauri:dev               # default = Klondike
npm run tauri:dev:freecell
npm run tauri:dev:spider
npm run tauri:dev:tripeaks
npm run tauri:dev:pyramid
npm run tauri:dev:hearts
```

Browser only (Vite dev server, opens at `localhost:1420`):

```bash
npm run dev
# then open /klondike/, /freecell/, /spider/, /tripeaks/,
#                /pyramid/, /hearts/ or just / for the landing page.
```

## Building executables

```bash
npm run tauri:build               # Klondike
npm run tauri:build:freecell
npm run tauri:build:spider
npm run tauri:build:tripeaks
npm run tauri:build:pyramid
npm run tauri:build:hearts
```

Each command writes to `src-tauri/target/release/bundle/`:

- macOS: `bundle/dmg/<Variant>_*.dmg`
- Windows: `bundle/nsis/<Variant>_*-setup.exe`
- Linux: `bundle/deb/*.deb`, `bundle/appimage/*.AppImage`

## Building the web bundle

```bash
npm run build
```

Writes a static site to `dist/` — open `dist/index.html` for the
landing page, or any `dist/<game>/index.html` directly.

## Icons

The icon set under `src-tauri/icons/<game>/` is generated from
`scripts/make_icons.py`. The script renders Vista-style felt-and-cards
artwork into 32×32 / 128×128 / 256×256 PNGs plus multi-size `.ico` and
`.icns` bundles. Re-run after editing the script:

```bash
python3 scripts/make_icons.py
```

## CI

`.github/workflows/build.yml` runs three pipelines:

1. **Build** — a **(platform × variant)** matrix produces a `.dmg`
   for macOS (universal) and an `.exe` for Windows for each of the
   six games (12 parallel jobs). Artifacts are uploaded individually.
2. **Web bundle** — a single job runs `npm run build` and uploads the
   `dist/` tree as the `solitaire-web` artifact; on `main` it also
   publishes to GitHub Pages.
3. **Release** — on a `v*` tag push, every desktop artifact is
   attached to the matching GitHub Release.
