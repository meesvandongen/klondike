function key(gameId: string): string {
  return `solitaire.${gameId}.options`;
}

export function load<T extends object>(gameId: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(key(gameId));
    if (!raw) return { ...defaults };
    return { ...defaults, ...(JSON.parse(raw) as Partial<T>) };
  } catch (_) {
    return { ...defaults };
  }
}

export function save<T extends object>(gameId: string, opts: T): void {
  try {
    localStorage.setItem(key(gameId), JSON.stringify(opts));
  } catch (_) {
    /* ignore */
  }
}
