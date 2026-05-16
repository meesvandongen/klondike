/* ---------- Pyramid main wiring ---------- */
(function () {
  const P = window.Pyramid;
  const U = window.SolUtils;
  const Card = window.Card;
  const Modal = window.Modal;
  const Stats = window.Stats;
  const Status = window.Status;
  const MenuBridge = window.MenuBridge;
  const Hotkeys = window.Hotkeys;

  const GAME_ID = "pyramid";
  const ROW_Y = 38;
  const COL_X_GAP = 6;

  let state = P.newState();
  let timerHandle = null;
  let selected = null; // ref currently highlighted (pile + index)

  function refKey(r) { return `${r.pile}#${r.index}`; }

  /* ---- Render ---- */
  function clearChildren(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function render() {
    const cardW = U.cssVarPx("--card-w");
    const stepX = (cardW + COL_X_GAP) / 2;

    const area = document.getElementById("pyramid-area");
    clearChildren(area);

    for (let i = 0; i < state.pyramid.length; i++) {
      const card = state.pyramid[i];
      if (card.removed) continue;
      const { row, col } = P.rowColOf(i);
      const avail = P.isAvailable(state, i);
      const el = Card.createCardElement({ ...card, faceUp: true });
      el.classList.add("pyramid-card");
      // Center: bottom row spans 7 card-widths + 6 gaps. Each row shifts inward.
      // x = (7 - row - 1) * stepX/?... Use half-step formula:
      // bottom row card c at left = c * (cardW + gap)
      // row r card c at left = ((7 - r - 1) * (cardW + gap) / 2) + c * (cardW + gap)
      const rowOffset = ((6 - row) * (cardW + COL_X_GAP)) / 2;
      const left = rowOffset + col * (cardW + COL_X_GAP);
      el.style.left = `${left}px`;
      el.style.top = `${row * ROW_Y}px`;
      el.dataset.pile = "pyramid";
      el.dataset.index = i;
      if (avail) el.dataset.movable = "1";
      if (selected && selected.pile === "pyramid" && selected.index === i) {
        el.classList.add("selected");
      }
      area.appendChild(el);
    }

    // Stock
    const stockEl = document.getElementById("stock");
    clearChildren(stockEl);
    if (state.stock.length > 0) {
      const el = Card.createCardElement({ ...state.stock[state.stock.length - 1], faceUp: false });
      el.style.left = "0"; el.style.top = "0";
      el.dataset.pile = "stock";
      stockEl.appendChild(el);
    } else if (state.cycles < P.MAX_CYCLES) {
      // Empty but recyclable — show a translucent placeholder.
      // Leave slot empty; click on slot recycles.
    }

    // Waste
    const wasteEl = document.getElementById("waste");
    clearChildren(wasteEl);
    const wasteTop = state.waste[state.waste.length - 1];
    if (wasteTop) {
      const el = Card.createCardElement(wasteTop);
      el.style.left = "0"; el.style.top = "0";
      el.dataset.pile = "waste";
      el.dataset.index = 0;
      el.dataset.movable = "1";
      if (selected && selected.pile === "waste") el.classList.add("selected");
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

  /* ---- Interaction ---- */

  function onPointerDown(e) {
    if (state.finishedAt) return;
    if (e.button !== undefined && e.button !== 0) return;

    const stockSlot = e.target.closest("#stock");
    if (stockSlot) {
      selected = null;
      P.dealFromStock(state);
      render();
      maybeEndCheck();
      return;
    }

    const cardEl = e.target.closest(".card");
    if (!cardEl) return;
    if (!cardEl.dataset.movable) return;

    const ref = {
      pile: cardEl.dataset.pile,
      index: parseInt(cardEl.dataset.index || "0", 10)
    };
    const card = P.refCard(state, ref);
    if (!card) return;

    // Click an available K alone removes it.
    if (card.rank === "K") {
      if (P.removeKing(state, ref)) {
        selected = null;
        render();
        maybeEndCheck();
      }
      return;
    }

    if (!selected) {
      selected = ref;
      render();
      return;
    }
    if (refKey(selected) === refKey(ref)) {
      // Click the selected card again to deselect.
      selected = null;
      render();
      return;
    }
    // Try pair.
    const moved = P.removePair(state, selected, ref);
    selected = null;
    if (moved) {
      render();
      maybeEndCheck();
    } else {
      // Treat the second click as the new selection.
      selected = ref;
      render();
    }
  }

  /* ---- End detection ---- */
  function maybeEndCheck() {
    if (state.finishedAt) return;
    if (P.isWon(state)) {
      state.finishedAt = Date.now();
      stopTimer();
      const timeSec = Math.floor((state.finishedAt - state.startedAt) / 1000);
      state.score += 100;
      render();
      Stats.record(GAME_ID, { won: true, timeSec, score: state.score });
      Modal.show({
        title: "You Win!",
        html: `<p style="margin:0 0 10px 0">Pyramid cleared!</p>
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
    } else if (P.noMovesLeft(state)) {
      state.finishedAt = Date.now();
      stopTimer();
      const timeSec = Math.floor((state.finishedAt - state.startedAt) / 1000);
      const remaining = P.pyramidRemaining(state);
      Stats.record(GAME_ID, { won: false, score: state.score });
      Modal.show({
        title: "No more moves",
        html: `<p style="margin:0 0 10px 0">${remaining} pyramid cards remained.</p>
               <table>
                 <tr><td>Score</td><td>${state.score}</td></tr>
                 <tr><td>Time</td><td>${U.formatTime(timeSec)}</td></tr>
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
    const h = P.hint(state);
    if (!h) return;
    for (const r of h.refs) {
      const el = document.querySelector(`.card[data-pile="${r.pile}"][data-index="${r.index}"]`);
      if (el) {
        el.classList.add("hint-flash");
        setTimeout(() => el.classList.remove("hint-flash"), 1300);
      }
    }
  }

  /* ---- New game / timer ---- */
  function newGame() {
    if (state && !state.finishedAt && state.moves > 0) {
      Stats.record(GAME_ID, { won: false, score: state.score });
    }
    state = P.newState();
    selected = null;
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
      html: `<p style="margin:0;">Stock recycles allowed: <strong>${P.MAX_CYCLES}</strong>.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }
  function showAbout() {
    Modal.show({
      title: "About Pyramid",
      html: `<p style="margin:0 0 6px 0;"><strong>Pyramid</strong></p>
             <p style="margin:0 0 10px 0;">Version 1.0.0</p>
             <p style="margin:0;">Clear the pyramid by pairing cards that sum to 13.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }
  function howToPlay() {
    Modal.show({
      title: "How to Play",
      html: `<p style="margin:0 0 8px 0;">Pair two available cards whose ranks sum to 13 to remove them.</p>
             <p style="margin:0 0 8px 0;">A = 1, J = 11, Q = 12, K = 13 (Kings remove alone).</p>
             <p style="margin:0 0 8px 0;">A pyramid card is available once both cards covering it from below have been removed.</p>
             <p style="margin:0;">The stock deals one card to the waste; the waste top can also be paired. ${P.MAX_CYCLES} stock cycles are allowed.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }

  /* ---- Boot ---- */
  document.addEventListener("DOMContentLoaded", () => {
    Modal.init();
    MenuBridge.registerMany({
      "new-game": newGame,
      "restart": newGame,
      "undo": () => { selected = null; if (P.undo(state)) render(); },
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
