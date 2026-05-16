/* ---------- Pyramid engine ----------
 * Exposes window.Pyramid.
 *
 * 28 pyramid cards arranged in 7 rows of 1..7.
 * Stock (24) + waste. Pair two AVAILABLE cards summing to 13 to remove them.
 * K alone (13) is removed instantly. 3 stock recycles allowed.
 * Win: all 28 pyramid cards removed.
 */
(function () {
  const D = window.Deck;
  const U = window.SolUtils;

  const ROWS = 7;
  const TOTAL = 28;
  const MAX_CYCLES = 3;

  /** Card index helpers */
  function indexOf(row, col) { return row * (row + 1) / 2 + col; }
  function rowColOf(i) {
    let r = 0;
    while ((r + 1) * (r + 2) / 2 <= i) r++;
    const c = i - r * (r + 1) / 2;
    return { row: r, col: c };
  }

  function rankPoint(rank) {
    return D.rankValue(rank);
  }

  function newState() {
    const deck = U.shuffle(D.makeDeck());
    const pyramid = [];
    for (let i = 0; i < TOTAL; i++) {
      pyramid.push({ ...deck[i], faceUp: true, removed: false });
    }
    const stock = deck.slice(TOTAL).map((c) => ({ ...c, faceUp: false }));
    return {
      pyramid,
      stock,
      waste: [],
      cycles: 0,
      score: 0,
      moves: 0,
      startedAt: Date.now(),
      finishedAt: null,
      history: []
    };
  }

  function isAvailable(state, i) {
    const card = state.pyramid[i];
    if (!card || card.removed) return false;
    const { row, col } = rowColOf(i);
    if (row === ROWS - 1) return true;
    const a = indexOf(row + 1, col);
    const b = indexOf(row + 1, col + 1);
    return state.pyramid[a].removed && state.pyramid[b].removed;
  }

  function refCard(state, ref) {
    if (ref.pile === "pyramid") {
      const c = state.pyramid[ref.index];
      return c && !c.removed ? c : null;
    }
    if (ref.pile === "waste") {
      return state.waste.length ? state.waste[state.waste.length - 1] : null;
    }
    return null;
  }

  function refAvailable(state, ref) {
    if (ref.pile === "pyramid") return isAvailable(state, ref.index);
    if (ref.pile === "waste") return state.waste.length > 0;
    return false;
  }

  function snapshot(state) {
    return {
      pyramid: state.pyramid.map((c) => ({ ...c })),
      stock: state.stock.map((c) => ({ ...c })),
      waste: state.waste.map((c) => ({ ...c })),
      cycles: state.cycles, score: state.score, moves: state.moves
    };
  }
  function restore(state, snap) {
    state.pyramid = snap.pyramid.map((c) => ({ ...c }));
    state.stock = snap.stock.map((c) => ({ ...c }));
    state.waste = snap.waste.map((c) => ({ ...c }));
    state.cycles = snap.cycles; state.score = snap.score; state.moves = snap.moves;
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

  function removeRef(state, ref) {
    if (ref.pile === "pyramid") state.pyramid[ref.index].removed = true;
    else if (ref.pile === "waste") state.waste.pop();
  }

  /** Remove a single K. Returns true on success. */
  function removeKing(state, ref) {
    const card = refCard(state, ref);
    if (!card || card.rank !== "K") return false;
    if (!refAvailable(state, ref)) return false;
    pushHistory(state);
    removeRef(state, ref);
    state.score += 5;
    state.moves += 1;
    return true;
  }

  /** Remove a pair summing to 13. Returns true on success. */
  function removePair(state, refA, refB) {
    if (refA.pile === refB.pile && refA.index === refB.index) return false;
    const a = refCard(state, refA);
    const b = refCard(state, refB);
    if (!a || !b) return false;
    if (!refAvailable(state, refA) || !refAvailable(state, refB)) return false;
    if (rankPoint(a.rank) + rankPoint(b.rank) !== 13) return false;
    pushHistory(state);
    // Remove higher pyramid index first when both are pyramid (so cover-relations resolve cleanly).
    const order = [refA, refB];
    if (refA.pile === "pyramid" && refB.pile === "pyramid" && refA.index < refB.index) {
      order.reverse();
    }
    for (const r of order) removeRef(state, r);
    state.score += 10;
    state.moves += 1;
    return true;
  }

  function dealFromStock(state) {
    if (state.stock.length === 0) {
      if (state.cycles >= MAX_CYCLES) return false;
      pushHistory(state);
      while (state.waste.length) {
        const c = state.waste.pop();
        c.faceUp = false;
        state.stock.push(c);
      }
      state.cycles += 1;
      state.moves += 1;
      state.score = Math.max(0, state.score - 25);
      return true;
    }
    pushHistory(state);
    const c = state.stock.pop();
    c.faceUp = true;
    state.waste.push(c);
    state.moves += 1;
    return true;
  }

  function isWon(state) {
    return state.pyramid.every((c) => c.removed);
  }

  /** Enumerate all currently-pairable refs. */
  function availableRefs(state) {
    const refs = [];
    for (let i = 0; i < state.pyramid.length; i++) {
      if (isAvailable(state, i)) refs.push({ pile: "pyramid", index: i });
    }
    if (state.waste.length) refs.push({ pile: "waste", index: 0 });
    return refs;
  }

  function noMovesLeft(state) {
    const refs = availableRefs(state);
    // K alone
    for (const r of refs) {
      const card = refCard(state, r);
      if (card.rank === "K") return false;
    }
    // pairs
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        const a = refCard(state, refs[i]);
        const b = refCard(state, refs[j]);
        if (rankPoint(a.rank) + rankPoint(b.rank) === 13) return false;
      }
    }
    // Can we deal/recycle?
    if (state.stock.length > 0) return false;
    if (state.cycles < MAX_CYCLES) return false;
    return true;
  }

  function hint(state) {
    const refs = availableRefs(state);
    // K alone first
    for (const r of refs) {
      const c = refCard(state, r);
      if (c.rank === "K") return { refs: [r] };
    }
    // pair that removes from pyramid (prefer)
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        const a = refCard(state, refs[i]);
        const b = refCard(state, refs[j]);
        if (rankPoint(a.rank) + rankPoint(b.rank) === 13) {
          // prefer pyramid+pyramid
          if (refs[i].pile === "pyramid" && refs[j].pile === "pyramid") return { refs: [refs[i], refs[j]] };
        }
      }
    }
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        const a = refCard(state, refs[i]);
        const b = refCard(state, refs[j]);
        if (rankPoint(a.rank) + rankPoint(b.rank) === 13) return { refs: [refs[i], refs[j]] };
      }
    }
    return null;
  }

  function pyramidRemaining(state) {
    return state.pyramid.filter((c) => !c.removed).length;
  }

  window.Pyramid = {
    ROWS, TOTAL, MAX_CYCLES,
    indexOf, rowColOf, rankPoint,
    newState, isAvailable, refCard, refAvailable,
    removePair, removeKing, dealFromStock,
    isWon, undo, hint, noMovesLeft, pyramidRemaining,
    availableRefs
  };
})();
