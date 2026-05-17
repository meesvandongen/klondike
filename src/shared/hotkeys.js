/* ---------- Shared keyboard hotkey handler ---------- */
(function () {
  const MB = window.MenuBridge;
  const M = window.Modal;

  /**
   * Bind window-level keydown shortcuts.
   * bindings: { 'F2': 'new-game', 'ctrl+z': 'undo', 'h': 'hint', ... }
   *   keys are case-insensitive; "ctrl+" maps to ctrlKey OR metaKey.
   */
  function bind(bindings) {
    const norm = {};
    for (const [k, action] of Object.entries(bindings)) {
      norm[k.toLowerCase()] = action;
    }

    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

      if (M && M.isOpen()) {
        if (e.key === "Escape") {
          e.preventDefault();
          M.close();
        } else if (e.key === "Enter") {
          e.preventDefault();
          M.activatePrimary();
        }
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const key = (e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase());
      const combo = (ctrl ? "ctrl+" : "") + (e.altKey ? "alt+" : "") + (e.shiftKey ? "shift+" : "") + key;
      const action = norm[combo];
      if (action) {
        e.preventDefault();
        MB.fire(action);
      }
    });
  }

  window.Hotkeys = { bind };
})();
