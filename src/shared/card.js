/* ---------- Shared card DOM rendering ----------
 * Vista-style card: a flex column with a fixed-height top strip
 * (rank + suit glyph, side by side) and a body that holds the pip
 * pattern (for 2-10), a big suit (for A), or a face-card SVG (J/Q/K).
 *
 * Stacking a column fans cards down by --tableau-fan-up; that value
 * is matched to --card-top-h so the top strip is always fully
 * visible when a card sits under another.
 */
(function () {
  const D = window.Deck;

  function escapeSvg(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ----- Pip layouts -----
   * Coordinates are in a 100 x 100 SVG viewBox covering the body of the
   * card. `r: true` rotates that pip 180° (so the bottom half mirrors
   * the top, like classic playing cards).
   */
  const PIP_LAYOUTS = {
    "2":  [[50, 20], [50, 80, true]],
    "3":  [[50, 18], [50, 50], [50, 82, true]],
    "4":  [[32, 22], [68, 22], [32, 78, true], [68, 78, true]],
    "5":  [[32, 22], [68, 22], [50, 50], [32, 78, true], [68, 78, true]],
    "6":  [[32, 20], [68, 20], [32, 50], [68, 50], [32, 80, true], [68, 80, true]],
    "7":  [[32, 18], [68, 18], [50, 33], [32, 52], [68, 52], [32, 82, true], [68, 82, true]],
    "8":  [[32, 18], [68, 18], [50, 32], [32, 50], [68, 50], [50, 68, true], [32, 82, true], [68, 82, true]],
    "9":  [[32, 18], [68, 18], [32, 40], [68, 40], [50, 50], [32, 60, true], [68, 60, true], [32, 82, true], [68, 82, true]],
    "10": [[32, 16], [68, 16], [50, 28], [32, 40], [68, 40], [32, 60, true], [68, 60, true], [50, 72, true], [32, 84, true], [68, 84, true]]
  };

  const PIP_SIZE = {
    "2": 34, "3": 30, "4": 28, "5": 28, "6": 26, "7": 24, "8": 22, "9": 22, "10": 22
  };

  function pipsSvg(rank, suit) {
    const color = D.SUIT_COLOR[suit] === "red" ? "#c11414" : "#1a1a1a";
    const glyph = escapeSvg(D.SUIT_GLYPH[suit]);
    const size = PIP_SIZE[rank] || 24;
    const pips = PIP_LAYOUTS[rank].map(([x, y, rot]) => {
      const t = rot ? ` transform="rotate(180 ${x} ${y})"` : "";
      return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central"
              font-size="${size}" fill="${color}"${t}>${glyph}</text>`;
    }).join("");
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
                 xmlns="http://www.w3.org/2000/svg">${pips}</svg>`;
  }

  function aceSvg(suit) {
    const color = D.SUIT_COLOR[suit] === "red" ? "#c11414" : "#1a1a1a";
    const glyph = escapeSvg(D.SUIT_GLYPH[suit]);
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
                 xmlns="http://www.w3.org/2000/svg">
      <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
            font-size="64" fill="${color}">${glyph}</text>
    </svg>`;
  }

  function faceCardSvg(rank, suit) {
    const color = D.SUIT_COLOR[suit] === "red" ? "#c11414" : "#1a1a1a";
    const accent = D.SUIT_COLOR[suit] === "red" ? "#8a0c0c" : "#404040";
    const glyph = escapeSvg(D.SUIT_GLYPH[suit]);

    let ornament = "";
    if (rank === "K") {
      ornament = `
        <g transform="translate(50 38)">
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
        <g transform="translate(50 40)">
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
      // Jack
      ornament = `
        <g transform="translate(50 44)">
          <path d="M 0 -24 Q -8 -16 -7 -6 Q -11 0 -7 8 Q -3 16 0 16 Q 3 16 7 8 Q 11 0 7 -6 Q 8 -16 0 -24 Z"
                fill="${color}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>
          <path d="M 0 -24 L 0 14" stroke="${accent}" stroke-width="0.8" fill="none"/>
          <path d="M -3 -16 Q -1 -15 0 -13 M 3 -16 Q 1 -15 0 -13"
                stroke="${accent}" stroke-width="0.6" fill="none"/>
          <path d="M -5 -4 Q -2 -2 0 -1 M 5 -4 Q 2 -2 0 -1"
                stroke="${accent}" stroke-width="0.6" fill="none"/>
        </g>`;
    }

    return `
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
           xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="88" height="88" fill="none" rx="4"
              stroke="${color}" stroke-width="0.6" stroke-opacity="0.4"/>
        ${ornament}
        <text x="50" y="86" text-anchor="middle" font-family="Georgia, serif"
              font-weight="800" font-size="22" fill="${color}">${rank}</text>
      </svg>`;
  }

  function bodyArt(rank, suit) {
    const isFace = rank === "J" || rank === "Q" || rank === "K";
    if (isFace) return faceCardSvg(rank, suit);
    if (rank === "A") return aceSvg(suit);
    return pipsSvg(rank, suit);
  }

  function createCardElement(card) {
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.cardId = card.id;
    if (!card.faceUp) {
      el.classList.add("face-down");
      return el;
    }

    const colorClass = D.SUIT_COLOR[card.suit];
    el.classList.add("face-up", colorClass);
    if (card.rank === "J" || card.rank === "Q" || card.rank === "K") {
      el.classList.add("face-card");
    }

    const top = document.createElement("div");
    top.className = "card-top";
    top.innerHTML =
      `<span class="rank">${card.rank}</span>` +
      `<span class="suit">${D.SUIT_GLYPH[card.suit]}</span>`;

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = bodyArt(card.rank, card.suit);

    el.appendChild(top);
    el.appendChild(body);
    return el;
  }

  window.Card = { createCardElement, faceCardSvg, pipsSvg, aceSvg };
})();
