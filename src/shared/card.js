/* ---------- Shared card DOM rendering ---------- */
(function () {
  const D = window.Deck;

  function escapeSvg(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function faceCardSvg(rank, suit) {
    const color = D.SUIT_COLOR[suit] === "red" ? "#c11414" : "#1a1a1a";
    const accent = D.SUIT_COLOR[suit] === "red" ? "#8a0c0c" : "#404040";
    const suitGlyph = escapeSvg(D.SUIT_GLYPH[suit]);

    let ornament = "";
    if (rank === "K") {
      ornament = `
        <g transform="translate(50 30)">
          <rect x="-22" y="6" width="44" height="5" fill="${color}"/>
          <path d="M -22 7 L -18 -8 L -10 4 L -3 -10 L 0 -16 L 3 -10 L 10 4 L 18 -8 L 22 7 Z"
                fill="${color}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>
          <circle cx="-18" cy="-8" r="2.6" fill="#fff" stroke="${color}" stroke-width="1.2"/>
          <circle cx="0" cy="-16" r="3" fill="#fff" stroke="${color}" stroke-width="1.2"/>
          <circle cx="18" cy="-8" r="2.6" fill="#fff" stroke="${color}" stroke-width="1.2"/>
          <path d="M 0 -16 L 0 -26 M -4 -22 L 4 -22"
                stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
        </g>`;
    } else if (rank === "Q") {
      ornament = `
        <g transform="translate(50 32)">
          <rect x="-18" y="6" width="36" height="4" fill="${color}"/>
          <path d="M -18 7 L -14 -6 L -7 4 L 0 -10 L 7 4 L 14 -6 L 18 7 Z"
                fill="${color}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>
          <circle cx="-14" cy="-6" r="2.2" fill="#fff" stroke="${color}" stroke-width="1"/>
          <circle cx="0" cy="-10" r="2.8" fill="#fff" stroke="${color}" stroke-width="1"/>
          <circle cx="14" cy="-6" r="2.2" fill="#fff" stroke="${color}" stroke-width="1"/>
          <g transform="translate(0 -18)">
            <circle cx="0" cy="0" r="2.5" fill="${color}"/>
            <circle cx="-4" cy="2" r="2.2" fill="${color}"/>
            <circle cx="4" cy="2" r="2.2" fill="${color}"/>
            <circle cx="0" cy="4" r="2.2" fill="${color}"/>
          </g>
        </g>`;
    } else {
      ornament = `
        <g transform="translate(50 32)">
          <path d="M 0 -22 Q -7 -16 -6 -6 Q -10 0 -6 8 Q -3 14 0 14 Q 3 14 6 8 Q 10 0 6 -6 Q 7 -16 0 -22 Z"
                fill="${color}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>
          <path d="M 0 -22 L 0 12" stroke="${accent}" stroke-width="0.8" fill="none"/>
          <path d="M -3 -15 Q -1 -14 0 -12 M 3 -15 Q 1 -14 0 -12"
                stroke="${accent}" stroke-width="0.6" fill="none"/>
          <path d="M -4 -6 Q -2 -4 0 -3 M 4 -6 Q 2 -4 0 -3"
                stroke="${accent}" stroke-width="0.6" fill="none"/>
        </g>`;
    }

    return `
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="84" height="84" fill="none" rx="3"
              stroke="${color}" stroke-width="0.6" stroke-opacity="0.45"/>
        ${ornament}
        <text x="50" y="78" text-anchor="middle" font-family="Georgia, serif"
              font-weight="800" font-size="22" fill="${color}">${rank}</text>
        <text x="50" y="94" text-anchor="middle" font-size="16" fill="${color}">${suitGlyph}</text>
      </svg>`;
  }

  /** Build a DOM element for a card. */
  function createCardElement(card) {
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.cardId = card.id;
    if (!card.faceUp) {
      el.classList.add("face-down");
      return el;
    }

    el.classList.add("face-up", D.SUIT_COLOR[card.suit]);
    const isFace = card.rank === "J" || card.rank === "Q" || card.rank === "K";
    if (isFace) el.classList.add("face-card");

    const tl = document.createElement("div");
    tl.className = "corner tl";
    tl.innerHTML = `<span class="rank">${card.rank}</span><span class="suit">${D.SUIT_GLYPH[card.suit]}</span>`;
    const br = document.createElement("div");
    br.className = "corner br";
    br.innerHTML = `<span class="rank">${card.rank}</span><span class="suit">${D.SUIT_GLYPH[card.suit]}</span>`;
    const center = document.createElement("div");
    center.className = "center";
    if (isFace) {
      center.innerHTML = faceCardSvg(card.rank, card.suit);
    } else {
      center.textContent = D.SUIT_GLYPH[card.suit];
    }
    el.appendChild(tl);
    el.appendChild(br);
    el.appendChild(center);
    return el;
  }

  window.Card = { createCardElement, faceCardSvg };
})();
