export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Base px values for CSS variables defined in :root in shared/styles.css.
 * Used as fallbacks when getComputedStyle returns "" — which happens on
 * Safari/WebKit when a deferred module script runs before the linked
 * stylesheet has finished parsing. Without this, fan offsets would
 * resolve to 0 and cards would stack on top of each other.
 */
const CSS_VAR_BASE: Record<string, number> = {
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

export function cssVarPx(name: string): number {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const n = parseFloat(v);
  if (Number.isFinite(n) && n > 0) return n;
  return CSS_VAR_BASE[name] ?? 0;
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}
