/* ---------- UI: rendering, input, modals, menu wiring ---------- */
(function () {
  const K = window.Klondike;

  let state = K.newState({ draw: 1 });
  let drawMode = 1;
  let timerHandle = null;
  let drag = null;
  let dealingInFlight = false;

  /* ----- Stats persistence (localStorage) ----- */

  const STATS_KEY = "klondike.stats";

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (!raw) throw 0;
      return JSON.parse(raw);
    } catch (_) {
      return { gamesPlayed: 0, gamesWon: 0, bestTimeSec: null, bestScore: 0 };
    }
  }

  function saveStats(s) {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(s));
    } catch (_) {}
  }

  function recordResult(result) {
    const s = loadStats();
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
    saveStats(s);
    return s;
  }

  /* ----- SVG face card art ----- */

  function escapeSvg(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function faceCardSvg(rank, suit) {
    const color = K.SUIT_COLOR[suit] === "red" ? "#c11414" : "#1a1a1a";
    const accent = K.SUIT_COLOR[suit] === "red" ? "#8a0c0c" : "#404040";
    const suitGlyph = escapeSvg(K.SUIT_GLYPH[suit]);

    let ornament = "";
    if (rank === "K") {
      ornament = `
        <g transform="translate(50 30)">
          <rect x="-22" y="6" width="44" height="5" fill="${color}"/>
          <path d="M -22 7 L -18 -8 L -10 4 L -3 -10 L 0 -16 L 3 -10 L 10 4 L 18 -8 L 22 7 Z"
                fill="${color}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>
          <circle cx="-18" cy="-8" r="2.6" fill="#fff" stroke="${color}" stroke-width="1.2"/>
          <circle cx="0" cy="-16" r="3" fill="#fff" stroke="${color}" stroke-width="1.2"/>
          <circle cx="18" cy="-8" r="2.6" fill="#fff" stroke="${color}" stroke-width="1.2"/>
          <path d="M 0 -16 L 0 -26 M -4 -22 L 4 -22"
                stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
        </g>`;
    } else if (rank === "Q") {
      ornament = `
        <g transform="translate(50 32)">
          <rect x="-18" y="6" width="36" height="4" fill="${color}"/>
          <path d="M -18 7 L -14 -6 L -7 4 L 0 -10 L 7 4 L 14 -6 L 18 7 Z"
                fill="${color}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>
          <circle cx="-14" cy="-6" r="2.2" fill="#fff" stroke="${color}" stroke-width="1"/>
          <circle cx="0" cy="-10" r="2.8" fill="#fff" stroke="${color}" stroke-width="1"/>
          <circle cx="14" cy="-6" r="2.2" fill="#fff" stroke="${color}" stroke-width="1"/>
          <g transform="translate(0 -18)">
            <circle cx="0" cy="0" r="2.5" fill="${color}"/>
            <circle cx="-4" cy="2" r="2.2" fill="${color}"/>
            <circle cx="4" cy="2" r="2.2" fill="${color}"/>
            <circle cx="0" cy="4" r="2.2" fill="${color}"/>
          </g>
        </g>`;
    } else {
      ornament = `
        <g transform="translate(50 32)">
          <path d="M 0 -22 Q -7 -16 -6 -6 Q -10 0 -6 8 Q -3 14 0 14 Q 3 14 6 8 Q 10 0 6 -6 Q 7 -16 0 -22 Z"
                fill="${color}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>
          <path d="M 0 -22 L 0 12" stroke="${accent}" stroke-width="0.8" fill="none"/>
          <path d="M -3 -15 Q -1 -14 0 -12 M 3 -15 Q 1 -14 0 -12"
                stroke="${accent}" stroke-width="0.6" fill="none"/>
          <path d="M -4 -6 Q -2 -4 0 -3 M 4 -6 Q 2 -4 0 -3"
                stroke="${accent}" stroke-width="0.6" fill="none"/>
        </g>`;
    }

    return `
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="84" height="84" fill="none" rx="3"
              stroke="${color}" stroke-width="0.6" stroke-opacity="0.45"/>
        ${ornament}
        <text x="50" y="78" text-anchor="middle" font-family="Georgia, serif"
              font-weight="800" font-size="22" fill="${color}">${rank}</text>
        <text x="50" y="94" text-anchor="middle" font-size="16" fill="${color}">${suitGlyph}</text>
      </svg>`;
  }

  /* ----- Card rendering ----- */

  function createCardElement(card) {
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.cardId = card.id;
    if (!card.faceUp) {
      el.classList.add("face-down");
      return el;
    }

    el.classList.add("face-up", K.SUIT_COLOR[card.suit]);
    const isFace = card.rank === "J" || card.rank === "Q" || card.rank === "K";
    if (isFace) el.classList.add("face-card");

    const tl = document.createElement("div");
    tl.className = "corner tl";
    tl.innerHTML = `<span class="rank">${card.rank}</span><span class="suit">${K.SUIT_GLYPH[card.suit]}</span>`;
    const br = document.createElement("div");
    br.className = "corner br";
    br.innerHTML = `<span class="rank">${card.rank}</span><span class="suit">${K.SUIT_GLYPH[card.suit]}</span>`;
    const center = document.createElement("div");
    center.className = "center";
    if (isFace) {
      center.innerHTML = faceCardSvg(card.rank, card.suit);
    } else {
      center.textContent = K.SUIT_GLYPH[card.suit];
    }
    el.appendChild(tl);
    el.appendChild(br);
    el.appendChild(center);
    return el;
  }

  /* ----- Render ----- */

  function pileById(name, idx) {
    if (name === "stock") return document.getElementById("stock");
    if (name === "waste") return document.getElementById("waste");
    if (name === "foundation") return document.getElementById(`foundation-${idx}`);
    if (name === "tableau") return document.querySelector(`.pile-slot.tableau[data-index="${idx}"]`);
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function cssVarPx(name) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return parseInt(v, 10) || 0;
  }

  function isSkipped(card) {
    return drag && drag.skipIds && drag.skipIds.has(card.id);
  }

  function render() {
    // Stock
    const stockEl = pileById("stock");
    clearChildren(stockEl);
    if (state.stock.length > 0) {
      const c = state.stock[state.stock.length - 1];
      const el = createCardElement({ ...c, faceUp: false });
      el.style.left = "0px";
      el.style.top = "0px";
      el.dataset.pile = "stock";
      stockEl.appendChild(el);
    }

    // Waste — filter out dragged cards, then show last `draw` of what's left.
    const wasteEl = pileById("waste");
    clearChildren(wasteEl);
    const visibleWaste = [];
    for (let i = 0; i < state.waste.length; i++) {
      const c = state.waste[i];
      if (isSkipped(c)) continue;
      visibleWaste.push({ card: c, originalIdx: i });
    }
    const showCount = Math.min(state.draw, visibleWaste.length);
    const wasteStart = visibleWaste.length - showCount;
    for (let i = wasteStart; i < visibleWaste.length; i++) {
      const { card, originalIdx } = visibleWaste[i];
      const el = createCardElement(card);
      el.style.left = `${(i - wasteStart) * 18}px`;
      el.style.top = "0px";
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
      let visibleTop = -1;
      for (let i = p.length - 1; i >= 0; i--) {
        if (!isSkipped(p[i])) {
          visibleTop = i;
          break;
        }
      }
      if (visibleTop >= 0) {
        const c = p[visibleTop];
        const el = createCardElement(c);
        el.style.left = "0px";
        el.style.top = "0px";
        el.dataset.pile = "foundation";
        el.dataset.pileIndex = f;
        el.dataset.cardIndex = visibleTop;
        el.dataset.movable = "1";
        slot.appendChild(el);
      }
    }

    // Tableau
    for (let t = 0; t < 7; t++) {
      const slot = pileById("tableau", t);
      clearChildren(slot);
      const p = state.tableau[t];
      let offset = 0;
      for (let i = 0; i < p.length; i++) {
        const c = p[i];
        if (isSkipped(c)) break;
        const el = createCardElement(c);
        el.style.left = "0px";
        el.style.top = `${offset}px`;
        el.dataset.pile = "tableau";
        el.dataset.pileIndex = t;
        el.dataset.cardIndex = i;
        if (c.faceUp) el.dataset.movable = "1";
        slot.appendChild(el);
        offset += c.faceUp ? cssVarPx("--tableau-fan-up") : cssVarPx("--tableau-fan-down");
      }
    }

    updateStatus();
  }

  function updateStatus() {
    document.getElementById("status-score").textContent = `Score: ${state.score}`;
    document.getElementById("status-moves").textContent = `Moves: ${state.moves}`;
    const sec = state.finishedAt
      ? Math.floor((state.finishedAt - state.startedAt) / 1000)
      : Math.floor((Date.now() - state.startedAt) / 1000);
    document.getElementById("status-time").textContent = `Time: ${formatTime(sec)}`;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  /* ----- Drag and drop ----- */

  function onCardPointerDown(e) {
    if (state.finishedAt || dealingInFlight) return;
    if (e.button !== undefined && e.button !== 0) return;

    // Empty stock slot click: recycle waste.
    const stockSlot = e.target.closest("#stock");
    if (stockSlot && !e.target.closest(".card")) {
      K.dealFromStock(state);
      render();
      return;
    }

    const cardEl = e.target.closest(".card");
    if (!cardEl) return;
    const pile = cardEl.dataset.pile;

    if (pile === "stock") {
      K.dealFromStock(state);
      render();
      return;
    }

    if (!cardEl.dataset.movable) return;

    const pileIndex = parseInt(cardEl.dataset.pileIndex || "0", 10);
    const cardIndex = parseInt(cardEl.dataset.cardIndex || "0", 10);

    let pickedCards;
    if (pile === "tableau") {
      pickedCards = state.tableau[pileIndex].slice(cardIndex);
    } else if (pile === "waste") {
      pickedCards = [state.waste[cardIndex]];
    } else if (pile === "foundation") {
      pickedCards = [state.foundations[pileIndex][cardIndex]];
    } else {
      return;
    }
    if (!pickedCards.length) return;

    const firstRect = cardEl.getBoundingClientRect();

    drag = {
      src: { pile, index: pileIndex, cardIndex },
      pickedCards,
      skipIds: new Set(pickedCards.map((c) => c.id)),
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      grabDX: e.clientX - firstRect.left,
      grabDY: e.clientY - firstRect.top,
      els: [],
      didMove: false,
      captureTarget: null
    };

    // Re-render so the cards underneath the picked stack become visible immediately.
    render();

    const dragLayer = document.getElementById("drag-layer");
    for (const c of pickedCards) {
      const el = createCardElement(c);
      el.classList.add("dragging");
      dragLayer.appendChild(el);
      drag.els.push(el);
    }
    positionDrag(e.clientX, e.clientY);

    // Capture on the board element (which is stable across renders) so move/up
    // events keep flowing even outside the window.
    const board = document.getElementById("board");
    try {
      board.setPointerCapture(e.pointerId);
      drag.captureTarget = board;
    } catch (_) {}

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    window.addEventListener("blur", onWindowBlur);

    e.preventDefault();
  }

  function positionDrag(x, y) {
    if (!drag) return;
    const fan = cssVarPx("--tableau-fan-up");
    let yOff = 0;
    for (const el of drag.els) {
      el.style.left = `${x - drag.grabDX}px`;
      el.style.top = `${y - drag.grabDY + yOff}px`;
      yOff += fan;
    }
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;
    if (!drag.didMove) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (dx * dx + dy * dy > 9) drag.didMove = true;
    }
    positionDrag(e.clientX, e.clientY);
  }

  function teardownPointerListeners() {
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("pointercancel", onPointerCancel, true);
    window.removeEventListener("blur", onWindowBlur);
  }

  function releaseCapture() {
    if (!drag) return;
    if (drag.captureTarget && drag.pointerId != null) {
      try {
        drag.captureTarget.releasePointerCapture(drag.pointerId);
      } catch (_) {}
    }
  }

  function cleanupDragDom() {
    if (!drag) return;
    for (const el of drag.els) {
      if (el.parentElement) el.parentElement.removeChild(el);
    }
  }

  function onWindowBlur() {
    if (drag) abortDrag();
  }
  function onPointerCancel() {
    if (drag) abortDrag();
  }
  function abortDrag() {
    teardownPointerListeners();
    releaseCapture();
    cleanupDragDom();
    drag = null;
    render();
  }

  function onPointerUp(e) {
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;
    teardownPointerListeners();
    releaseCapture();

    if (!drag.didMove) {
      const src = drag.src;
      cleanupDragDom();
      drag = null;
      const moved = K.autoMove(state, src);
      render();
      if (moved) maybeWinCheck();
      return;
    }

    const dropTarget = findDropTarget(e.clientX, e.clientY);
    const moved = dropTarget && K.move(state, drag.src, dropTarget);
    cleanupDragDom();
    drag = null;
    render();
    if (moved) maybeWinCheck();
  }

  function findDropTarget(x, y) {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (!el.closest) continue;
      if (el.classList && el.classList.contains("dragging")) continue;
      const slot = el.closest(".pile-slot");
      if (slot) {
        const pile = slot.dataset.pile;
        const index = parseInt(slot.dataset.index || "0", 10);
        if (pile === "stock" || pile === "waste") return null;
        return { pile, index };
      }
    }
    return null;
  }

  /* ----- Win / auto-complete ----- */

  function maybeWinCheck() {
    if (!K.isWon(state) || state.finishedAt) return;
    state.finishedAt = Date.now();
    stopTimer();
    const timeSec = Math.floor((state.finishedAt - state.startedAt) / 1000);
    recordResult({ won: true, timeSec, score: state.score });
    showModal({
      title: "You Win!",
      html: `<p style="margin:0 0 10px 0">Congratulations — you cleared the board.</p>
             <table>
               <tr><td>Score</td><td>${state.score}</td></tr>
               <tr><td>Time</td><td>${formatTime(timeSec)}</td></tr>
               <tr><td>Moves</td><td>${state.moves}</td></tr>
             </table>`,
      buttons: [
        { label: "New Game", primary: true, onClick: () => { closeModal(); newGame(); } },
        { label: "Close", onClick: closeModal }
      ]
    });
  }

  function autoCompleteAll() {
    if (state.finishedAt) return;
    const tick = () => {
      const moved = K.autoCompleteStep(state);
      render();
      if (moved && !K.isWon(state)) setTimeout(tick, 60);
      else maybeWinCheck();
    };
    tick();
  }

  /* ----- Hints ----- */

  function showHint() {
    const h = K.hint(state);
    if (!h) return;
    const srcPile =
      h.src.pile === "tableau"
        ? state.tableau[h.src.index]
        : h.src.pile === "waste"
        ? state.waste
        : state.foundations[h.src.index];
    const cardId = srcPile[h.src.cardIndex].id;
    const el = document.querySelector(`.card[data-card-id="${cardId}"]`);
    if (el) {
      el.classList.add("hint-flash");
      setTimeout(() => el.classList.remove("hint-flash"), 1300);
    }
  }

  /* ----- Modal helpers ----- */

  function showModal({ title, html, buttons }) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-content").innerHTML = html;
    const btnRow = document.getElementById("modal-buttons");
    btnRow.innerHTML = "";
    (buttons || [{ label: "OK", onClick: closeModal }]).forEach((b) => {
      const btn = document.createElement("button");
      btn.textContent = b.label;
      if (b.primary) btn.autofocus = true;
      btn.addEventListener("click", b.onClick);
      btnRow.appendChild(btn);
    });
    document.getElementById("modal-root").classList.remove("hidden");
  }

  function closeModal() {
    document.getElementById("modal-root").classList.add("hidden");
  }

  /* ----- Dealing overlay + solvable shuffle ----- */

  function setDealingOverlay(on) {
    const el = document.getElementById("dealing-overlay");
    if (on) el.classList.remove("hidden");
    else el.classList.add("hidden");
  }

  function dealSolvableState(draw) {
    return new Promise((resolve) => {
      setDealingOverlay(true);
      dealingInFlight = true;
      setTimeout(() => {
        const result = K.findSolvableState({ draw });
        dealingInFlight = false;
        setDealingOverlay(false);
        resolve(result.state);
      }, 30);
    });
  }

  /* ----- Game lifecycle ----- */

  async function newGame() {
    if (state && !state.finishedAt && state.moves > 0) {
      recordResult({ won: false });
    }
    if (drag) abortDrag();
    state = await dealSolvableState(drawMode);
    render();
    startTimer();
  }

  function startTimer() {
    stopTimer();
    timerHandle = setInterval(updateStatus, 1000);
  }

  function stopTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  /* ----- Dialogs ----- */

  function openStats() {
    const s = loadStats();
    const winPct = s.gamesPlayed ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0;
    const best = s.bestTimeSec == null ? "—" : formatTime(s.bestTimeSec);
    showModal({
      title: "Statistics",
      html: `<table>
        <tr><td>Games played</td><td>${s.gamesPlayed}</td></tr>
        <tr><td>Games won</td><td>${s.gamesWon}</td></tr>
        <tr><td>Win percentage</td><td>${winPct}%</td></tr>
        <tr><td>Best time</td><td>${best}</td></tr>
        <tr><td>Best score</td><td>${s.bestScore}</td></tr>
      </table>`,
      buttons: [
        {
          label: "Reset",
          onClick: () => {
            localStorage.removeItem(STATS_KEY);
            closeModal();
          }
        },
        { label: "OK", primary: true, onClick: closeModal }
      ]
    });
  }

  function openOptions() {
    showModal({
      title: "Options",
      html: `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <label><input type="radio" name="draw" value="1" ${drawMode === 1 ? "checked" : ""}/> Draw one card</label>
          <label><input type="radio" name="draw" value="3" ${drawMode === 3 ? "checked" : ""}/> Draw three cards</label>
        </div>
      `,
      buttons: [
        {
          label: "OK",
          primary: true,
          onClick: () => {
            const sel = document.querySelector('input[name="draw"]:checked');
            const d = sel ? parseInt(sel.value, 10) : 1;
            closeModal();
            if (d !== drawMode) {
              drawMode = d;
              newGame();
            }
          }
        },
        { label: "Cancel", onClick: closeModal }
      ]
    });
  }

  function showAbout() {
    showModal({
      title: "About Klondike",
      html: `<p style="margin:0 0 6px 0;"><strong>Klondike</strong></p>
             <p style="margin:0 0 10px 0;">Version 1.0.0</p>
             <p style="margin:0;">A classic single-player card game in the style of the Windows Vista edition.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: closeModal }]
    });
  }

  function howToPlay() {
    showModal({
      title: "How to Play",
      html: `<p style="margin:0 0 8px 0;">Build four foundations up by suit from Ace to King.</p>
             <p style="margin:0 0 8px 0;">In the tableau, stack cards in alternating colours, descending in rank.</p>
             <p style="margin:0 0 8px 0;">Click the stock pile to deal new cards. Click a card to auto-send it to the foundations.</p>
             <p style="margin:0;">Use Hint, Undo and Auto-Complete from the Edit menu.</p>`,
      buttons: [{ label: "OK", primary: true, onClick: closeModal }]
    });
  }

  /* ----- Tauri menu wiring ----- */

  function handleMenu(id) {
    switch (id) {
      case "new-game": newGame(); break;
      case "undo": if (K.undo(state)) render(); break;
      case "hint": showHint(); break;
      case "auto-complete": autoCompleteAll(); break;
      case "draw-1": if (drawMode !== 1) { drawMode = 1; newGame(); } break;
      case "draw-3": if (drawMode !== 3) { drawMode = 3; newGame(); } break;
      case "stats": openStats(); break;
      case "options": openOptions(); break;
      case "about": showAbout(); break;
      case "how-to-play": howToPlay(); break;
    }
  }

  async function wireTauriMenu() {
    const t = window.__TAURI__;
    if (!t || !t.event || !t.event.listen) return;
    try {
      await t.event.listen("menu", (event) => {
        const id = typeof event.payload === "string" ? event.payload : event.payload && event.payload.id;
        if (id) handleMenu(id);
      });
    } catch (_) {}
  }

  /* ----- Wiring ----- */

  function wire() {
    document.getElementById("board").addEventListener("pointerdown", onCardPointerDown);
    document.getElementById("modal-close").addEventListener("click", closeModal);
    window.addEventListener("resize", render);
    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key === "F2") {
        e.preventDefault();
        newGame();
      }
    });
    wireTauriMenu();
  }

  /* ----- Boot ----- */

  document.addEventListener("DOMContentLoaded", async () => {
    wire();
    state = await dealSolvableState(drawMode);
    render();
    startTimer();
  });
})();
