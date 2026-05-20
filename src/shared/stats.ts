export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  bestTimeSec: number | null;
  bestScore: number;
}

export interface GameResult {
  won: boolean;
  timeSec?: number;
  score?: number;
}

function keyFor(gameId: string): string {
  return `solitaire.${gameId}.stats`;
}

export function load(gameId: string): GameStats {
  try {
    const raw = localStorage.getItem(keyFor(gameId));
    if (!raw) throw new Error("no stats");
    return JSON.parse(raw) as GameStats;
  } catch (_) {
    return { gamesPlayed: 0, gamesWon: 0, bestTimeSec: null, bestScore: 0 };
  }
}

export function save(gameId: string, s: GameStats): void {
  try {
    localStorage.setItem(keyFor(gameId), JSON.stringify(s));
  } catch (_) {
    /* ignore */
  }
}

export function reset(gameId: string): void {
  try {
    localStorage.removeItem(keyFor(gameId));
  } catch (_) {
    /* ignore */
  }
}

export function record(gameId: string, result: GameResult): GameStats {
  const s = load(gameId);
  s.gamesPlayed += 1;
  if (result.won) {
    s.gamesWon += 1;
    if (typeof result.timeSec === "number") {
      if (s.bestTimeSec === null || result.timeSec < s.bestTimeSec) {
        s.bestTimeSec = result.timeSec;
      }
    }
    if (typeof result.score === "number" && result.score > s.bestScore) {
      s.bestScore = result.score;
    }
  }
  save(gameId, s);
  return s;
}
