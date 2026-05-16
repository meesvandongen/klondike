/* ---------- TriPeaks main wiring ---------- */
(function () {
  const T = window.TriPeaks;
  const U = window.SolUtils;
  const Card = window.Card;
  const Modal = window.Modal;
  const Stats = window.Stats;
  const Status = window.Status;
  const MenuBridge = window.MenuBridge;
  const Hotkeys = window.Hotkeys;

  const GAME_ID = "tripeaks";
  const ROW_Y = 34; // vertical distance between rows in px (cards heavily overlap)
  let state = T.newState();
  let timerHandle = null;

  /* ---- Render ---- */

  function clearChildren(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function render() {
    const cardW = U.cssVarPx("--card-w");
    const halfW = cardW / 2;

    const peaksArea = document.getElementById("peaks-area");
    clearChildren(peaksArea);
    for (let i = 0; i < state.tableau.length; i++) {
      const card = state.tableau[i];
      if (card.removed) continue;
      const lay = T.LAYOUT[i];
      const avail = T.isAvailable(state, i);
      // Face up only when available (or in the bottom row, which is always face-up).
      const showCard = { ...card, faceUp: avail || lay.row === 3 };
      const el = Card.createCardElement(showCard);
      el.classList.add("peak-card");
      el.style.left = `${lay.x * halfW}px`;
      el.style.top = `${lay.row * ROW_Y}px`;
      el.dataset.pile = "tableau";
      el.dataset.index = i;
      if (avail) {
        el.dataset.movable = "1";
        const wasteTop = state.waste[state.waste.length - 1];
        if (wasteTop && T.canRemove(showCard, wasteTop)) {
          el.dataset.removable = "1";
        }
      }
      peaksArea.appendChild(el);
    }

    // Stock
    const stockEl = document.getElementById("stock");
    clearChildren(stockEl);
    if (state.stock.length > 0) {
      const c = state.stock[state.stock.length - 1];
      const el = Card.createCardElement({ ...c, faceUp: false });
      el.style.left = "0"; el.style.top = "0";
      el.dataset.pile = "stock";
      stockEl.appendChild(el);
    }

    // Waste
    const wasteEl = document.getElementById("waste");
    clearChildren(wasteEl);
    const wasteTop = state.waste[state.waste.length - 1];
    if (wasteTop) {
      const el = Card.createCardElement(wasteTop);
      el.style.left = "0"; el.style.top = "0";
      el.dataset.pile = "waste";
      wasteEl.appendChild(el);
    }

    refreshStatus();
  }

  function refreshStatus() {
    Status.update({
      score: state.score, moves: state.moves,
      startedAt: state.startedAt, finishedAt: state.finishedAt
    });
  }

  /* ---- Interaction (click only) ---- */

  function onPointerDown(e) {
    if (state.finishedAt) return;
    if (e.button !== undefined && e.button !== 0) return;

    const stockSlot = e.target.closest("#stock");
    if (stockSlot) {
      if (T.dealFromStock(state)) { render(); maybeEndCheck(); }
      return;
    }
    const cardEl = e.target.closest(".card");
    if (!cardEl) return;
    if (cardEl.dataset.pile !== "tableau") return;
    if (!cardEl.dataset.movable) return;
    const idx = parseInt(cardEl.dataset.index, 10);
    if (T.removeTableau(state, idx)) {
      render();
      maybeEndCheck();
    }
  }

  /* ---- Win / end check ---- */

  function noMovesLeft() {
    if (state.stock.length > 0) return false;
    const wasteTop = state.waste[state.waste.length - 1];
    if (!wasteTop) return true;
    for (let i = 0; i < state.tableau.length; i++) {
      if (T.isAvailable(state, i) && T.canRemove(state.tableau[i], wasteTop)) return false;
    }
    return true;
  }

  function maybeEndCheck() {
    if (state.finishedAt) return;
    if (T.isWon(state)) {
      state.finishedAt = Date.now();
      stopTimer();
      const timeSec = Math.floor((state.finishedAt - state.startedAt) / 1000);
      // Bonus for clearing
      state.score += 1000;
      render();
      Stats.record(GAME_ID, { won: true, timeSec, score: state.score });
      Modal.show({
        title: "You Win!",
        html: `<p style="margin:0 0 10px 0">You cleared all three peaks!</p>
               <table>
                 <tr><td>Score</td><td>${state.score}</td></tr>
                 <tr><td>Time</td><td>${U.formatTime(timeSec)}</td></tr>
                 <tr><td>Moves</td><td>${state.moves}</td></tr>
               </table>`,
        buttons: [
          { label: "New Game", primary: true, onClick: () => { Modal.close(); MenuBridge.fire("new-game"); } },
          { label: "Close", onClick: Modal.close }
        ]
      });
    } else if (noMovesLeft()) {
      state.finishedAt = Date.now();
      stopTimer();
      const timeSec = Math.floor((state.finishedAt - state.startedAt) / 1000);
      const remaining = T.tableauRemaining(state);
      Stats.record(GAME_ID, { won: false, score: state.score });
      Modal.show({
        title: "No more moves",
        html: `<p style="margin:0 0 10px 0">${remaining} cards remained.</p>
               <table>
                 <tr><td>Score</td><td>${state.score}</td></tr>
                 <tr><td>Time</td><td>${U.formatTime(timeSec)}</td></tr>
                 <tr><td>Moves</td><td>${state.moves}</td></tr>
               </table>`,
        buttons: [
          { label: "New Game", primary: true, onClick: () => { Modal.close(); MenuBridge.fire("new-game"); } },
          { label: "Close", onClick: Modal.close }
        ]
      });
    }
  }

  /* ---- Hint ---- */
  function showHint() {
    const h = T.hint(state);
    if (!h) return;
    const cardEl = document.querySelector(`.card[data-pile="tableau"][data-index="${h.tableauIndex}"]`);
    if (cardEl) {
      cardEl.classList.add("hint-flash");
      setTimeout(() => cardEl.classList.remove("hint-flash"), 1300);
    }
  }

  /* ---- New game / timer ---- */
  function newGame() {
    if (state && !state.finishedAt && state.moves > 0) {
      Stats.record(GAME_ID, { won: false, score: state.score });
    }
    state = T.newState();
    render();
    startTimer();
  }
  function startTimer() { stopTimer(); timerHandle = setInterval(refreshStatus, 1000); }
  function stopTimer() { if (timerHandle) clearInterval(timerHandle); timerHandle = null; }

  /* ---- Dialogs ---- */
  function openStats() {
    const s = Stats.load(GAME_ID);
    const winPct = s.gamesPlayed ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0;
    const best = s.bestTimeSec == null ? "—" : U.formatTime(s.bestTimeSec);
    Modal.show({
      title: "Statistics",
      html: `<table>
        <tr><td>Games played</td><td>${s.gamesPlayed}</td></tr>
        <tr><td>Games won</td><td>${s.gamesWon}</td></tr>
        <tr><td>Win percentage</td><td>${winPct}%</td></tr>
        <tr><td>Best time</td><td>${best}</td></tr>
        <tr><td>Best score</td><td>${s.bestScore}</td></tr>
      </table>`,
      buttons: [
        { label: "Reset", onClick: () => { Stats.reset(GAME_ID); Modal.close(); } },
        { label: "OK", primary: true, onClick: Modal.close }
      ]
    });
  }
  function openOptions() {
    Modal.show({
      title: "Options",
      html: `<p style="margin:0;">TriPeaks has no configurable options at this time.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }
  function showAbout() {
    Modal.show({
      title: "About TriPeaks",
      html: `<p style="margin:0 0 6px 0;"><strong>TriPeaks</strong></p>
             <p style="margin:0 0 10px 0;">Version 1.0.0</p>
             <p style="margin:0;">Clear three peaks by removing cards in chain.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }
  function howToPlay() {
    Modal.show({
      title: "How to Play",
      html: `<p style="margin:0 0 8px 0;">Remove tableau cards by clicking them. A card can be removed if it is one rank higher or lower than the top of the waste pile (A wraps to K).</p>
             <p style="margin:0 0 8px 0;">A tableau card is only available once no other cards rest on top of it.</p>
             <p style="margin:0 0 8px 0;">Click the stock to deal a new card to the waste when no playable card remains.</p>
             <p style="margin:0;">Chain consecutive moves without using the stock to score more points.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }

  /* ---- Boot ---- */
  document.addEventListener("DOMContentLoaded", () => {
    Modal.init();
    MenuBridge.registerMany({
      "new-game": newGame,
      "restart": newGame,
      "undo": () => { if (T.undo(state)) render(); },
      "hint": showHint,
      "stats": openStats,
      "options": openOptions,
      "about": showAbout,
      "how-to-play": howToPlay
    });
    MenuBridge.wire();

    Hotkeys.bind({
      "F2": "new-game",
      "ctrl+z": "undo",
      "h": "hint"
    });

    document.getElementById("board").addEventListener("pointerdown", onPointerDown);

    render();
    startTimer();
  });
})();
