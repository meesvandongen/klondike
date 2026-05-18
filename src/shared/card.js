/* ---------- Shared card DOM rendering ----------
 * Vista-style card with a 3-column CSS grid: left column for the
 * top-left index, right column for the bottom-right (rotated) index,
 * and a centre column whose body spans the entire card so the pip
 * pattern / Ace / face-card ornament can stretch from edge to edge.
 *
 * Suit shapes are drawn as SVG paths (not text glyphs) so size and
 * placement are exact at any zoom — Unicode font glyphs render with
 * font-dependent metrics that make the actual icon noticeably
 * smaller than the font-size and inconsistent across platforms.
 *
 * Card stacking exposes the top --card-top-h pixels of each card,
 * which lines up with the corner index height.
 */
(function () {
  const D = window.Deck;

  /* ----- Suit shapes -----
   *
   * Each suit is defined in a 0..100 unit box with the visual centre
   * at (50, 50). Heart/Diamond/Spade are single closed paths; Club
   * is composed of three circles plus a triangular stem (all filled
   * with the suit colour by the parent <g>).
   *
   * The bounding box of each shape sits roughly at x∈[8, 92] and
   * y∈[8, 92], so a unit pip drawn with no scaling occupies almost
   * the full 100×100 box. Scaling is applied by the caller.
   */
  const SUIT_SHAPE = {
    H:
      '<path d="M50 92 C2 62 2 12 26 12 C38 12 50 22 50 36 ' +
      'C50 22 62 12 74 12 C98 12 98 62 50 92 Z"/>',
    D:
      '<path d="M50 4 L94 50 L50 96 L6 50 Z"/>',
    S:
      '<path d="M50 6 C96 30 96 62 50 72 C4 62 4 30 50 6 Z ' +
      'M32 94 L50 72 L68 94 Z"/>',
    C:
      '<circle cx="50" cy="22" r="19"/>' +
      '<circle cx="26" cy="56" r="19"/>' +
      '<circle cx="74" cy="56" r="19"/>' +
      '<path d="M44 68 C44 78 40 88 30 94 L70 94 C60 88 56 78 56 68 Z"/>',
  };

  function suitColor(suit) {
    return D.SUIT_COLOR[suit] === "red" ? "#c11414" : "#1a1a1a";
  }

  /**
   * Render a single suit pip at (cx, cy) in viewBox units, scaled
   * uniformly so its bounding box is `size` units wide and tall.
   * `rotated` flips it 180° around its own centre (used for the
   * bottom half of even-pip layouts).
   */
  function pipNode(suit, cx, cy, size, rotated) {
    const s = size / 100;
    const sx = rotated ? -s : s;
    const sy = rotated ? -s : s;
    return (
      `<g transform="translate(${cx} ${cy}) scale(${sx} ${sy}) translate(-50 -50)">` +
      SUIT_SHAPE[suit] +
      "</g>"
    );
  }

  /* ----- Pip layouts -----
   * The body SVG uses viewBox "0 0 100 140" (matching the 96:134
   * card aspect). Because the body sits in the centre column of a
   * 3-column grid, the corner indices only block the top-left
   * (x<20, y<42) and bottom-right (x>80, y>98) viewBox rectangles —
   * the rest of the body is free for pip art. Pips therefore stretch
   * from y≈22 near the top to y≈118 near the bottom.
   *
   * `r: true` rotates that pip 180° (bottom half of an even layout).
   */
  const PIP_LAYOUTS = {
    "2":  [[50, 30], [50, 110, true]],
    "3":  [[50, 25], [50, 70], [50, 115, true]],
    "4":  [[35, 30], [65, 30], [35, 110, true], [65, 110, true]],
    "5":  [[35, 30], [65, 30], [50, 70], [35, 110, true], [65, 110, true]],
    "6":  [[35, 28], [65, 28], [35, 70], [65, 70], [35, 112, true], [65, 112, true]],
    "7":  [[35, 25], [65, 25], [50, 46], [35, 70], [65, 70], [35, 115, true], [65, 115, true]],
    "8":  [[35, 25], [65, 25], [50, 46], [35, 70], [65, 70], [50, 94, true], [35, 115, true], [65, 115, true]],
    "9":  [[35, 24], [65, 24], [35, 50], [65, 50], [50, 70], [35, 90, true], [65, 90, true], [35, 116, true], [65, 116, true]],
    "10": [[35, 22], [65, 22], [50, 40], [35, 58], [65, 58], [35, 82, true], [65, 82, true], [50, 100, true], [35, 118, true], [65, 118, true]]
  };

  // Pip size (viewBox units) per rank — generous for small counts,
  // scaled down for high counts so adjacent rows don't crowd each
  // other. With SVG-path pips the visible glyph fills the size box
  // (no font padding), so these are noticeably bigger than the old
  // text-glyph equivalents at the same number.
  const PIP_SIZE = {
    "2": 48, "3": 40, "4": 38, "5": 32, "6": 30, "7": 26, "8": 24, "9": 22, "10": 18
  };

  // Centre of the card in the viewBox.
  const BODY_MID_Y = 70;

  function pipsSvg(rank, suit) {
    const color = suitColor(suit);
    const size = PIP_SIZE[rank] || 18;
    const pips = PIP_LAYOUTS[rank]
      .map(([x, y, rot]) => pipNode(suit, x, y, size, !!rot))
      .join("");
    return (
      `<svg viewBox="0 0 100 140" preserveAspectRatio="none" ` +
      `xmlns="http://www.w3.org/2000/svg"><g fill="${color}">${pips}</g></svg>`
    );
  }

  function aceSvg(suit) {
    const color = suitColor(suit);
    return (
      `<svg viewBox="0 0 100 140" preserveAspectRatio="none" ` +
      `xmlns="http://www.w3.org/2000/svg"><g fill="${color}">` +
      pipNode(suit, 50, BODY_MID_Y, 90, false) +
      "</g></svg>"
    );
  }

  function faceCardSvg(rank, suit) {
    const color = suitColor(suit);
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

  /** Corner suit icon — same SVG path as the body pips, sized via
   * CSS width/height. The element is `display: block` so it stacks
   * cleanly under the rank text. */
  function cornerSuitSvg(suit) {
    const color = suitColor(suit);
    return (
      `<svg class="suit" viewBox="0 0 100 100" ` +
      `xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<g fill="${color}">${SUIT_SHAPE[suit]}</g></svg>`
    );
  }

  function indexHtml(card) {
    return `<span class="rank">${card.rank}</span>` + cornerSuitSvg(card.suit);
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
