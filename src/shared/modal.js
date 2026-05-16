/* ---------- Shared modal dialog ---------- */
(function () {
  let primaryClickHandler = null;

  function show({ title, html, buttons }) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-content").innerHTML = html;
    const row = document.getElementById("modal-buttons");
    row.innerHTML = "";
    primaryClickHandler = null;
    (buttons || [{ label: "OK", onClick: close }]).forEach((b) => {
      const btn = document.createElement("button");
      btn.textContent = b.label;
      if (b.primary) {
        btn.autofocus = true;
        primaryClickHandler = b.onClick;
      }
      btn.addEventListener("click", b.onClick);
      row.appendChild(btn);
    });
    document.getElementById("modal-root").classList.remove("hidden");
  }

  function close() {
    document.getElementById("modal-root").classList.add("hidden");
    primaryClickHandler = null;
  }

  function isOpen() {
    return !document.getElementById("modal-root").classList.contains("hidden");
  }

  function activatePrimary() {
    if (primaryClickHandler) {
      primaryClickHandler();
    } else {
      const btns = document.querySelectorAll("#modal-buttons button");
      if (btns[0]) btns[0].click();
    }
  }

  function init() {
    const closeBtn = document.getElementById("modal-close");
    if (closeBtn) closeBtn.addEventListener("click", close);
  }

  window.Modal = { show, close, isOpen, activatePrimary, init };
})();
