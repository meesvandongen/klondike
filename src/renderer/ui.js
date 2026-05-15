/* ---------- UI: rendering, input, modals, menu wiring ---------- */
(function () {
  const K = window.Klondike;
  const api = window.klondikeAPI;

  let state = K.newState({ draw: 1 });
  let drawMode = 1;
  let timerHandle = null;

  /* ----- Card rendering ----- */

  function rankDisplay(r) {
    return r;
  }

  function createCardElement(card) {
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.cardId = card.id;
    if (!card.faceUp) {
      el.classList.add("face-down");
    } else {
      el.classList.add("face-up", K.SUIT_COLOR[card.suit]);
      const isFace = ["J", "Q", "K"].includes(card.rank);
      if (isFace) el.classList.add("face-card");

      const tl = document.createElement("div");
      tl.className = "corner tl";
      tl.innerHTML = `<span class="rank">${rankDisplay(card.rank)}</span><span class="suit">${K.SUIT_GLYPH[card.suit]}</span>`;
      const br = document.createElement("div");
      br.className = "corner br";
      br.innerHTML = `<span class="rank">${rankDisplay(card.rank)}</span><span class="suit">${K.SUIT_GLYPH[card.suit]}</span>`;
      const center = document.createElement("div");
      center.className = "center";
      if (isFace) {
        center.innerHTML = `${card.rank}<span class="suit-tag">${K.SUIT_GLYPH[card.suit]}</span>`;
      } else {
        center.textContent = K.SUIT_GLYPH[card.suit];
      }
      el.appendChild(tl);
      el.appendChild(br);
      el.appendChild(center);
    }
    return el;
  }

  /* ----- Layout / render ----- */

  function topRowSlot(name, idx) {
    if (name === "stock") return document.getElementById("stock");
    if (name === "waste") return document.getElementById("waste");
    if (name === "foundation") return document.getElementById(`foundation-${idx}`);
  }

  function tableauSlot(idx) {
    return document.querySelector(`.pile-slot.tableau[data-index="${idx}"]`);
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function render() {
    // Stock
    const stockEl = document.getElementById("stock");
    clearChildren(stockEl);
    if (state.stock.length > 0) {
      const c = state.stock[state.stock.length - 1];
      const el = createCardElement({ ...c, faceUp: false });
      el.style.left = "0px";
      el.style.top = "0px";
      el.dataset.pile = "stock";
      stockEl.appendChild(el);
    }

    // Waste — show last up to 3 (when draw 3) cascaded slightly
    const wasteEl = document.getElementById("waste");
    clearChildren(wasteEl);
    const showCount = Math.min(state.draw, state.waste.length);
    const startIdx = state.waste.length - showCount;
    for (let i = startIdx; i < state.waste.length; i++) {
      const c = state.waste[i];
      const el = createCardElement(c);
      const offset = (i - startIdx) * 18;
      el.style.left = `${offset}px`;
      el.style.top = "0px";
      el.dataset.pile = "waste";
      el.dataset.cardIndex = i;
      // Only the topmost waste card is interactive.
      if (i === state.waste.length - 1) {
        el.dataset.movable = "1";
      }
      wasteEl.appendChild(el);
    }

    // Foundations
    for (let f = 0; f < 4; f++) {
      const slot = topRowSlot("foundation", f);
      clearChildren(slot);
      const p = state.foundations[f];
      if (p.length > 0) {
        const c = p[p.length - 1];
        const el = createCardElement(c);
        el.style.left = "0px";
        el.style.top = "0px";
        el.dataset.pile = "foundation";
        el.dataset.pileIndex = f;
        el.dataset.cardIndex = p.length - 1;
        el.dataset.movable = "1";
        slot.appendChild(el);
      }
    }

    // Tableau
    for (let t = 0; t < 7; t++) {
      const slot = tableauSlot(t);
      clearChildren(slot);
      const p = state.tableau[t];
      let offset = 0;
      for (let i = 0; i < p.length; i++) {
        const c = p[i];
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

  function cssVarPx(name) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return parseInt(v, 10) || 0;
  }

  function updateStatus() {
    document.getElementById("status-score").textContent = `Score: ${state.score}`;
    document.getElementById("status-moves").textContent = `Moves: ${state.moves}`;
    const sec = Math.floor((Date.now() - state.startedAt) / 1000);
    document.getElementById("status-time").textContent = `Time: ${formatTime(sec)}`;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  /* ----- Drag and drop ----- */

  let drag = null; // { srcPile, srcIndex, cardIndex, ghost, dx, dy, cards: [Element] }

  function onCardPointerDown(e) {
    // Empty stock slot click: recycle waste.
    const stockSlot = e.target.closest("#stock");
    if (stockSlot && !e.target.closest(".card")) {
      if (state.finishedAt) return;
      K.dealFromStock(state);
      render();
      return;
    }

    const cardEl = e.target.closest(".card");
    if (!cardEl) return;
    const pile = cardEl.dataset.pile;

    // Stock: click only — deal
    if (pile === "stock") {
      if (state.finishedAt) return;
      K.dealFromStock(state);
      render();
      maybeWinCheck();
      return;
    }

    if (!cardEl.dataset.movable) return;
    if (state.finishedAt) return;

    const pileIndex = parseInt(cardEl.dataset.pileIndex || "0", 10);
    const cardIndex = parseInt(cardEl.dataset.cardIndex || "0", 10);

    // For tableau, we may be picking up a stack of cards (this card and below).
    let pickedEls = [];
    if (pile === "tableau") {
      const all = Array.from(cardEl.parentElement.children);
      for (const el of all) {
        const ci = parseInt(el.dataset.cardIndex || "0", 10);
        if (ci >= cardIndex) pickedEls.push(el);
      }
    } else {
      pickedEls = [cardEl];
    }

    const firstRect = pickedEls[0].getBoundingClientRect();
    const boardRect = document.body.getBoundingClientRect();
    drag = {
      src: { pile, index: pileIndex, cardIndex },
      startX: e.clientX,
      startY: e.clientY,
      grabDX: e.clientX - firstRect.left,
      grabDY: e.clientY - firstRect.top,
      els: pickedEls,
      originalParents: pickedEls.map((el) => ({ parent: el.parentElement, next: el.nextSibling, left: el.style.left, top: el.style.top })),
      didMove: false
    };

    const dragLayer = document.getElementById("drag-layer");
    let offsetY = 0;
    for (const el of pickedEls) {
      el.classList.add("dragging");
      const r = el.getBoundingClientRect();
      el.style.left = `${r.left}px`;
      el.style.top = `${r.top + offsetY * 0}px`;
      el.style.position = "absolute";
      dragLayer.appendChild(el);
      offsetY += cssVarPx("--tableau-fan-up");
    }

    positionDrag(e.clientX, e.clientY);

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    e.preventDefault();
  }

  function positionDrag(x, y) {
    if (!drag) return;
    let yOff = 0;
    for (const el of drag.els) {
      el.style.left = `${x - drag.grabDX}px`;
      el.style.top = `${y - drag.grabDY + yOff}px`;
      yOff += cssVarPx("--tableau-fan-up");
    }
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.startX) > 2 || Math.abs(e.clientY - drag.startY) > 2) {
      drag.didMove = true;
    }
    positionDrag(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    if (!drag) return;

    if (!drag.didMove) {
      // Treat as click: auto-move on double-click handled separately.
      cancelDrag();
      return;
    }

    const dropTarget = findDropTarget(e.clientX, e.clientY);
    if (dropTarget) {
      const ok = K.move(state, drag.src, dropTarget);
      if (ok) {
        finishDrag();
        render();
        maybeWinCheck();
        return;
      }
    }
    cancelDrag();
  }

  function findDropTarget(x, y) {
    const layer = document.getElementById("drag-layer");
    layer.style.pointerEvents = "none";
    const stack = document.elementsFromPoint(x, y);
    let pileEl = null;
    for (const el of stack) {
      if (el === layer) continue;
      if (el.classList && el.classList.contains("dragging")) continue;
      const slot = el.closest && el.closest(".pile-slot");
      if (slot) {
        pileEl = slot;
        break;
      }
      const cardEl = el.closest && el.closest(".card");
      if (cardEl && cardEl.parentElement && cardEl.parentElement.classList.contains("pile-slot")) {
        pileEl = cardEl.parentElement;
        break;
      }
    }
    if (!pileEl) return null;
    const pile = pileEl.dataset.pile;
    const index = parseInt(pileEl.dataset.index || "0", 10);
    if (pile === "stock" || pile === "waste") return null;
    return { pile, index };
  }

  function cancelDrag() {
    if (!drag) return;
    drag.els.forEach((el, i) => {
      const o = drag.originalParents[i];
      el.classList.remove("dragging");
      el.style.left = o.left;
      el.style.top = o.top;
      if (o.next) o.parent.insertBefore(el, o.next);
      else o.parent.appendChild(el);
    });
    drag = null;
  }

  function finishDrag() {
    if (!drag) return;
    drag.els.forEach((el) => {
      el.classList.remove("dragging");
      if (el.parentElement) el.parentElement.removeChild(el);
    });
    drag = null;
  }

  /* ----- Double click for auto-move ----- */

  function onCardDoubleClick(e) {
    const cardEl = e.target.closest(".card");
    if (!cardEl) return;
    const pile = cardEl.dataset.pile;
    if (pile === "stock") return;
    if (!cardEl.dataset.movable) return;
    if (state.finishedAt) return;

    const pileIndex = parseInt(cardEl.dataset.pileIndex || "0", 10);
    const cardIndex = parseInt(cardEl.dataset.cardIndex || "0", 10);
    // only top card auto-moves
    const srcPile =
      pile === "tableau"
        ? state.tableau[pileIndex]
        : pile === "waste"
        ? state.waste
        : state.foundations[pileIndex];
    if (cardIndex !== srcPile.length - 1) return;

    if (K.autoMove(state, { pile, index: pileIndex, cardIndex })) {
      render();
      maybeWinCheck();
    }
  }

  /* ----- Win check / auto complete ----- */

  function maybeWinCheck() {
    if (K.isWon(state) && !state.finishedAt) {
      state.finishedAt = Date.now();
      stopTimer();
      const timeSec = Math.floor((state.finishedAt - state.startedAt) / 1000);
      api.updateStats({ won: true, timeSec, score: state.score }).finally(() => {
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
      });
    }
  }

  function autoCompleteAll() {
    if (state.finishedAt) return;
    const tick = () => {
      const moved = K.autoCompleteStep(state);
      render();
      if (moved && !K.isWon(state)) {
        setTimeout(tick, 60);
      } else {
        maybeWinCheck();
      }
    };
    tick();
  }

  /* ----- Hints ----- */

  function showHint() {
    const h = K.hint(state);
    if (!h) return;
    const src = h.src;
    const srcPile =
      src.pile === "tableau"
        ? state.tableau[src.index]
        : src.pile === "waste"
        ? state.waste
        : state.foundations[src.index];
    const cardId = srcPile[src.cardIndex].id;
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

  /* ----- Game lifecycle ----- */

  function newGame() {
    if (state && !state.finishedAt && state.moves > 0) {
      api.updateStats({ won: false }).catch(() => {});
    }
    state = K.newState({ draw: drawMode });
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

  /* ----- Stats / options dialogs ----- */

  async function openStats() {
    const s = await api.getStats();
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
          onClick: async () => {
            await api.resetStats();
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
            if (d !== drawMode) {
              drawMode = d;
              newGame();
            }
            closeModal();
          }
        },
        { label: "Cancel", onClick: closeModal }
      ]
    });
  }

  /* ----- Wiring ----- */

  function wire() {
    document.getElementById("board").addEventListener("pointerdown", onCardPointerDown);
    document.getElementById("board").addEventListener("dblclick", onCardDoubleClick);
    document.getElementById("modal-close").addEventListener("click", closeModal);

    api.on("menu:new-game", () => newGame());
    api.on("menu:undo", () => {
      if (K.undo(state)) render();
    });
    api.on("menu:hint", showHint);
    api.on("menu:auto-complete", autoCompleteAll);
    api.on("menu:toggle-draw", (d) => {
      drawMode = d;
      newGame();
    });
    api.on("menu:stats", openStats);
    api.on("menu:options", openOptions);

    window.addEventListener("resize", render);
  }

  /* ----- Boot ----- */

  document.addEventListener("DOMContentLoaded", () => {
    wire();
    render();
    startTimer();
  });
})();
