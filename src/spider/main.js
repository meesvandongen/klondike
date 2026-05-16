/* ---------- Spider main wiring ---------- */
(function () {
  const S = window.Spider;
  const U = window.SolUtils;
  const Card = window.Card;
  const Modal = window.Modal;
  const Stats = window.Stats;
  const Overlay = window.Overlay;
  const Status = window.Status;
  const MenuBridge = window.MenuBridge;
  const Hotkeys = window.Hotkeys;
  const DragManager = window.DragManager;

  const GAME_ID = "spider";
  let state = S.newState();
  let timerHandle = null;
  let dragMgr = null;

  /* ---- Render ---- */
  function tableauEl(idx) {
    return document.querySelector(`.pile-slot[data-pile="tableau"][data-index="${idx}"]`);
  }
  function clearChildren(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function isSkipped(skipIds, c) { return skipIds && skipIds.has(c.id); }

  function render(skipIds) {
    skipIds = skipIds || new Set();
    const fanUp = U.cssVarPx("--tableau-fan-up");
    const fanDown = U.cssVarPx("--tableau-fan-down");

    for (let t = 0; t < 10; t++) {
      const slot = tableauEl(t);
      clearChildren(slot);
      const p = state.tableau[t];
      let offset = 0;
      for (let i = 0; i < p.length; i++) {
        const c = p[i];
        if (isSkipped(skipIds, c)) break;
        const el = Card.createCardElement(c);
        el.style.left = "0";
        el.style.top = `${offset}px`;
        el.dataset.pile = "tableau";
        el.dataset.pileIndex = t;
        el.dataset.cardIndex = i;
        if (c.faceUp) el.dataset.movable = "1";
        slot.appendChild(el);
        offset += c.faceUp ? fanUp : fanDown;
      }
    }

    // Stock — show a "fan" of face-down cards indicating remaining deals.
    const stockEl = document.getElementById("stock");
    clearChildren(stockEl);
    const dealsLeft = Math.floor(state.stock.length / 10);
    for (let i = 0; i < dealsLeft; i++) {
      const el = Card.createCardElement({ id: `stock-${i}`, rank: "A", suit: "S", faceUp: false });
      el.style.left = `${i * 3}px`;
      el.style.top = `${i * -2}px`;
      el.dataset.pile = "stock";
      stockEl.appendChild(el);
    }

    document.querySelector(".completed-count").textContent = `${state.completed}/8 completed`;
    refreshStatus();
  }

  function refreshStatus() {
    Status.update({
      score: state.score, moves: state.moves,
      startedAt: state.startedAt, finishedAt: state.finishedAt
    });
  }

  /* ---- Drag ---- */
  function getPickup(e, cardEl) {
    if (state.finishedAt) return null;

    const stockEl = e.target.closest("#stock");
    if (stockEl) {
      return { cards: [], click: () => {
        if (S.dealFromStock(state)) { render(new Set()); maybeWinCheck(); }
        else if (state.tableau.some((c) => c.length === 0)) {
          Modal.show({
            title: "Cannot Deal",
            html: `<p style="margin:0;">All columns must contain at least one card before dealing.</p>`,
            buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
          });
        }
      }};
    }
    if (!cardEl) return null;
    if (!cardEl.dataset.movable) return null;
    const pileIndex = parseInt(cardEl.dataset.pileIndex || "0", 10);
    const cardIndex = parseInt(cardEl.dataset.cardIndex || "0", 10);
    const cards = state.tableau[pileIndex].slice(cardIndex);
    if (!cards.length || !S.isMovableRun(cards)) return null;
    return { cards, src: { pile: "tableau", index: pileIndex, cardIndex } };
  }

  function tryDrop(src, dropEl) {
    const pile = dropEl.dataset.pile;
    if (pile !== "tableau") return false;
    const index = parseInt(dropEl.dataset.index || "0", 10);
    return S.move(state, src, { pile: "tableau", index });
  }

  function tryAutoMove(src) { return S.autoMove(state, src); }

  /* ---- Win + hint ---- */
  function maybeWinCheck() {
    if (!S.isWon(state) || state.finishedAt) return;
    state.finishedAt = Date.now();
    stopTimer();
    const timeSec = Math.floor((state.finishedAt - state.startedAt) / 1000);
    Stats.record(GAME_ID, { won: true, timeSec, score: state.score });
    Modal.show({
      title: "You Win!",
      html: `<p style="margin:0 0 10px 0">All eight sequences completed.</p>
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

  function showHint() {
    const h = S.hint(state);
    if (!h) return;
    const cardId = state.tableau[h.src.index][h.src.cardIndex].id;
    const el = document.querySelector(`.card[data-card-id="${CSS.escape(cardId)}"]`);
    if (el) {
      el.classList.add("hint-flash");
      setTimeout(() => el.classList.remove("hint-flash"), 1300);
    }
  }

  /* ---- New game ---- */
  function newGame() {
    if (state && !state.finishedAt && state.moves > 0) {
      Stats.record(GAME_ID, { won: false });
    }
    if (dragMgr) dragMgr.abort();
    state = S.newState();
    render(new Set());
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
      html: `<p style="margin:0;">Spider is running in 1-suit mode (Spades only). Future versions will offer 2- and 4-suit difficulty.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }
  function showAbout() {
    Modal.show({
      title: "About Spider",
      html: `<p style="margin:0 0 6px 0;"><strong>Spider</strong> (1-suit)</p>
             <p style="margin:0 0 10px 0;">Version 1.0.0</p>
             <p style="margin:0;">Build eight K-to-A sequences to clear the board.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }
  function howToPlay() {
    Modal.show({
      title: "How to Play",
      html: `<p style="margin:0 0 8px 0;">Form descending runs in the tableau. A complete K-to-A run in the same suit is removed automatically.</p>
             <p style="margin:0 0 8px 0;">Move single cards or any descending same-suit run.</p>
             <p style="margin:0 0 8px 0;">Click the stock to deal one card to each column. All columns must be non-empty to deal.</p>
             <p style="margin:0;">Clear all eight sequences to win.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }

  /* ---- Boot ---- */
  document.addEventListener("DOMContentLoaded", () => {
    Modal.init();
    MenuBridge.registerMany({
      "new-game": newGame,
      "restart": newGame,
      "undo": () => { if (S.undo(state)) render(new Set()); },
      "hint": showHint,
      "auto-complete": () => {}, // no-op for Spider
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

    dragMgr = DragManager.create({
      boardEl: document.getElementById("board"),
      dragLayerEl: document.getElementById("drag-layer"),
      fanY: U.cssVarPx("--tableau-fan-up"),
      isLocked: () => !!state.finishedAt,
      getPickup, tryDrop, tryAutoMove,
      render,
      onAfter: maybeWinCheck
    });
    dragMgr.attach();

    render(new Set());
    startTimer();
  });
})();
