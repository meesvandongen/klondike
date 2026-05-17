/* ---------- Shared Tauri menu listener + action dispatcher ----------
 * Actions are functions of (payload?). The payload is set when the menu
 * event carried structured data (e.g. CheckMenuItem state from Rust);
 * for plain menu items (or hotkey-triggered fires) payload is undefined.
 */
(function () {
  const actions = {};
  const lastFiredAt = new Map();

  function register(id, fn) {
    actions[id] = fn;
  }
  function registerMany(map) {
    Object.assign(actions, map);
  }

  function fire(id, payload) {
    const fn = actions[id];
    if (!fn) return;
    const now = Date.now();
    if (now - (lastFiredAt.get(id) || 0) < 200) return;
    lastFiredAt.set(id, now);
    fn(payload);
  }

  async function wire() {
    const t = window.__TAURI__;
    if (!t || !t.event || !t.event.listen) return;
    try {
      await t.event.listen("menu", (event) => {
        const p = event.payload;
        if (typeof p === "string") {
          fire(p);
        } else if (p && typeof p === "object" && typeof p.id === "string") {
          fire(p.id, p);
        }
      });
    } catch (_) {}
  }

  /** Convenience wrapper around the Tauri invoke API. */
  function invoke(name, args) {
    const t = window.__TAURI__;
    if (!t || !t.core || typeof t.core.invoke !== "function") return Promise.resolve();
    try {
      return t.core.invoke(name, args);
    } catch (_) {
      return Promise.resolve();
    }
  }

  window.MenuBridge = { register, registerMany, fire, wire, invoke };
})();
