/* ---------- Shared zoom level ----------
 * Scales the layout by mutating CSS variables instead of using the
 * non-standard `zoom` property. Keeps drag/pointer math correct
 * because everything stays in real CSS pixels.
 */
(function () {
  const MIN = 0.5;
  const MAX = 2.0;
  const STEP = 0.1;

  // Base sizes (must match :root defaults in shared/styles.css).
  // Everything is in CSS pixels; the apply() function multiplies each
  // base by the current zoom level so cards keep the same proportions
  // and the visible fan-up slice stays at the same fraction of card-h.
  const BASE = {
    "--card-w": 96,
    "--card-h": 134,
    "--card-radius": 7,
    "--card-top-h": 40,
    "--corner-w": 20,
    "--tableau-fan-up": 40,
    "--tableau-fan-down": 13,
    "--pile-gap": 18,
    "--corner-rank-size": 18,
    "--corner-suit-size": 14,
    "--peaks-row-y": 34,
    "--pyramid-row-y": 38,
    "--pyramid-col-gap": 6
  };

  function clamp(level) {
    return Math.max(MIN, Math.min(MAX, Math.round(level * 100) / 100));
  }

  function apply(level) {
    const z = clamp(level);
    const root = document.documentElement;
    for (const [name, base] of Object.entries(BASE)) {
      root.style.setProperty(name, `${base * z}px`);
    }
    root.dataset.zoom = String(z);
    return z;
  }

  /**
   * install({ initial, onChange })
   *   initial: starting zoom level
   *   onChange: called after a successful zoom change, receives new level
   *
   * Registers the menu actions "zoom-in", "zoom-out", and "zoom-reset"
   * with the shared MenuBridge so menu clicks and hotkeys both work.
   * Returns { get, set } for the caller.
   */
  function install({ initial = 1, onChange } = {}) {
    let level = apply(initial);

    function set(next) {
      const z = clamp(next);
      if (z === level) return;
      level = apply(z);
      if (onChange) onChange(level);
    }

    const MB = window.MenuBridge;
    if (MB) {
      MB.register("zoom-in", () => set(level + STEP));
      MB.register("zoom-out", () => set(level - STEP));
      MB.register("zoom-reset", () => set(1));
    }
    return { get: () => level, set };
  }

  window.Zoom = { apply, clamp, install, MIN, MAX, STEP };
})();
