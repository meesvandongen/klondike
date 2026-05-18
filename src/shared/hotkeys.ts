import { fire } from "./menu";
import { activatePrimary, close as closeModal, isOpen as isModalOpen } from "./Modal";

/**
 * Bind window-level keydown shortcuts.
 *   bindings: { 'F2': 'new-game', 'ctrl+z': 'undo', 'h': 'hint', ... }
 * Keys are case-insensitive; "ctrl+" maps to ctrlKey OR metaKey.
 */
export function bind(bindings: Record<string, string>): void {
  const norm: Record<string, string> = {};
  for (const [k, action] of Object.entries(bindings)) {
    norm[k.toLowerCase()] = action;
  }

  window.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
      return;
    }

    if (isModalOpen()) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      } else if (e.key === "Enter") {
        e.preventDefault();
        activatePrimary();
      }
      return;
    }

    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const combo =
      (ctrl ? "ctrl+" : "") +
      (e.altKey ? "alt+" : "") +
      (e.shiftKey ? "shift+" : "") +
      key;
    const action = norm[combo];
    if (action) {
      e.preventDefault();
      fire(action);
    }
  });
}
