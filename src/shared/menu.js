/* ---------- Shared Tauri menu listener + action dispatcher ---------- */
(function () {
  // Registered { id -> () => void }. Games call register(id, fn).
  const actions = {};
  const lastFiredAt = new Map();

  function register(id, fn) {
    actions[id] = fn;
  }
  function registerMany(map) {
    Object.assign(actions, map);
  }

  function fire(id) {
    const fn = actions[id];
    if (!fn) return;
    const now = Date.now();
    if (now - (lastFiredAt.get(id) || 0) < 200) return;
    lastFiredAt.set(id, now);
    fn();
  }

  async function wire() {
    const t = window.__TAURI__;
    if (!t || !t.event || !t.event.listen) return;
    try {
      await t.event.listen("menu", (event) => {
        const id = typeof event.payload === "string"
          ? event.payload
          : event.payload && event.payload.id;
        if (id) fire(id);
      });
    } catch (_) {}
  }

  window.MenuBridge = { register, registerMany, fire, wire };
})();
