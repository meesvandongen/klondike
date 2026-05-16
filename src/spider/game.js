/* ---------- Spider (1-suit) engine ----------
 * Exposes window.Spider.
 *
 * 104 cards = 8 decks of 13 spades.
 * 10 tableau columns: cols 0-3 get 6 cards, cols 4-9 get 5 cards (54 cards).
 * Stock: 50 cards, dealt 10 at a time, one per column.
 * Completed K-down-to-A in-suit sequences are removed to the "completed" pile.
 * No foundations; win = 8 completed sequences.
 */
(function () {
  const D = window.Deck;
  const U = window.SolUtils;

  function makeDeck() {
    return D.makeDeck({ numDecks: 8, suits: ["S"] });
  }

  function newState() {
    const deck = U.shuffle(makeDeck());
    const tableau = [[], [], [], [], [], [], [], [], [], []];
    let idx = 0;
    for (let col = 0; col < 10; col++) {
      const n = col < 4 ? 6 : 5;
      for (let k = 0; k < n; k++) {
        const c = deck[idx++];
        c.faceUp = false;
        tableau[col].push(c);
      }
      // Top card face up
      tableau[col][tableau[col].length - 1].faceUp = true;
    }
    const stock = deck.slice(idx).map((c) => ({ ...c, faceUp: false }));
    return {
      tableau,
      stock,
      completed: 0, // number of finished K..A sequences
      score: 500,
      moves: 0,
      startedAt: Date.now(),
      finishedAt: null,
      history: []
    };
  }

  function snapshot(state) {
    return {
      tableau: state.tableau.map((c) => c.map((x) => ({ ...x }))),
      stock: state.stock.map((x) => ({ ...x })),
      completed: state.completed,
      score: state.score,
      moves: state.moves
    };
  }
  function restore(state, snap) {
    state.tableau = snap.tableau.map((c) => c.map((x) => ({ ...x })));
    state.stock = snap.stock.map((x) => ({ ...x }));
    state.completed = snap.completed;
    state.score = snap.score;
    state.moves = snap.moves;
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

  /** Run-of-same-suit descending sequence check.
   *  In 1-suit Spider every card has the same suit, so we only need descending ranks. */
  function isMovableRun(cards) {
    for (let i = 1; i < cards.length; i++) {
      if (cards[i].suit !== cards[i - 1].suit) return false;
      if (D.rankValue(cards[i].rank) !== D.rankValue(cards[i - 1].rank) - 1) return false;
      if (!cards[i].faceUp || !cards[i - 1].faceUp) return false;
    }
    return true;
  }

  /** Loose sequence: any descending sequence (color/suit ignored) — used to validate a drop. */
  function canPlaceOnTableau(card, pile) {
    if (pile.length === 0) return true; // any card to empty column
    const top = pile[pile.length - 1];
    if (!top.faceUp) return false;
    return D.rankValue(card.rank) === D.rankValue(top.rank) - 1;
  }

  function move(state, src, dst) {
    if (src.pile !== "tableau" || dst.pile !== "tableau") return false;
    const fromCol = state.tableau[src.index];
    const toCol = state.tableau[dst.index];
    const startIdx = src.cardIndex == null ? fromCol.length - 1 : src.cardIndex;
    if (startIdx < 0 || startIdx >= fromCol.length) return false;
    const slice = fromCol.slice(startIdx);
    if (!isMovableRun(slice)) return false;
    if (!canPlaceOnTableau(slice[0], toCol)) return false;
    if (src.index === dst.index) return false;

    pushHistory(state);
    fromCol.splice(startIdx);
    for (const c of slice) toCol.push(c);
    if (fromCol.length > 0 && !fromCol[fromCol.length - 1].faceUp) {
      fromCol[fromCol.length - 1].faceUp = true;
    }
    state.moves += 1;
    state.score = Math.max(0, state.score - 1);

    // Check completed sequence (K..A all same suit on the destination column).
    checkCompletion(state, dst.index);
    return true;
  }

  function checkCompletion(state, colIdx) {
    const col = state.tableau[colIdx];
    if (col.length < 13) return;
    const tail = col.slice(col.length - 13);
    if (!isMovableRun(tail)) return;
    if (tail[0].rank !== "K" || tail[12].rank !== "A") return;
    // Remove
    col.splice(col.length - 13, 13);
    state.completed += 1;
    state.score += 100;
    if (col.length > 0 && !col[col.length - 1].faceUp) {
      col[col.length - 1].faceUp = true;
    }
  }

  function autoMove(state, src) {
    if (src.pile !== "tableau") return false;
    const fromCol = state.tableau[src.index];
    const startIdx = src.cardIndex == null ? fromCol.length - 1 : src.cardIndex;
    if (startIdx < 0 || startIdx >= fromCol.length) return false;
    const slice = fromCol.slice(startIdx);
    if (!isMovableRun(slice)) return false;
    // Try moves: prefer columns where the bottom-of-slice extends an existing sequence with same-suit anchor,
    // then any matching rank, then empty columns.
    const moving = slice[0];
    // Pass 0: tableau with same-suit anchor
    for (let i = 0; i < 10; i++) {
      if (i === src.index) continue;
      const dst = state.tableau[i];
      if (dst.length === 0) continue;
      const top = dst[dst.length - 1];
      if (!top.faceUp) continue;
      if (D.rankValue(moving.rank) === D.rankValue(top.rank) - 1 && moving.suit === top.suit) {
        if (move(state, { pile: "tableau", index: src.index, cardIndex: startIdx },
                  { pile: "tableau", index: i })) return true;
      }
    }
    // Pass 1: any matching descending rank
    for (let i = 0; i < 10; i++) {
      if (i === src.index) continue;
      const dst = state.tableau[i];
      if (dst.length === 0) continue;
      if (canPlaceOnTableau(moving, dst)) {
        if (move(state, { pile: "tableau", index: src.index, cardIndex: startIdx },
                  { pile: "tableau", index: i })) return true;
      }
    }
    // Pass 2: empty columns (only if it leaves non-empty source - else it's a no-op shuffle)
    if (startIdx > 0 || slice.length < fromCol.length) {
      for (let i = 0; i < 10; i++) {
        if (i === src.index) continue;
        const dst = state.tableau[i];
        if (dst.length > 0) continue;
        if (move(state, { pile: "tableau", index: src.index, cardIndex: startIdx },
                  { pile: "tableau", index: i })) return true;
      }
    }
    return false;
  }

  function dealFromStock(state) {
    if (state.stock.length < 10) return false;
    // Rule: no empty columns allowed when dealing.
    if (state.tableau.some((c) => c.length === 0)) return false;
    pushHistory(state);
    for (let i = 0; i < 10; i++) {
      const c = state.stock.pop();
      c.faceUp = true;
      state.tableau[i].push(c);
      checkCompletion(state, i);
    }
    state.moves += 1;
    return true;
  }

  function isWon(state) {
    return state.completed === 8;
  }

  /** Auto-complete step: send a same-suit K..A sequence — only does anything if one is already nearly built. */
  function autoCompleteStep(state) {
    // No useful auto-complete for Spider beyond what happens automatically.
    // Try to find any move-to-foundation-equivalent — Spider has no foundation. Return false.
    return false;
  }

  function hint(state) {
    // 1. Move that completes a sequence (very rare to find exactly, but check matching same-suit anchors)
    for (let i = 0; i < 10; i++) {
      const col = state.tableau[i];
      if (!col.length) continue;
      let firstUp = -1;
      for (let k = 0; k < col.length; k++) if (col[k].faceUp) { firstUp = k; break; }
      if (firstUp < 0) continue;
      // Largest movable run starting at some k
      for (let k = firstUp; k < col.length; k++) {
        const slice = col.slice(k);
        if (!isMovableRun(slice)) continue;
        // Try every other column
        for (let j = 0; j < 10; j++) {
          if (j === i) continue;
          const dst = state.tableau[j];
          if (dst.length === 0) continue;
          const top = dst[dst.length - 1];
          if (!top.faceUp) continue;
          if (D.rankValue(slice[0].rank) === D.rankValue(top.rank) - 1 && slice[0].suit === top.suit) {
            return { src: { pile: "tableau", index: i, cardIndex: k }, dst: { pile: "tableau", index: j } };
          }
        }
        break; // pick the largest run from this column
      }
    }
    // 2. Any legal tableau move that flips a face-down card
    for (let i = 0; i < 10; i++) {
      const col = state.tableau[i];
      if (!col.length) continue;
      let firstUp = -1;
      for (let k = 0; k < col.length; k++) if (col[k].faceUp) { firstUp = k; break; }
      if (firstUp <= 0) continue;
      const slice = col.slice(firstUp);
      if (!isMovableRun(slice)) continue;
      for (let j = 0; j < 10; j++) {
        if (j === i) continue;
        const dst = state.tableau[j];
        if (canPlaceOnTableau(slice[0], dst)) {
          return { src: { pile: "tableau", index: i, cardIndex: firstUp }, dst: { pile: "tableau", index: j } };
        }
      }
    }
    return null;
  }

  window.Spider = {
    newState, move, autoMove, dealFromStock, autoCompleteStep, hint, undo, isWon,
    isMovableRun, canPlaceOnTableau
  };
})();
