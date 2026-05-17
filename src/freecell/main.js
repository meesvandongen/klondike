/* ---------- FreeCell main wiring ---------- */
(function () {
  const F = window.FreeCell;
  const U = window.SolUtils;
  const Card = window.Card;
  const Modal = window.Modal;
  const Stats = window.Stats;
  const Overlay = window.Overlay;
  const Status = window.Status;
  const MenuBridge = window.MenuBridge;
  const Hotkeys = window.Hotkeys;
  const DragManager = window.DragManager;

  const GAME_ID = "freecell";
  const OPTION_DEFAULTS = { autoComplete: true, zoom: 1 };

  let opts = window.Options.load(GAME_ID, OPTION_DEFAULTS);
  let autoComplete = opts.autoComplete;
  let state = F.newState();
  let timerHandle = null;
  let autoPlayActive = false;
  let dragMgr = null;

  function persistOptions() {
    window.Options.save(GAME_ID, { autoComplete, zoom: opts.zoom });
  }
  function syncAutoCompleteMenu(enabled) {
    MenuBridge.invoke("sync_auto_complete", { enabled });
  }

  /* ---- Render ---- */

  function pileEl(pile, idx) {
    return document.querySelector(`.pile-slot[data-pile="${pile}"][data-index="${idx}"]`);
  }
  function clearChildren(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function isSkipped(skipIds, card) { return skipIds && skipIds.has(card.id); }

  function render(skipIds) {
    skipIds = skipIds || new Set();
    const fanUp = U.cssVarPx("--tableau-fan-up");

    // Cells
    for (let i = 0; i < 4; i++) {
      const slot = pileEl("cell", i);
      clearChildren(slot);
      const card = state.cells[i];
      if (card && !isSkipped(skipIds, card)) {
        const el = Card.createCardElement(card);
        el.style.left = "0"; el.style.top = "0";
        el.dataset.pile = "cell";
        el.dataset.pileIndex = i;
        el.dataset.cardIndex = 0;
        el.dataset.movable = "1";
        slot.appendChild(el);
      }
    }

    // Foundations
    for (let f = 0; f < 4; f++) {
      const slot = pileEl("foundation", f);
      clearChildren(slot);
      const p = state.foundations[f];
      let topIdx = -1;
      for (let i = p.length - 1; i >= 0; i--) {
        if (!isSkipped(skipIds, p[i])) { topIdx = i; break; }
      }
      if (topIdx >= 0) {
        const el = Card.createCardElement(p[topIdx]);
        el.style.left = "0"; el.style.top = "0";
        el.dataset.pile = "foundation";
        el.dataset.pileIndex = f;
        el.dataset.cardIndex = topIdx;
        el.dataset.movable = "1";
        slot.appendChild(el);
      }
    }

    // Tableau
    for (let t = 0; t < 8; t++) {
      const slot = pileEl("tableau", t);
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
        el.dataset.movable = "1"; // all face-up in FreeCell
        slot.appendChild(el);
        offset += fanUp;
      }
    }

    refreshStatus();
  }

  function refreshStatus() {
    Status.update({
      score: state.score, moves: state.moves,
      startedAt: state.startedAt, finishedAt: state.finishedAt
    });
  }

  /* ---- Drag callbacks ---- */

  function getPickup(e, cardEl) {
    if (state.finishedAt) return null;
    if (!cardEl) return null;
    const pile = cardEl.dataset.pile;
    if (!cardEl.dataset.movable) return null;
    const pileIndex = parseInt(cardEl.dataset.pileIndex || "0", 10);
    const cardIndex = parseInt(cardEl.dataset.cardIndex || "0", 10);

    let cards;
    if (pile === "tableau") {
      cards = state.tableau[pileIndex].slice(cardIndex);
      if (cards.length > 1 && !F.isValidSequence(cards)) return null;
    } else if (pile === "cell") {
      const c = state.cells[pileIndex];
      cards = c ? [c] : [];
    } else if (pile === "foundation") {
      const p = state.foundations[pileIndex];
      cards = p.length ? [p[p.length - 1]] : [];
    } else return null;

    if (!cards.length) return null;
    return { cards, src: { pile, index: pileIndex, cardIndex } };
  }

  function tryDrop(src, dropEl) {
    const pile = dropEl.dataset.pile;
    const index = parseInt(dropEl.dataset.index || "0", 10);
    return F.move(state, src, { pile, index });
  }

  function tryAutoMove(src) { return F.autoMove(state, src); }

  /* ---- Win + Auto-complete + Hint ---- */

  function maybeWinCheck() {
    if (!F.isWon(state) || state.finishedAt) return;
    state.finishedAt = Date.now();
    stopTimer();
    const timeSec = Math.floor((state.finishedAt - state.startedAt) / 1000);
    Stats.record(GAME_ID, { won: true, timeSec, score: state.score });
    Modal.show({
      title: "You Win!",
      html: `<p style="margin:0 0 10px 0">You finished the deal.</p>
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

  function runAutoPlay() {
    if (autoPlayActive) return;
    if (!autoComplete) { maybeWinCheck(); return; }
    autoPlayActive = true;
    const tick = () => {
      if (!autoComplete || state.finishedAt) {
        autoPlayActive = false;
        maybeWinCheck();
        return;
      }
      const moved = F.safeAutoStep(state);
      if (moved) {
        render(new Set());
        setTimeout(tick, 80);
      } else {
        autoPlayActive = false;
        maybeWinCheck();
      }
    };
    tick();
  }

  function setAutoComplete(enabled, syncMenu) {
    autoComplete = enabled;
    persistOptions();
    if (syncMenu) syncAutoCompleteMenu(enabled);
    if (enabled) runAutoPlay();
  }

  function handleAutoCompleteAction(payload) {
    if (payload && typeof payload.checked === "boolean") {
      setAutoComplete(payload.checked, false);
    } else {
      setAutoComplete(!autoComplete, true);
    }
  }

  function showHint() {
    const h = F.hint(state);
    if (!h) return;
    let pile;
    if (h.src.pile === "tableau") pile = state.tableau[h.src.index];
    else if (h.src.pile === "cell") pile = state.cells[h.src.index] ? [state.cells[h.src.index]] : [];
    else pile = state.foundations[h.src.index];
    if (!pile.length) return;
    const cardId = pile[h.src.cardIndex].id;
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
    state = F.newState();
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
      html: `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <label><input type="checkbox" id="opt-autocomplete" ${autoComplete ? "checked" : ""}/> Auto-play cards to foundation</label>
        </div>
      `,
      buttons: [
        {
          label: "OK", primary: true,
          onClick: () => {
            const acEl = document.getElementById("opt-autocomplete");
            const newAuto = acEl ? acEl.checked : autoComplete;
            Modal.close();
            if (newAuto !== autoComplete) setAutoComplete(newAuto, true);
          }
        },
        { label: "Cancel", onClick: Modal.close }
      ]
    });
  }

  function showAbout() {
    Modal.show({
      title: "About FreeCell",
      html: `<p style="margin:0 0 6px 0;"><strong>FreeCell</strong></p>
             <p style="margin:0 0 10px 0;">Version 1.0.0</p>
             <p style="margin:0;">A classic single-player card game; almost every deal is solvable.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }
  function howToPlay() {
    Modal.show({
      title: "How to Play",
      html: `<p style="margin:0 0 8px 0;">Build four foundations up by suit from Ace to King.</p>
             <p style="margin:0 0 8px 0;">In the cascades, stack cards in alternating colours, descending in rank.</p>
             <p style="margin:0 0 8px 0;">Four free cells each hold a single card to help with manoeuvring.</p>
             <p style="margin:0;">Multi-card moves are allowed if enough free cells and empty cascades are available.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }

  /* ---- Boot ---- */

  document.addEventListener("DOMContentLoaded", () => {
    Modal.init();
    MenuBridge.registerMany({
      "new-game": newGame,
      "restart": newGame,
      "undo": () => { if (F.undo(state)) render(new Set()); },
      "hint": showHint,
      "auto-complete": handleAutoCompleteAction,
      "stats": openStats,
      "options": openOptions,
      "about": showAbout,
      "how-to-play": howToPlay
    });
    window.Zoom.install({
      initial: opts.zoom,
      onChange: (z) => { opts.zoom = z; persistOptions(); render(new Set()); }
    });

    MenuBridge.wire();
    syncAutoCompleteMenu(autoComplete);

    Hotkeys.bind({
      "F2": "new-game",
      "ctrl+z": "undo",
      "ctrl+a": "auto-complete",
      "h": "hint",
      "ctrl+=": "zoom-in",
      "ctrl+shift++": "zoom-in",
      "ctrl+-": "zoom-out",
      "ctrl+0": "zoom-reset"
    });

    dragMgr = DragManager.create({
      boardEl: document.getElementById("board"),
      dragLayerEl: document.getElementById("drag-layer"),
      fanY: U.cssVarPx("--tableau-fan-up"),
      isLocked: () => !!state.finishedAt,
      getPickup, tryDrop, tryAutoMove,
      render,
      onAfter: runAutoPlay
    });
    dragMgr.attach();

    render(new Set());
    startTimer();
  });
})();
