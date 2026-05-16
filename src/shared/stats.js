/* ---------- Shared per-game stats persistence ---------- */
(function () {
  function keyFor(gameId) {
    return `solitaire.${gameId}.stats`;
  }

  function load(gameId) {
    try {
      const raw = localStorage.getItem(keyFor(gameId));
      if (!raw) throw 0;
      return JSON.parse(raw);
    } catch (_) {
      return { gamesPlayed: 0, gamesWon: 0, bestTimeSec: null, bestScore: 0 };
    }
  }

  function save(gameId, s) {
    try {
      localStorage.setItem(keyFor(gameId), JSON.stringify(s));
    } catch (_) {}
  }

  function reset(gameId) {
    try {
      localStorage.removeItem(keyFor(gameId));
    } catch (_) {}
  }

  function record(gameId, result) {
    const s = load(gameId);
    s.gamesPlayed += 1;
    if (result.won) {
      s.gamesWon += 1;
      if (typeof result.timeSec === "number") {
        if (s.bestTimeSec === null || result.timeSec < s.bestTimeSec) s.bestTimeSec = result.timeSec;
      }
      if (typeof result.score === "number" && result.score > s.bestScore) {
        s.bestScore = result.score;
      }
    }
    save(gameId, s);
    return s;
  }

  window.Stats = { load, save, reset, record };
})();
