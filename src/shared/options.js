/* ---------- Shared per-game option persistence ---------- */
(function () {
  function key(gameId) {
    return `solitaire.${gameId}.options`;
  }

  function load(gameId, defaults) {
    try {
      const raw = localStorage.getItem(key(gameId));
      if (!raw) return { ...defaults };
      return { ...defaults, ...JSON.parse(raw) };
    } catch (_) {
      return { ...defaults };
    }
  }

  function save(gameId, opts) {
    try {
      localStorage.setItem(key(gameId), JSON.stringify(opts));
    } catch (_) {}
  }

  window.Options = { load, save };
})();
