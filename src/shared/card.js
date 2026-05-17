/* ---------- Shared card DOM rendering ----------
 * Vista-style card. Top-left "index" stacks rank above the suit pip
 * vertically; bottom-right shows a smaller rotated mirror. The body
 * fills the rest with the rank's pip pattern (or a big suit for the
 * Ace, or the K/Q/J ornament).
 *
 * Card stacking exposes the top --card-top-h pixels of each card,
 * which is exactly the index area.
 */
(function () {
  const D = window.Deck;

  function escapeSvg(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ----- Pip layouts -----
   * Coordinates are in a 100 x 100 viewBox that covers the body.
   * `r: true` rotates that pip 180° (bottom half mirrored).
   */
  const PIP_LAYOUTS = {
    "2":  [[50, 18], [50, 82, true]],
    "3":  [[50, 14], [50, 50], [50, 86, true]],
    "4":  [[30, 18], [70, 18], [30, 82, true], [70, 82, true]],
    "5":  [[30, 18], [70, 18], [50, 50], [30, 82, true], [70, 82, true]],
    "6":  [[30, 16], [70, 16], [30, 50], [70, 50], [30, 84, true], [70, 84, true]],
    "7":  [[30, 14], [70, 14], [50, 27], [30, 50], [70, 50], [30, 86, true], [70, 86, true]],
    "8":  [[30, 14], [70, 14], [50, 27], [30, 50], [70, 50], [50, 73, true], [30, 86, true], [70, 86, true]],
    "9":  [[30, 13], [70, 13], [30, 35], [70, 35], [50, 50], [30, 65, true], [70, 65, true], [30, 87, true], [70, 87, true]],
    "10": [[30, 12], [70, 12], [50, 22], [30, 34], [70, 34], [30, 66, true], [70, 66, true], [50, 78, true], [30, 88, true], [70, 88, true]]
  };

  const PIP_SIZE = {
    "2": 42, "3": 36, "4": 34, "5": 30, "6": 30, "7": 28, "8": 26, "9": 26, "10": 24
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
            font-size="72" fill="${color}">${glyph}</text>
    </svg>`;
  }

  function faceCardSvg(rank, suit) {
    const color = D.SUIT_COLOR[suit] === "red" ? "#c11414" : "#1a1a1a";
    const accent = D.SUIT_COLOR[suit] === "red" ? "#8a0c0c" : "#404040";

    let ornament = "";
    if (rank === "K") {
      ornament = `
        <g transform="translate(50 38)">
          <rect x="-24" y="6" width="48" height="6" fill="${color}"/>
          <path d="M -24 7 L -19 -10 L -10 5 L -3 -12 L 0 -18 L 3 -12 L 10 5 L 19 -10 L 24 7 Z"
                fill="${color}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>
          <circle cx="-19" cy="-10" r="3" fill="#fff" stroke="${color}" stroke-width="1.2"/>
          <circle cx="0" cy="-18" r="3.4" fill="#fff" stroke="${color}" stroke-width="1.2"/>
          <circle cx="19" cy="-10" r="3" fill="#fff" stroke="${color}" stroke-width="1.2"/>
          <path d="M 0 -18 L 0 -30 M -5 -25 L 5 -25"
                stroke="${color}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        </g>`;
    } else if (rank === "Q") {
      ornament = `
        <g transform="translate(50 40)">
          <rect x="-20" y="6" width="40" height="5" fill="${color}"/>
          <path d="M -20 7 L -15 -7 L -8 5 L 0 -12 L 8 5 L 15 -7 L 20 7 Z"
                fill="${color}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>
          <circle cx="-15" cy="-7" r="2.6" fill="#fff" stroke="${color}" stroke-width="1"/>
          <circle cx="0" cy="-12" r="3.2" fill="#fff" stroke="${color}" stroke-width="1"/>
          <circle cx="15" cy="-7" r="2.6" fill="#fff" stroke="${color}" stroke-width="1"/>
          <g transform="translate(0 -22)">
            <circle cx="0" cy="0" r="3" fill="${color}"/>
            <circle cx="-5" cy="2" r="2.6" fill="${color}"/>
            <circle cx="5" cy="2" r="2.6" fill="${color}"/>
            <circle cx="0" cy="5" r="2.6" fill="${color}"/>
          </g>
        </g>`;
    } else {
      // Jack — feathered plume
      ornament = `
        <g transform="translate(50 46)">
          <path d="M 0 -28 Q -10 -18 -8 -6 Q -13 1 -8 10 Q -3 18 0 18 Q 3 18 8 10 Q 13 1 8 -6 Q 10 -18 0 -28 Z"
                fill="${color}" stroke="${accent}" stroke-width="1" stroke-linejoin="round"/>
          <path d="M 0 -28 L 0 16" stroke="${accent}" stroke-width="0.9" fill="none"/>
          <path d="M -3 -19 Q -1 -18 0 -16 M 3 -19 Q 1 -18 0 -16"
                stroke="${accent}" stroke-width="0.6" fill="none"/>
          <path d="M -6 -4 Q -2 -2 0 -1 M 6 -4 Q 2 -2 0 -1"
                stroke="${accent}" stroke-width="0.6" fill="none"/>
        </g>`;
    }

    return `
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
           xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="88" height="88" fill="none" rx="4"
              stroke="${color}" stroke-width="0.6" stroke-opacity="0.4"/>
        ${ornament}
      </svg>`;
  }

  function bodyArt(rank, suit) {
    if (rank === "J" || rank === "Q" || rank === "K") return faceCardSvg(rank, suit);
    if (rank === "A") return aceSvg(suit);
    return pipsSvg(rank, suit);
  }

  function indexHtml(card) {
    return (
      `<span class="rank">${card.rank}</span>` +
      `<span class="suit">${D.SUIT_GLYPH[card.suit]}</span>`
    );
  }

  function createCardElement(card) {
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.cardId = card.id;
    if (!card.faceUp) {
      el.classList.add("face-down");
      return el;
    }

    el.classList.add("face-up", D.SUIT_COLOR[card.suit]);
    if (card.rank === "J" || card.rank === "Q" || card.rank === "K") {
      el.classList.add("face-card");
    }

    const idx = indexHtml(card);
    const top = document.createElement("div");
    top.className = "card-top";
    top.innerHTML = idx;

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = bodyArt(card.rank, card.suit);

    const bottom = document.createElement("div");
    bottom.className = "card-bottom";
    bottom.innerHTML = idx;

    el.appendChild(top);
    el.appendChild(body);
    el.appendChild(bottom);
    return el;
  }

  window.Card = { createCardElement, faceCardSvg, pipsSvg, aceSvg };
})();
