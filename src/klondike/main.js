/* ---------- Klondike main wiring ---------- */
(function () {
  const K = window.Klondike;
  const U = window.SolUtils;
  const D = window.Deck;
  const Card = window.Card;
  const Modal = window.Modal;
  const Stats = window.Stats;
  const Overlay = window.Overlay;
  const Status = window.Status;
  const MenuBridge = window.MenuBridge;
  const Hotkeys = window.Hotkeys;
  const DragManager = window.DragManager;

  const GAME_ID = "klondike";
  const OPTION_DEFAULTS = { drawMode: 1, autoComplete: true, zoom: 1 };

  let opts = window.Options.load(GAME_ID, OPTION_DEFAULTS);
  let drawMode = opts.drawMode;
  let autoComplete = opts.autoComplete;
  let state = K.newState({ draw: drawMode });

  let timerHandle = null;
  let dealingInFlight = false;
  let autoPlayActive = false;
  let dragMgr = null;

  function persistOptions() {
    window.Options.save(GAME_ID, { drawMode, autoComplete, zoom: opts.zoom });
  }

  function syncDrawModeMenu(mode) {
    MenuBridge.invoke("sync_draw_mode", { mode });
  }
  function syncAutoCompleteMenu(enabled) {
    MenuBridge.invoke("sync_auto_complete", { enabled });
  }

  /* ---- Rendering ---- */

  function pileById(name, idx) {
    if (name === "stock") return document.getElementById("stock");
    if (name === "waste") return document.getElementById("waste");
    if (name === "foundation") return document.getElementById(`foundation-${idx}`);
    if (name === "tableau") return document.querySelector(`.pile-slot[data-pile="tableau"][data-index="${idx}"]`);
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function isSkipped(skipIds, card) {
    return skipIds && skipIds.has(card.id);
  }

  function render(skipIds) {
    skipIds = skipIds || new Set();

    // Stock — always shows the top face-down card if any.
    const stockEl = pileById("stock");
    clearChildren(stockEl);
    if (state.stock.length > 0) {
      const el = Card.createCardElement({ ...state.stock[state.stock.length - 1], faceUp: false });
      el.style.left = "0"; el.style.top = "0";
      el.dataset.pile = "stock";
      stockEl.appendChild(el);
    }

    // Waste
    const wasteEl = pileById("waste");
    clearChildren(wasteEl);
    const visibleWaste = [];
    for (let i = 0; i < state.waste.length; i++) {
      const c = state.waste[i];
      if (isSkipped(skipIds, c)) continue;
      visibleWaste.push({ card: c, originalIdx: i });
    }
    const showCount = Math.min(state.draw, visibleWaste.length);
    const startV = visibleWaste.length - showCount;
    for (let i = startV; i < visibleWaste.length; i++) {
      const { card, originalIdx } = visibleWaste[i];
      const el = Card.createCardElement(card);
      el.style.left = `${(i - startV) * 18}px`;
      el.style.top = "0";
      el.dataset.pile = "waste";
      el.dataset.cardIndex = originalIdx;
      if (i === visibleWaste.length - 1) el.dataset.movable = "1";
      wasteEl.appendChild(el);
    }

    // Foundations
    for (let f = 0; f < 4; f++) {
      const slot = pileById("foundation", f);
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
    const fanUp = U.cssVarPx("--tableau-fan-up");
    const fanDown = U.cssVarPx("--tableau-fan-down");
    for (let t = 0; t < 7; t++) {
      const slot = pileById("tableau", t);
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

    refreshStatus();
  }

  function refreshStatus() {
    Status.update({
      score: state.score,
      moves: state.moves,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt
    });
  }

  /* ---- Drag callbacks ---- */

  function getPickup(e, cardEl) {
    if (state.finishedAt || dealingInFlight) return null;

    // Click anywhere on the (empty) stock slot triggers a deal/recycle.
    const stockSlot = e.target.closest("#stock");
    if (stockSlot && !cardEl) {
      return { cards: [], click: () => { K.dealFromStock(state); render(new Set()); } };
    }
    if (!cardEl) return null;
    const pile = cardEl.dataset.pile;
    if (pile === "stock") {
      return { cards: [], click: () => { K.dealFromStock(state); render(new Set()); } };
    }
    if (!cardEl.dataset.movable) return null;

    const pileIndex = parseInt(cardEl.dataset.pileIndex || "0", 10);
    const cardIndex = parseInt(cardEl.dataset.cardIndex || "0", 10);

    let cards;
    if (pile === "tableau") cards = state.tableau[pileIndex].slice(cardIndex);
    else if (pile === "waste") cards = [state.waste[cardIndex]];
    else if (pile === "foundation") cards = [state.foundations[pileIndex][cardIndex]];
    else return null;

    if (!cards.length) return null;
    return { cards, src: { pile, index: pileIndex, cardIndex } };
  }

  function tryDrop(src, dropEl) {
    const pile = dropEl.dataset.pile;
    if (pile === "stock" || pile === "waste") return false;
    const index = parseInt(dropEl.dataset.index || "0", 10);
    return K.move(state, src, { pile, index });
  }

  function tryAutoMove(src) {
    return K.autoMove(state, src);
  }

  /* ---- Win check + auto-complete ---- */

  function maybeWinCheck() {
    if (!K.isWon(state) || state.finishedAt) return;
    state.finishedAt = Date.now();
    stopTimer();
    const timeSec = Math.floor((state.finishedAt - state.startedAt) / 1000);
    Stats.record(GAME_ID, { won: true, timeSec, score: state.score });
    Modal.show({
      title: "You Win!",
      html: `<p style="margin:0 0 10px 0">Congratulations — you cleared the board.</p>
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

  /**
   * Smart auto-play loop. After every successful move (and on toggle-on)
   * sends "safe" cards to the foundations one at a time, animated via
   * setTimeout. Stops when no more safe cards are available; calls the
   * win flow if the board cleared.
   */
  function runAutoPlay() {
    if (autoPlayActive) return; // already running
    if (!autoComplete) {
      maybeWinCheck();
      return;
    }
    autoPlayActive = true;
    const tick = () => {
      if (!autoComplete || state.finishedAt || dealingInFlight) {
        autoPlayActive = false;
        maybeWinCheck();
        return;
      }
      const moved = K.safeAutoStep(state);
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
      // Came from the menu — Rust has already toggled the check item.
      setAutoComplete(payload.checked, false);
    } else {
      // Hotkey or programmatic — toggle current state and sync back.
      setAutoComplete(!autoComplete, true);
    }
  }

  /* ---- Hint ---- */

  function showHint() {
    const h = K.hint(state);
    if (!h) return;
    const pile = h.src.pile === "tableau"
      ? state.tableau[h.src.index]
      : h.src.pile === "waste"
      ? state.waste
      : state.foundations[h.src.index];
    const cardId = pile[h.src.cardIndex].id;
    const el = document.querySelector(`.card[data-card-id="${CSS.escape(cardId)}"]`);
    if (el) {
      el.classList.add("hint-flash");
      setTimeout(() => el.classList.remove("hint-flash"), 1300);
    }
  }

  /* ---- Dealing + new game ---- */

  function dealSolvableState(draw) {
    return new Promise((resolve) => {
      Overlay.show("Dealing a winnable game…");
      dealingInFlight = true;
      setTimeout(() => {
        const result = K.findSolvableState({ draw });
        dealingInFlight = false;
        Overlay.hide();
        resolve(result.state);
      }, 30);
    });
  }

  async function newGame() {
    if (state && !state.finishedAt && state.moves > 0) {
      Stats.record(GAME_ID, { won: false });
    }
    if (dragMgr) dragMgr.abort();
    state = await dealSolvableState(drawMode);
    render(new Set());
    startTimer();
  }

  function startTimer() {
    stopTimer();
    timerHandle = setInterval(refreshStatus, 1000);
  }
  function stopTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

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
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label><input type="radio" name="draw" value="1" ${drawMode === 1 ? "checked" : ""}/> Draw one card</label>
            <label><input type="radio" name="draw" value="3" ${drawMode === 3 ? "checked" : ""}/> Draw three cards</label>
          </div>
          <div style="padding-top:10px; border-top:1px solid #c5c5c5;">
            <label><input type="checkbox" id="opt-autocomplete" ${autoComplete ? "checked" : ""}/> Auto-play cards to foundation</label>
          </div>
        </div>
      `,
      buttons: [
        {
          label: "OK", primary: true,
          onClick: () => {
            const sel = document.querySelector('input[name="draw"]:checked');
            const d = sel ? parseInt(sel.value, 10) : 1;
            const acEl = document.getElementById("opt-autocomplete");
            const newAuto = acEl ? acEl.checked : autoComplete;
            Modal.close();
            if (newAuto !== autoComplete) setAutoComplete(newAuto, true);
            if (d !== drawMode) {
              drawMode = d;
              persistOptions();
              syncDrawModeMenu(d);
              newGame();
            }
          }
        },
        { label: "Cancel", onClick: Modal.close }
      ]
    });
  }

  function showAbout() {
    Modal.show({
      title: "About Klondike",
      html: `<p style="margin:0 0 6px 0;"><strong>Klondike</strong></p>
             <p style="margin:0 0 10px 0;">Version 1.0.0</p>
             <p style="margin:0;">A classic single-player card game in the style of the Windows Vista edition.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }

  function howToPlay() {
    Modal.show({
      title: "How to Play",
      html: `<p style="margin:0 0 8px 0;">Build four foundations up by suit from Ace to King.</p>
             <p style="margin:0 0 8px 0;">In the tableau, stack cards in alternating colours, descending in rank.</p>
             <p style="margin:0 0 8px 0;">Click the stock pile to deal new cards. Click a card to auto-send it to the foundations.</p>
             <p style="margin:0;">Use Hint, Undo and Auto-Complete from the Edit menu.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: Modal.close }]
    });
  }

  /* ---- Boot ---- */

  document.addEventListener("DOMContentLoaded", async () => {
    Modal.init();

    MenuBridge.registerMany({
      "new-game": () => newGame(),
      "restart": () => newGame(),
      "undo": () => { if (K.undo(state)) render(new Set()); },
      "hint": showHint,
      "auto-complete": handleAutoCompleteAction,
      "draw-1": () => { if (drawMode !== 1) { drawMode = 1; persistOptions(); newGame(); } },
      "draw-3": () => { if (drawMode !== 3) { drawMode = 3; persistOptions(); newGame(); } },
      "stats": openStats,
      "options": openOptions,
      "about": showAbout,
      "how-to-play": howToPlay
    });
    window.Zoom.install({
      initial: opts.zoom,
      onChange: (z) => { opts.zoom = z; persistOptions(); }
    });

    MenuBridge.wire();
    // Sync menu state with persisted options.
    syncDrawModeMenu(drawMode);
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
      isLocked: () => dealingInFlight || !!state.finishedAt,
      getPickup, tryDrop, tryAutoMove,
      render,
      onAfter: runAutoPlay
    });
    dragMgr.attach();

    state = await dealSolvableState(drawMode);
    render(new Set());
    startTimer();
  });
})();
