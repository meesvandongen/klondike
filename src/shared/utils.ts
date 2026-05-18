export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function cssVarPx(name: string): number {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return parseInt(v, 10) || 0;
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
