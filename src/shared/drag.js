/* ---------- Shared drag/drop manager ----------
 * Game-agnostic pointer handling: capture, drag-layer, skip-in-render,
 * click-detection, abort on blur/cancel. Games supply rule callbacks.
 */
(function () {
  const U = window.SolUtils;
  const Card = window.Card;

  /**
   * create({
   *   boardEl, dragLayerEl,
   *   getPickup(e, cardEl) -> { cards:[Card], src:any } | null
   *   render(skipIds: Set<string>) -> void           // re-renders the board, omitting picked cards
   *   tryDrop(src, dropEl) -> bool                   // dropEl is the .pile-slot the pointer is over
   *   tryAutoMove(src) -> bool                       // on click without movement
   *   onAfter() -> void                              // after a successful move
   *   fanY                                           // px between stacked dragged cards
   *   isLocked() -> bool                             // when true, ignore pointerdown
   * })
   */
  function create(opts) {
    const boardEl = opts.boardEl;
    const dragLayerEl = opts.dragLayerEl;
    const fanY = opts.fanY != null ? opts.fanY : 26;

    let drag = null;

    function isInputTarget(t) {
      return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
    }

    function onPointerDown(e) {
      if (opts.isLocked && opts.isLocked()) return;
      if (isInputTarget(e.target)) return;
      if (e.button !== undefined && e.button !== 0) return;

      const cardEl = e.target.closest(".card");
      // Empty pile slots may still be interactive (e.g. stock recycle, free
      // cell drop target) — opts.getPickup can return non-null even when no
      // card is under the pointer.
      const pickup = opts.getPickup(e, cardEl);
      if (!pickup) return;
      if (!pickup.cards || !pickup.cards.length) {
        // Pickup with no cards (a "click action" like stock deal) - apply and return.
        if (pickup.click) pickup.click();
        return;
      }

      const firstRect = (cardEl || e.target).getBoundingClientRect();
      drag = {
        src: pickup.src,
        cards: pickup.cards,
        skipIds: new Set(pickup.cards.map((c) => c.id)),
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        grabDX: e.clientX - firstRect.left,
        grabDY: e.clientY - firstRect.top,
        els: [],
        didMove: false,
        captureTarget: null
      };

      opts.render(drag.skipIds);

      for (const c of pickup.cards) {
        const el = Card.createCardElement(c);
        el.classList.add("dragging");
        dragLayerEl.appendChild(el);
        drag.els.push(el);
      }
      positionDrag(e.clientX, e.clientY);

      try {
        boardEl.setPointerCapture(e.pointerId);
        drag.captureTarget = boardEl;
      } catch (_) {}

      document.addEventListener("pointermove", onPointerMove, true);
      document.addEventListener("pointerup", onPointerUp, true);
      document.addEventListener("pointercancel", onPointerCancel, true);
      window.addEventListener("blur", onWindowBlur);

      e.preventDefault();
    }

    function positionDrag(x, y) {
      if (!drag) return;
      let yOff = 0;
      for (const el of drag.els) {
        el.style.left = `${x - drag.grabDX}px`;
        el.style.top = `${y - drag.grabDY + yOff}px`;
        yOff += fanY;
      }
    }

    function onPointerMove(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
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
      if (drag && drag.captureTarget && drag.pointerId != null) {
        try { drag.captureTarget.releasePointerCapture(drag.pointerId); } catch (_) {}
      }
    }

    function cleanupDragDom() {
      if (!drag) return;
      for (const el of drag.els) {
        if (el.parentElement) el.parentElement.removeChild(el);
      }
    }

    function onWindowBlur() { if (drag) abort(); }
    function onPointerCancel() { if (drag) abort(); }

    function abort() {
      teardownPointerListeners();
      releaseCapture();
      cleanupDragDom();
      drag = null;
      opts.render(new Set());
    }

    function onPointerUp(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      teardownPointerListeners();
      releaseCapture();

      if (!drag.didMove) {
        const src = drag.src;
        cleanupDragDom();
        drag = null;
        const moved = opts.tryAutoMove(src);
        opts.render(new Set());
        if (moved && opts.onAfter) opts.onAfter();
        return;
      }

      const dropEl = findDropTarget(e.clientX, e.clientY);
      const src = drag.src;
      const moved = dropEl ? opts.tryDrop(src, dropEl) : false;
      cleanupDragDom();
      drag = null;
      opts.render(new Set());
      if (moved && opts.onAfter) opts.onAfter();
    }

    function findDropTarget(x, y) {
      const stack = document.elementsFromPoint(x, y);
      for (const el of stack) {
        if (!el.closest) continue;
        if (el.classList && el.classList.contains("dragging")) continue;
        const slot = el.closest(".pile-slot");
        if (slot) return slot;
      }
      return null;
    }

    function attach() {
      boardEl.addEventListener("pointerdown", onPointerDown);
    }

    function destroy() {
      if (drag) abort();
      boardEl.removeEventListener("pointerdown", onPointerDown);
    }

    return { attach, destroy, abort };
  }

  window.DragManager = { create };
})();
