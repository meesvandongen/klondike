import { register } from "./menu";

const MIN = 0.5;
const MAX = 2.0;
const STEP = 0.1;

/** Base CSS variable values (must mirror :root in shared/styles.css). */
const BASE: Record<string, number> = {
  "--card-w": 96,
  "--card-h": 134,
  "--card-radius": 7,
  "--card-top-h": 40,
  "--corner-w": 20,
  "--tableau-fan-up": 40,
  "--tableau-fan-down": 13,
  "--pile-gap": 18,
  "--corner-rank-size": 18,
  "--corner-suit-size": 18,
  "--peaks-row-y": 34,
  "--pyramid-row-y": 38,
  "--pyramid-col-gap": 6,
};

function clampLevel(level: number): number {
  return Math.max(MIN, Math.min(MAX, Math.round(level * 100) / 100));
}

function apply(level: number): number {
  const z = clampLevel(level);
  const root = document.documentElement;
  for (const [name, base] of Object.entries(BASE)) {
    root.style.setProperty(name, `${base * z}px`);
  }
  root.dataset.zoom = String(z);
  return z;
}

/**
 * Apply zoom-derived CSS variables to <html> synchronously, before any
 * Solid render. On Safari/WebKit (incl. Tauri's WKWebView on macOS) the
 * module script can run before the linked stylesheet has finished
 * parsing, so a render-time `getComputedStyle().getPropertyValue("--…")`
 * returns "" and reactive memos resolve fan offsets to 0 — making all
 * cards stack at the same position. Setting the variables as inline
 * styles on documentElement bypasses the stylesheet entirely, so
 * cssVarPx reads correct values from the first render onward.
 *
 * Call this in each game's main.tsx at module top level (after loading
 * persisted options, before `render(...)`).
 */
export function applyInitial(level: number): number {
  return apply(level);
}

export interface ZoomController {
  get: () => number;
  set: (next: number) => void;
}

export function install(opts: { initial?: number; onChange?: (z: number) => void } = {}): ZoomController {
  let level = apply(opts.initial ?? 1);

  function set(next: number): void {
    const z = clampLevel(next);
    if (z === level) return;
    level = apply(z);
    if (opts.onChange) opts.onChange(level);
  }

  register("zoom-in", () => set(level + STEP));
  register("zoom-out", () => set(level - STEP));
  register("zoom-reset", () => set(1));

  return { get: () => level, set };
}

export { MIN, MAX, STEP };
