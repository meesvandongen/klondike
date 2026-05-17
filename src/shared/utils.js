/* ---------- Shared utilities ---------- */
(function () {
  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function cssVarPx(name) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return parseInt(v, 10) || 0;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  window.SolUtils = { formatTime, cssVarPx, shuffle, clone };
})();
