/* ---------- TriPeaks engine ----------
 * Exposes window.TriPeaks.
 *
 * 28 tableau cards arranged as three peaks (1+2+3+...+10 spread).
 * Stock (24) + waste (1+).
 * Click a tableau card whose rank is +/-1 (cyclic A<->K) of the waste top
 * to send it to the waste. Click the stock to deal a new waste card.
 * Win: all 28 tableau cards removed.
 */
(function () {
  const D = window.Deck;
  const U = window.SolUtils;

  // Layout: each card has (row, xUnit) where xUnit is in half-card units.
  // covers[i] = indices of cards that must be removed before i is available.
  const LAYOUT = [
    // Row 0 (peak apexes)
    { row: 0, x: 3,  covers: [3, 4] },     // 0
    { row: 0, x: 9,  covers: [5, 6] },     // 1
    { row: 0, x: 15, covers: [7, 8] },     // 2
    // Row 1
    { row: 1, x: 2,  covers: [9, 10] },    // 3
    { row: 1, x: 4,  covers: [10, 11] },   // 4
    { row: 1, x: 8,  covers: [12, 13] },   // 5
    { row: 1, x: 10, covers: [13, 14] },   // 6
    { row: 1, x: 14, covers: [15, 16] },   // 7
    { row: 1, x: 16, covers: [16, 17] },   // 8
    // Row 2
    { row: 2, x: 1,  covers: [18, 19] },   // 9
    { row: 2, x: 3,  covers: [19, 20] },   // 10
    { row: 2, x: 5,  covers: [20, 21] },   // 11
    { row: 2, x: 7,  covers: [21, 22] },   // 12
    { row: 2, x: 9,  covers: [22, 23] },   // 13
    { row: 2, x: 11, covers: [23, 24] },   // 14
    { row: 2, x: 13, covers: [24, 25] },   // 15
    { row: 2, x: 15, covers: [25, 26] },   // 16
    { row: 2, x: 17, covers: [26, 27] },   // 17
    // Row 3 (bottom)
    { row: 3, x: 0,  covers: [] },         // 18
    { row: 3, x: 2,  covers: [] },         // 19
    { row: 3, x: 4,  covers: [] },         // 20
    { row: 3, x: 6,  covers: [] },         // 21
    { row: 3, x: 8,  covers: [] },         // 22
    { row: 3, x: 10, covers: [] },         // 23
    { row: 3, x: 12, covers: [] },         // 24
    { row: 3, x: 14, covers: [] },         // 25
    { row: 3, x: 16, covers: [] },         // 26
    { row: 3, x: 18, covers: [] }          // 27
  ];

  function newState() {
    const deck = U.shuffle(D.makeDeck()).map((c) => ({ ...c, faceUp: false }));
    const tableau = [];
    for (let i = 0; i < 28; i++) {
      tableau.push({ ...deck[i], removed: false });
    }
    const stock = deck.slice(28).map((c) => ({ ...c, faceUp: false }));
    const waste = [];
    return {
      tableau, stock, waste,
      chain: 0,
      score: 0,
      moves: 0,
      startedAt: Date.now(),
      finishedAt: null,
      history: []
    };
  }

  function layoutOf(i) { return LAYOUT[i]; }

  function isAvailable(state, i) {
    const card = state.tableau[i];
    if (!card || card.removed) return false;
    for (const j of LAYOUT[i].covers) {
      if (!state.tableau[j].removed) return false;
    }
    return true;
  }

  function cyclicRankDiff(a, b) {
    const d = Math.abs(D.rankValue(a) - D.rankValue(b));
    return Math.min(d, 13 - d);
  }

  function canRemove(card, wasteTop) {
    if (!wasteTop) return false;
    return cyclicRankDiff(card.rank, wasteTop.rank) === 1;
  }

  function snapshot(state) {
    return {
      tableau: state.tableau.map((c) => ({ ...c })),
      stock: state.stock.map((c) => ({ ...c })),
      waste: state.waste.map((c) => ({ ...c })),
      chain: state.chain, score: state.score, moves: state.moves
    };
  }
  function restore(state, snap) {
    state.tableau = snap.tableau.map((c) => ({ ...c }));
    state.stock = snap.stock.map((c) => ({ ...c }));
    state.waste = snap.waste.map((c) => ({ ...c }));
    state.chain = snap.chain; state.score = snap.score; state.moves = snap.moves;
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

  function removeTableau(state, i) {
    const card = state.tableau[i];
    if (!isAvailable(state, i)) return false;
    const wasteTop = state.waste[state.waste.length - 1];
    if (!canRemove(card, wasteTop)) return false;
    pushHistory(state);
    card.removed = true;
    state.waste.push({ ...card, faceUp: true });
    state.chain += 1;
    // Score: chain bonuses
    state.score += state.chain * 100;
    state.moves += 1;
    return true;
  }

  function dealFromStock(state) {
    if (state.stock.length === 0) return false;
    pushHistory(state);
    const c = state.stock.pop();
    c.faceUp = true;
    state.waste.push(c);
    state.chain = 0;
    state.score = Math.max(0, state.score - 5);
    state.moves += 1;
    return true;
  }

  function isWon(state) {
    return state.tableau.every((c) => c.removed);
  }

  function hint(state) {
    const wasteTop = state.waste[state.waste.length - 1];
    if (!wasteTop) return null;
    for (let i = 0; i < state.tableau.length; i++) {
      if (isAvailable(state, i) && canRemove(state.tableau[i], wasteTop)) {
        return { tableauIndex: i };
      }
    }
    return null;
  }

  function tableauRemaining(state) {
    return state.tableau.filter((c) => !c.removed).length;
  }

  window.TriPeaks = {
    LAYOUT, newState, isAvailable, canRemove, cyclicRankDiff,
    removeTableau, dealFromStock, isWon, undo, hint, tableauRemaining
  };
})();
