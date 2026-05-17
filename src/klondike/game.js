/* ---------- Klondike game engine ---------- */
/* Exposes window.Klondike */
(function () {
  const SUITS = ["S", "H", "D", "C"]; // Spades, Hearts, Diamonds, Clubs
  const RANKS = [
    "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"
  ];

  const SUIT_COLOR = { S: "black", C: "black", H: "red", D: "red" };
  const SUIT_GLYPH = { S: "♠", C: "♣", H: "♥", D: "♦" };

  function rankValue(r) {
    return RANKS.indexOf(r) + 1; // 1..13
  }

  function makeDeck() {
    const deck = [];
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push({ id: r + s, rank: r, suit: s, faceUp: false });
      }
    }
    return deck;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function newState(opts = {}) {
    const draw = opts.draw || 1;
    const deck = shuffle(makeDeck());

    const tableau = [[], [], [], [], [], [], []];
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck.pop();
        card.faceUp = row === col;
        tableau[col].push(card);
      }
    }

    const stock = deck.map((c) => ({ ...c, faceUp: false }));
    const waste = [];
    const foundations = [[], [], [], []];

    return {
      tableau,
      stock,
      waste,
      foundations,
      draw,
      score: 0,
      moves: 0,
      startedAt: Date.now(),
      history: [],
      finishedAt: null,
      stockRecycled: 0
    };
  }

  function snapshot(state) {
    return {
      tableau: state.tableau.map((c) => c.map((x) => ({ ...x }))),
      stock: state.stock.map((x) => ({ ...x })),
      waste: state.waste.map((x) => ({ ...x })),
      foundations: state.foundations.map((c) => c.map((x) => ({ ...x }))),
      score: state.score,
      moves: state.moves,
      stockRecycled: state.stockRecycled
    };
  }

  function restore(state, snap) {
    state.tableau = snap.tableau.map((c) => c.map((x) => ({ ...x })));
    state.stock = snap.stock.map((x) => ({ ...x }));
    state.waste = snap.waste.map((x) => ({ ...x }));
    state.foundations = snap.foundations.map((c) => c.map((x) => ({ ...x })));
    state.score = snap.score;
    state.moves = snap.moves;
    state.stockRecycled = snap.stockRecycled;
  }

  function pushHistory(state) {
    state.history.push(snapshot(state));
    if (state.history.length > 200) state.history.shift();
  }

  function undo(state) {
    const snap = state.history.pop();
    if (!snap) return false;
    restore(state, snap);
    return true;
  }

  function canPlaceOnFoundation(card, pile) {
    if (pile.length === 0) return card.rank === "A";
    const top = pile[pile.length - 1];
    return card.suit === top.suit && rankValue(card.rank) === rankValue(top.rank) + 1;
  }

  function canPlaceOnTableau(card, pile) {
    if (pile.length === 0) return card.rank === "K";
    const top = pile[pile.length - 1];
    if (!top.faceUp) return false;
    return (
      SUIT_COLOR[card.suit] !== SUIT_COLOR[top.suit] &&
      rankValue(card.rank) === rankValue(top.rank) - 1
    );
  }

  function isValidSequence(cards) {
    // Sequence is alternating-color descending, all face up.
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].faceUp) return false;
      if (i > 0) {
        const prev = cards[i - 1];
        const cur = cards[i];
        if (SUIT_COLOR[prev.suit] === SUIT_COLOR[cur.suit]) return false;
        if (rankValue(cur.rank) !== rankValue(prev.rank) - 1) return false;
      }
    }
    return true;
  }

  /* ----- Sources ----- */

  function getSource(state, src) {
    switch (src.pile) {
      case "tableau":
        return state.tableau[src.index];
      case "waste":
        return state.waste;
      case "foundation":
        return state.foundations[src.index];
      case "stock":
        return state.stock;
      default:
        return null;
    }
  }

  /**
   * Take a slice of cards from `src` starting at `src.cardIndex` to top.
   * Returns the slice without mutating; caller is responsible for the move.
   */
  function topSlice(state, src) {
    const pile = getSource(state, src);
    if (!pile) return null;
    const start = src.cardIndex == null ? pile.length - 1 : src.cardIndex;
    if (start < 0 || start >= pile.length) return null;
    return pile.slice(start);
  }

  /* ----- Moves ----- */

  function dealFromStock(state) {
    pushHistory(state);
    if (state.stock.length === 0) {
      if (state.waste.length === 0) {
        state.history.pop();
        return false;
      }
      while (state.waste.length) {
        const c = state.waste.pop();
        c.faceUp = false;
        state.stock.push(c);
      }
      state.stockRecycled += 1;
      // Vegas-style penalty omitted; Microsoft Klondike charges -100 on redeal in draw-3
      if (state.draw === 3) state.score = Math.max(0, state.score - 20);
      else state.score = Math.max(0, state.score - 100);
      state.moves += 1;
      return true;
    }

    const n = Math.min(state.draw, state.stock.length);
    for (let i = 0; i < n; i++) {
      const c = state.stock.pop();
      c.faceUp = true;
      state.waste.push(c);
    }
    state.moves += 1;
    return true;
  }

  /**
   * Attempt to move card(s) from `src` to `dst`.
   * Returns true on success.
   */
  function move(state, src, dst) {
    const slice = topSlice(state, src);
    if (!slice || slice.length === 0) return false;
    const moving = slice[0];

    // can't move from stock directly
    if (src.pile === "stock") return false;

    // multi-card moves only allowed to tableau, and only valid sequences
    if (slice.length > 1) {
      if (dst.pile !== "tableau") return false;
      if (!isValidSequence(slice)) return false;
    }

    let ok = false;
    if (dst.pile === "foundation") {
      if (slice.length !== 1) return false;
      ok = canPlaceOnFoundation(moving, state.foundations[dst.index]);
    } else if (dst.pile === "tableau") {
      ok = canPlaceOnTableau(moving, state.tableau[dst.index]);
    }

    if (!ok) return false;

    pushHistory(state);

    const srcPile = getSource(state, src);
    const removed = srcPile.splice(srcPile.length - slice.length, slice.length);

    let dstPile;
    if (dst.pile === "foundation") {
      dstPile = state.foundations[dst.index];
      state.score += 10; // any -> foundation
      if (src.pile === "tableau") state.score += 0;
      if (src.pile === "waste") state.score += 0;
    } else {
      dstPile = state.tableau[dst.index];
      if (src.pile === "foundation") state.score = Math.max(0, state.score - 15);
      if (src.pile === "waste") state.score += 5;
    }

    for (const c of removed) dstPile.push(c);

    // flip newly exposed tableau card
    if (src.pile === "tableau") {
      const exposed = state.tableau[src.index];
      const top = exposed[exposed.length - 1];
      if (top && !top.faceUp) {
        top.faceUp = true;
        state.score += 5;
      }
    }

    state.moves += 1;
    return true;
  }

  /**
   * Smart auto-move: send the card (or sequence) at `src.cardIndex` to the
   * best target. Single cards prefer the foundations; multi-card stacks go
   * to a valid tableau column.
   */
  function autoMove(state, src) {
    const pile = getSource(state, src);
    if (!pile || pile.length === 0) return false;
    const startIdx = src.cardIndex == null ? pile.length - 1 : src.cardIndex;
    if (startIdx < 0 || startIdx >= pile.length) return false;

    const slice = pile.slice(startIdx);
    const moving = slice[0];
    if (!moving.faceUp) return false;
    if (slice.length > 1 && !isValidSequence(slice)) return false;

    const moveTo = (dst) =>
      move(state, { pile: src.pile, index: src.index, cardIndex: startIdx }, dst);

    // Foundation only accepts single cards.
    if (slice.length === 1) {
      for (let i = 0; i < 4; i++) {
        if (canPlaceOnFoundation(moving, state.foundations[i])) {
          return moveTo({ pile: "foundation", index: i });
        }
      }
    }

    // Tableau: prefer non-empty matching columns, then empty columns for Ks.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 7; i++) {
        if (src.pile === "tableau" && i === src.index) continue;
        const dstPile = state.tableau[i];
        if (pass === 0 && dstPile.length === 0) continue;
        if (pass === 1 && dstPile.length > 0) continue;
        if (canPlaceOnTableau(moving, dstPile)) {
          return moveTo({ pile: "tableau", index: i });
        }
      }
    }
    return false;
  }

  function isWon(state) {
    return state.foundations.every((p) => p.length === 13);
  }

  /**
   * Iterate one auto-complete step. Returns true if a card was moved.
   * Only runs when all tableau face-down cards are flipped.
   */
  function autoCompleteStep(state) {
    const allFaceUp = state.tableau.every((p) => p.every((c) => c.faceUp));
    if (!allFaceUp) return false;

    let candidates = [];
    for (let i = 0; i < 7; i++) {
      const p = state.tableau[i];
      if (p.length) candidates.push({ pile: "tableau", index: i, card: p[p.length - 1], cardIndex: p.length - 1 });
    }
    if (state.waste.length) {
      candidates.push({ pile: "waste", index: 0, card: state.waste[state.waste.length - 1], cardIndex: state.waste.length - 1 });
    }

    // prefer lowest-rank candidate first
    candidates.sort((a, b) => rankValue(a.card.rank) - rankValue(b.card.rank));

    for (const c of candidates) {
      for (let f = 0; f < 4; f++) {
        if (canPlaceOnFoundation(c.card, state.foundations[f])) {
          return move(
            state,
            { pile: c.pile, index: c.index, cardIndex: c.cardIndex },
            { pile: "foundation", index: f }
          );
        }
      }
    }
    return false;
  }

  /**
   * Vista safety rule: a card can be sent to its foundation automatically if
   * no tableau pile could legally place it below another card later. Aces and
   * 2s are always safe; for rank R >= 3 both opposite-colour (R-1) cards must
   * already be on a foundation.
   */
  function isSafeToAutoPlay(state, card) {
    const r = rankValue(card.rank);
    if (r <= 2) return true;
    const oppSuits = SUIT_COLOR[card.suit] === "red" ? ["S", "C"] : ["H", "D"];
    for (const s of oppSuits) {
      let top = null;
      for (const pile of state.foundations) {
        if (pile.length && pile[0].suit === s) {
          top = pile[pile.length - 1];
          break;
        }
      }
      if (!top || rankValue(top.rank) < r - 1) return false;
    }
    return true;
  }

  /**
   * Send one safe candidate to its foundation. Returns true if a move was
   * applied. Unlike autoCompleteStep this works even when face-down cards
   * remain in the tableau — it only sends cards no tableau move could need.
   */
  function safeAutoStep(state) {
    const candidates = [];
    if (state.waste.length) {
      candidates.push({
        card: state.waste[state.waste.length - 1],
        src: { pile: "waste", index: 0, cardIndex: state.waste.length - 1 }
      });
    }
    for (let i = 0; i < 7; i++) {
      const p = state.tableau[i];
      if (p.length && p[p.length - 1].faceUp) {
        candidates.push({
          card: p[p.length - 1],
          src: { pile: "tableau", index: i, cardIndex: p.length - 1 }
        });
      }
    }
    candidates.sort((a, b) => rankValue(a.card.rank) - rankValue(b.card.rank));
    for (const c of candidates) {
      if (!isSafeToAutoPlay(state, c.card)) continue;
      for (let f = 0; f < 4; f++) {
        if (canPlaceOnFoundation(c.card, state.foundations[f])) {
          return move(state, c.src, { pile: "foundation", index: f });
        }
      }
    }
    return false;
  }

  /**
   * Suggest a hint: returns { src, dst } or null.
   */
  function hint(state) {
    // 1. Anything to foundation
    const tops = [];
    for (let i = 0; i < 7; i++) {
      const p = state.tableau[i];
      if (p.length) tops.push({ pile: "tableau", index: i, card: p[p.length - 1], cardIndex: p.length - 1 });
    }
    if (state.waste.length)
      tops.push({
        pile: "waste",
        index: 0,
        card: state.waste[state.waste.length - 1],
        cardIndex: state.waste.length - 1
      });

    for (const t of tops) {
      if (!t.card.faceUp) continue;
      for (let f = 0; f < 4; f++) {
        if (canPlaceOnFoundation(t.card, state.foundations[f])) {
          return {
            src: { pile: t.pile, index: t.index, cardIndex: t.cardIndex },
            dst: { pile: "foundation", index: f }
          };
        }
      }
    }

    // 2. Tableau -> tableau that exposes a face-down card
    for (let i = 0; i < 7; i++) {
      const p = state.tableau[i];
      // find first face-up card in column
      let firstFaceUp = -1;
      for (let k = 0; k < p.length; k++) {
        if (p[k].faceUp) {
          firstFaceUp = k;
          break;
        }
      }
      if (firstFaceUp <= 0) continue; // either none or no face-down beneath
      const slice = p.slice(firstFaceUp);
      if (!isValidSequence(slice)) continue;
      for (let j = 0; j < 7; j++) {
        if (j === i) continue;
        if (canPlaceOnTableau(slice[0], state.tableau[j])) {
          return {
            src: { pile: "tableau", index: i, cardIndex: firstFaceUp },
            dst: { pile: "tableau", index: j }
          };
        }
      }
    }

    // 3. Waste -> tableau
    if (state.waste.length) {
      const c = state.waste[state.waste.length - 1];
      for (let j = 0; j < 7; j++) {
        if (canPlaceOnTableau(c, state.tableau[j])) {
          return {
            src: { pile: "waste", index: 0, cardIndex: state.waste.length - 1 },
            dst: { pile: "tableau", index: j }
          };
        }
      }
    }

    // 4. Tableau -> tableau king-to-empty (only if it helps free a face-down)
    for (let i = 0; i < 7; i++) {
      const p = state.tableau[i];
      let firstFaceUp = -1;
      for (let k = 0; k < p.length; k++) if (p[k].faceUp) { firstFaceUp = k; break; }
      if (firstFaceUp <= 0) continue;
      if (p[firstFaceUp].rank !== "K") continue;
      for (let j = 0; j < 7; j++) {
        if (j === i) continue;
        if (state.tableau[j].length === 0) {
          return {
            src: { pile: "tableau", index: i, cardIndex: firstFaceUp },
            dst: { pile: "tableau", index: j }
          };
        }
      }
    }

    return null;
  }

  window.Klondike = {
    SUITS,
    RANKS,
    SUIT_COLOR,
    SUIT_GLYPH,
    rankValue,
    newState,
    dealFromStock,
    move,
    autoMove,
    autoCompleteStep,
    safeAutoStep,
    isSafeToAutoPlay,
    hint,
    undo,
    isWon,
    isValidSequence,
    canPlaceOnFoundation,
    canPlaceOnTableau
  };
})();
