/* ---------- Shared drag/drop manager ----------
 * Pointer-capture-based drag. The host game provides callbacks for
 * pickup, drop, auto-move, and getSkipIds; the manager handles
 * capture, motion, click-detection and abort on blur/cancel.
 *
 * Drag visuals are exposed via a Solid signal (`dragVisual()`) so the
 * <DragLayer> component can render the floating stack and the
 * board's render reactively hides the picked-up cards via the
 * `skipIds()` signal.
 */

import { createSignal } from "solid-js";
import type { Card, MoveSource, Pickup } from "./types";

interface DragVisual {
  cards: Card[];
  x: number;
  y: number;
  fanY: number;
}

const [visual, setVisual] = createSignal<DragVisual | null>(null);
const [skipped, setSkipped] = createSignal<Set<string>>(new Set<string>());

export const dragVisual = visual;
export const skipIds = skipped;

export interface DragHooks {
  boardEl: HTMLElement;
  fanY: number | (() => number);
  isLocked?: () => boolean;
  getPickup: (e: PointerEvent, cardEl: HTMLElement | null) => Pickup | null;
  tryDrop: (src: MoveSource, dropEl: HTMLElement) => boolean;
  tryAutoMove: (src: MoveSource) => boolean;
  onAfter?: () => void;
}

export interface DragController {
  attach: () => void;
  destroy: () => void;
  abort: () => void;
}

interface DragState {
  src: MoveSource | undefined;
  cards: Card[];
  pointerId: number;
  startX: number;
  startY: number;
  grabDX: number;
  grabDY: number;
  didMove: boolean;
  captureTarget: HTMLElement | null;
}

export function createDragManager(opts: DragHooks): DragController {
  const { boardEl } = opts;
  let drag: DragState | null = null;

  function currentFanY(): number {
    if (typeof opts.fanY === "function") return opts.fanY();
    if (typeof opts.fanY === "number") return opts.fanY;
    return (
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--tableau-fan-up",
        ),
        10,
      ) || 26
    );
  }

  function isInputTarget(t: EventTarget | null): boolean {
    if (!t) return false;
    const tag = (t as HTMLElement).tagName;
    return tag === "INPUT" || tag === "TEXTAREA";
  }

  function onPointerDown(e: PointerEvent): void {
    if (opts.isLocked?.()) return;
    if (isInputTarget(e.target)) return;
    if (e.button !== undefined && e.button !== 0) return;

    const cardEl = (e.target as HTMLElement | null)?.closest(
      ".card",
    ) as HTMLElement | null;

    const pickup: Pickup | null = opts.getPickup(e, cardEl);
    if (!pickup) return;
    if (!pickup.cards || pickup.cards.length === 0) {
      pickup.click?.();
      return;
    }

    const firstRect = (cardEl ?? (e.target as HTMLElement)).getBoundingClientRect();
    const fanY = currentFanY();

    drag = {
      src: pickup.src,
      cards: pickup.cards,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      grabDX: e.clientX - firstRect.left,
      grabDY: e.clientY - firstRect.top,
      didMove: false,
      captureTarget: null,
    };

    setSkipped(new Set(pickup.cards.map((c) => c.id)));
    setVisual({
      cards: pickup.cards,
      x: e.clientX - drag.grabDX,
      y: e.clientY - drag.grabDY,
      fanY,
    });

    try {
      boardEl.setPointerCapture(e.pointerId);
      drag.captureTarget = boardEl;
    } catch (_) {
      /* ignore */
    }

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    window.addEventListener("blur", onWindowBlur);

    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.didMove) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (dx * dx + dy * dy > 9) drag.didMove = true;
    }
    const v = visual();
    if (v) {
      setVisual({
        ...v,
        x: e.clientX - drag.grabDX,
        y: e.clientY - drag.grabDY,
      });
    }
  }

  function teardownPointerListeners(): void {
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("pointercancel", onPointerCancel, true);
    window.removeEventListener("blur", onWindowBlur);
  }

  function releaseCapture(): void {
    if (drag?.captureTarget && drag.pointerId != null) {
      try {
        drag.captureTarget.releasePointerCapture(drag.pointerId);
      } catch (_) {
        /* ignore */
      }
    }
  }

  function clearVisuals(): void {
    setVisual(null);
    setSkipped(new Set<string>());
  }

  function onWindowBlur(): void {
    if (drag) abort();
  }
  function onPointerCancel(): void {
    if (drag) abort();
  }

  function abort(): void {
    teardownPointerListeners();
    releaseCapture();
    drag = null;
    clearVisuals();
  }

  function onPointerUp(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointerId) return;
    teardownPointerListeners();
    releaseCapture();

    const wasDrag = drag;
    drag = null;

    if (!wasDrag.didMove) {
      clearVisuals();
      if (wasDrag.src) {
        const moved = opts.tryAutoMove(wasDrag.src);
        if (moved && opts.onAfter) opts.onAfter();
      }
      return;
    }

    const dropEl = findDropTarget(e.clientX, e.clientY);
    const moved =
      dropEl && wasDrag.src ? opts.tryDrop(wasDrag.src, dropEl) : false;
    clearVisuals();
    if (moved && opts.onAfter) opts.onAfter();
  }

  function findDropTarget(x: number, y: number): HTMLElement | null {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (!(el as Element).closest) continue;
      if ((el as Element).classList?.contains("dragging")) continue;
      const slot = (el as Element).closest(".pile-slot") as HTMLElement | null;
      if (slot) return slot;
    }
    return null;
  }

  function attach(): void {
    boardEl.addEventListener("pointerdown", onPointerDown);
  }

  function destroy(): void {
    if (drag) abort();
    boardEl.removeEventListener("pointerdown", onPointerDown);
  }

  return { attach, destroy, abort };
}
