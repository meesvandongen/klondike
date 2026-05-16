/* ---------- Shared "dealing..." overlay ---------- */
(function () {
  function show(label) {
    const el = document.getElementById("dealing-overlay");
    if (!el) return;
    if (label) {
      const lbl = el.querySelector(".dealing-label");
      if (lbl) lbl.textContent = label;
    }
    el.classList.remove("hidden");
  }
  function hide() {
    const el = document.getElementById("dealing-overlay");
    if (el) el.classList.add("hidden");
  }
  window.Overlay = { show, hide };
})();
