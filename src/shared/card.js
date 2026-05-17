/* ---------- Shared card DOM rendering ----------
 * Vista-style card. Top-left "index" stacks rank above the suit pip
 * vertically; bottom-right shows a rotated mirror with the same font
 * sizes. The body fills the entire card (CSS grid, body spans every
 * row) with the rank's pip pattern (or a big suit for the Ace, or the
 * K/Q/J ornament). Corner indices overlay the body at higher z-index.
 *
 * Card stacking exposes the top --card-top-h pixels of each card,
 * which is exactly the corner index area.
 */
(function () {
  const D = window.Deck;

  function escapeSvg(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ----- Pip layouts -----
   * The body SVG uses viewBox "0 0 100 140" so its aspect ratio matches
   * the card itself (96:134 ≈ 100:140). The body fills the whole card
   * height, with the top corner index occupying roughly y∈[0, 42] and
   * the bottom corner mirror occupying y∈[98, 140]. Pips therefore
   * sit in y∈[44, 96] so they don't clash with the corner indices.
   * `r: true` rotates that pip 180° (bottom half mirrored).
   */
  const PIP_LAYOUTS = {
    "2":  [[50, 55], [50, 85, true]],
    "3":  [[50, 55], [50, 70], [50, 85, true]],
    "4":  [[33, 55], [67, 55], [33, 85, true], [67, 85, true]],
    "5":  [[33, 55], [67, 55], [50, 70], [33, 85, true], [67, 85, true]],
    "6":  [[33, 55], [67, 55], [33, 70], [67, 70], [33, 85, true], [67, 85, true]],
    "7":  [[33, 53], [67, 53], [50, 61], [33, 70], [67, 70], [33, 87, true], [67, 87, true]],
    "8":  [[33, 52], [67, 52], [50, 60], [33, 70], [67, 70], [50, 80, true], [33, 88, true], [67, 88, true]],
    "9":  [[33, 50], [67, 50], [33, 61], [67, 61], [50, 70], [33, 79, true], [67, 79, true], [33, 90, true], [67, 90, true]],
    "10": [[33, 49], [67, 49], [50, 55], [33, 63], [67, 63], [33, 77, true], [67, 77, true], [50, 85, true], [33, 91, true], [67, 91, true]]
  };

  // Pip glyph font-size in viewBox units. The body region is roughly
  // 56 viewBox units tall (between the two 42-unit corner regions),
  // so the multi-row layouts need smaller glyphs to avoid overlap.
  const PIP_SIZE = {
    "2": 26, "3": 22, "4": 22, "5": 18, "6": 18, "7": 16, "8": 16, "9": 15, "10": 13
  };

  // Center of the body region in the viewBox — roughly card center.
  const BODY_MID_Y = 70;

  function pipsSvg(rank, suit) {
    const color = D.SUIT_COLOR[suit] === "red" ? "#c11414" : "#1a1a1a";
    const glyph = escapeSvg(D.SUIT_GLYPH[suit]);
    const size = PIP_SIZE[rank] || 18;
    const pips = PIP_LAYOUTS[rank].map(([x, y, rot]) => {
      const t = rot ? ` transform="rotate(180 ${x} ${y})"` : "";
      return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central"
              font-size="${size}" fill="${color}"${t}>${glyph}</text>`;
    }).join("");
    return `<svg viewBox="0 0 100 140" preserveAspectRatio="none"
                 xmlns="http://www.w3.org/2000/svg">${pips}</svg>`;
  }

  function aceSvg(suit) {
    const color = D.SUIT_COLOR[suit] === "red" ? "#c11414" : "#1a1a1a";
    const glyph = escapeSvg(D.SUIT_GLYPH[suit]);
    return `<svg viewBox="0 0 100 140" preserveAspectRatio="none"
                 xmlns="http://www.w3.org/2000/svg">
      <text x="50" y="${BODY_MID_Y}" text-anchor="middle" dominant-baseline="central"
            font-size="50" fill="${color}">${glyph}</text>
    </svg>`;
  }

  function faceCardSvg(rank, suit) {
    const color = D.SUIT_COLOR[suit] === "red" ? "#c11414" : "#1a1a1a";
    const accent = D.SUIT_COLOR[suit] === "red" ? "#8a0c0c" : "#404040";

    let ornament = "";
    if (rank === "K") {
      ornament = `
        <g transform="translate(50 ${BODY_MID_Y - 4})">
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
        <g transform="translate(50 ${BODY_MID_Y - 2})">
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
        <g transform="translate(50 ${BODY_MID_Y + 2})">
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
      <svg viewBox="0 0 100 140" preserveAspectRatio="none"
           xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="44" width="88" height="52" fill="none" rx="4"
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
