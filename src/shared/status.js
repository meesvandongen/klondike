/* ---------- Shared status bar ---------- */
(function () {
  const U = window.SolUtils;

  function update({ score, moves, startedAt, finishedAt }) {
    const scoreEl = document.getElementById("status-score");
    const movesEl = document.getElementById("status-moves");
    const timeEl = document.getElementById("status-time");
    if (scoreEl) scoreEl.textContent = `Score: ${score | 0}`;
    if (movesEl) movesEl.textContent = `Moves: ${moves | 0}`;
    if (timeEl) {
      const sec = finishedAt
        ? Math.floor((finishedAt - startedAt) / 1000)
        : Math.floor((Date.now() - startedAt) / 1000);
      timeEl.textContent = `Time: ${U.formatTime(sec)}`;
    }
  }

  window.Status = { update };
})();
