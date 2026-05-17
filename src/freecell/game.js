/* ---------- FreeCell engine ----------
 * Exposes window.FreeCell.
 *
 * Piles:
 *   tableau: 8 cascades, all cards face up
 *   cells:   4 free cells, each holds 0 or 1 card
 *   foundations: 4 piles, build up A->K by suit
 */
(function () {
  const D = window.Deck;
  const U = window.SolUtils;

  function makeDeck() {
    return D.makeDeck().map((c) => ({ ...c, faceUp: true }));
  }

  function newState() {
    const deck = U.shuffle(makeDeck());
    const tableau = [[], [], [], [], [], [], [], []];
    // 4 cols of 7, 4 cols of 6 = 52
    let i = 0;
    for (let col = 0; col < 8; col++) {
      const n = col < 4 ? 7 : 6;
      for (let k = 0; k < n; k++) tableau[col].push(deck[i++]);
    }
    return {
      tableau,
      cells: [null, null, null, null],
      foundations: [[], [], [], []],
      score: 0,
      moves: 0,
      startedAt: Date.now(),
      finishedAt: null,
      history: []
    };
  }

  function snapshot(state) {
    return {
      tableau: state.tableau.map((c) => c.map((x) => ({ ...x }))),
      cells: state.cells.map((c) => (c ? { ...c } : null)),
      foundations: state.foundations.map((c) => c.map((x) => ({ ...x }))),
      score: state.score,
      moves: state.moves
    };
  }
  function restore(state, snap) {
    state.tableau = snap.tableau.map((c) => c.map((x) => ({ ...x })));
    state.cells = snap.cells.map((c) => (c ? { ...c } : null));
    state.foundations = snap.foundations.map((c) => c.map((x) => ({ ...x })));
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

  function canPlaceOnFoundation(card, pile) {
    if (pile.length === 0) return card.rank === "A";
    const top = pile[pile.length - 1];
    return card.suit === top.suit && D.rankValue(card.rank) === D.rankValue(top.rank) + 1;
  }
  function canPlaceOnTableau(card, pile) {
    if (pile.length === 0) return true; // any card on empty cascade
    const top = pile[pile.length - 1];
    return (
      D.SUIT_COLOR[card.suit] !== D.SUIT_COLOR[top.suit] &&
      D.rankValue(card.rank) === D.rankValue(top.rank) - 1
    );
  }
  function isValidSequence(cards) {
    for (let i = 1; i < cards.length; i++) {
      const a = cards[i - 1], b = cards[i];
      if (D.SUIT_COLOR[a.suit] === D.SUIT_COLOR[b.suit]) return false;
      if (D.rankValue(b.rank) !== D.rankValue(a.rank) - 1) return false;
    }
    return true;
  }

  function countEmptyCells(state) {
    return state.cells.filter((c) => c === null).length;
  }
  function countEmptyCascades(state, excludeIdx) {
    let n = 0;
    for (let i = 0; i < state.tableau.length; i++) {
      if (i === excludeIdx) continue;
      if (state.tableau[i].length === 0) n++;
    }
    return n;
  }
  function maxMoveSize(state, toEmptyCascadeIdx) {
    const empties = countEmptyCascades(state, toEmptyCascadeIdx);
    return (1 + countEmptyCells(state)) * Math.pow(2, empties);
  }

  function getPile(state, src) {
    if (src.pile === "tableau") return state.tableau[src.index];
    if (src.pile === "cell") return state.cells[src.index] ? [state.cells[src.index]] : [];
    if (src.pile === "foundation") return state.foundations[src.index];
    return null;
  }

  function move(state, src, dst) {
    // Determine slice being moved.
    let slice;
    if (src.pile === "tableau") {
      const startIdx = src.cardIndex == null ? state.tableau[src.index].length - 1 : src.cardIndex;
      slice = state.tableau[src.index].slice(startIdx);
    } else if (src.pile === "cell") {
      if (!state.cells[src.index]) return false;
      slice = [state.cells[src.index]];
    } else if (src.pile === "foundation") {
      const f = state.foundations[src.index];
      if (!f.length) return false;
      slice = [f[f.length - 1]];
    } else return false;

    if (!slice.length) return false;
    if (slice.length > 1 && !isValidSequence(slice)) return false;
    const moving = slice[0];

    // Validate destination.
    let ok = false;
    if (dst.pile === "foundation") {
      if (slice.length !== 1) return false;
      ok = canPlaceOnFoundation(moving, state.foundations[dst.index]);
    } else if (dst.pile === "tableau") {
      ok = canPlaceOnTableau(moving, state.tableau[dst.index]);
      // Resource check for super-moves.
      if (ok && slice.length > 1) {
        const toEmpty = state.tableau[dst.index].length === 0 ? dst.index : null;
        const max = maxMoveSize(state, toEmpty);
        if (slice.length > max) return false;
      }
    } else if (dst.pile === "cell") {
      if (slice.length !== 1) return false;
      ok = state.cells[dst.index] === null;
    } else return false;

    if (!ok) return false;

    pushHistory(state);

    // Remove from source.
    if (src.pile === "tableau") {
      state.tableau[src.index].splice(state.tableau[src.index].length - slice.length, slice.length);
    } else if (src.pile === "cell") {
      state.cells[src.index] = null;
    } else if (src.pile === "foundation") {
      state.foundations[src.index].pop();
    }

    // Add to destination.
    if (dst.pile === "foundation") {
      state.foundations[dst.index].push(moving);
      state.score += 10;
    } else if (dst.pile === "tableau") {
      for (const c of slice) state.tableau[dst.index].push(c);
      if (src.pile === "cell") state.score += 1;
      if (src.pile === "foundation") state.score = Math.max(0, state.score - 15);
    } else if (dst.pile === "cell") {
      state.cells[dst.index] = moving;
    }

    state.moves += 1;
    return true;
  }

  /** Auto-move card or sequence at src to the best target. */
  function autoMove(state, src) {
    let pile, startIdx, card;
    if (src.pile === "tableau") {
      pile = state.tableau[src.index];
      startIdx = src.cardIndex == null ? pile.length - 1 : src.cardIndex;
      if (startIdx < 0 || startIdx >= pile.length) return false;
      card = pile[startIdx];
    } else if (src.pile === "cell") {
      if (!state.cells[src.index]) return false;
      card = state.cells[src.index];
      startIdx = 0;
    } else if (src.pile === "foundation") {
      pile = state.foundations[src.index];
      if (!pile.length) return false;
      startIdx = pile.length - 1;
      card = pile[startIdx];
    } else return false;

    const sliceLen = src.pile === "tableau" ? pile.length - startIdx : 1;

    // Single card: try foundation first.
    if (sliceLen === 1) {
      for (let f = 0; f < 4; f++) {
        if (canPlaceOnFoundation(card, state.foundations[f])) {
          return move(state, { ...src, cardIndex: startIdx }, { pile: "foundation", index: f });
        }
      }
    }
    // Then tableau, non-empty first.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 8; i++) {
        if (src.pile === "tableau" && i === src.index) continue;
        const dstPile = state.tableau[i];
        if (pass === 0 && dstPile.length === 0) continue;
        if (pass === 1 && dstPile.length > 0) continue;
        const trialMove = (state2) => move(state2, { ...src, cardIndex: startIdx }, { pile: "tableau", index: i });
        if (canPlaceOnTableau(card, dstPile)) {
          // Validate super-move resources.
          if (sliceLen > 1) {
            const toEmpty = dstPile.length === 0 ? i : null;
            if (sliceLen > maxMoveSize(state, toEmpty)) continue;
          }
          if (trialMove(state)) return true;
        }
      }
    }
    // Finally, single card to free cell.
    if (sliceLen === 1 && src.pile !== "cell") {
      for (let c = 0; c < 4; c++) {
        if (state.cells[c] === null) {
          return move(state, { ...src, cardIndex: startIdx }, { pile: "cell", index: c });
        }
      }
    }
    return false;
  }

  function isWon(state) {
    return state.foundations.every((p) => p.length === 13);
  }

  /** Auto-complete one step: top of any pile to foundation if eligible. */
  function autoCompleteStep(state) {
    const tops = [];
    for (let i = 0; i < 8; i++) {
      const p = state.tableau[i];
      if (p.length) tops.push({ card: p[p.length - 1], src: { pile: "tableau", index: i, cardIndex: p.length - 1 } });
    }
    for (let i = 0; i < 4; i++) {
      if (state.cells[i]) tops.push({ card: state.cells[i], src: { pile: "cell", index: i, cardIndex: 0 } });
    }
    tops.sort((a, b) => D.rankValue(a.card.rank) - D.rankValue(b.card.rank));
    for (const t of tops) {
      for (let f = 0; f < 4; f++) {
        if (canPlaceOnFoundation(t.card, state.foundations[f])) {
          return move(state, t.src, { pile: "foundation", index: f });
        }
      }
    }
    return false;
  }

  /** Same Vista safety rule as Klondike. */
  function isSafeToAutoPlay(state, card) {
    const r = D.rankValue(card.rank);
    if (r <= 2) return true;
    const oppSuits = D.SUIT_COLOR[card.suit] === "red" ? ["S", "C"] : ["H", "D"];
    for (const s of oppSuits) {
      let top = null;
      for (const pile of state.foundations) {
        if (pile.length && pile[0].suit === s) {
          top = pile[pile.length - 1];
          break;
        }
      }
      if (!top || D.rankValue(top.rank) < r - 1) return false;
    }
    return true;
  }

  /** Send one safe candidate to its foundation. */
  function safeAutoStep(state) {
    const candidates = [];
    for (let i = 0; i < 8; i++) {
      const p = state.tableau[i];
      if (p.length) {
        candidates.push({ card: p[p.length - 1], src: { pile: "tableau", index: i, cardIndex: p.length - 1 } });
      }
    }
    for (let i = 0; i < 4; i++) {
      if (state.cells[i]) {
        candidates.push({ card: state.cells[i], src: { pile: "cell", index: i, cardIndex: 0 } });
      }
    }
    candidates.sort((a, b) => D.rankValue(a.card.rank) - D.rankValue(b.card.rank));
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

  /** Hint: pick a productive move. */
  function hint(state) {
    // Tops first
    const tops = [];
    for (let i = 0; i < 8; i++) {
      const p = state.tableau[i];
      if (p.length) tops.push({ card: p[p.length - 1], src: { pile: "tableau", index: i, cardIndex: p.length - 1 } });
    }
    for (let i = 0; i < 4; i++) {
      if (state.cells[i]) tops.push({ card: state.cells[i], src: { pile: "cell", index: i, cardIndex: 0 } });
    }
    // 1. To foundation
    for (const t of tops) {
      for (let f = 0; f < 4; f++) {
        if (canPlaceOnFoundation(t.card, state.foundations[f])) {
          return { src: t.src, dst: { pile: "foundation", index: f } };
        }
      }
    }
    // 2. Tableau -> tableau that's non-empty
    for (let i = 0; i < 8; i++) {
      const p = state.tableau[i];
      if (!p.length) continue;
      const top = p[p.length - 1];
      for (let j = 0; j < 8; j++) {
        if (i === j) continue;
        if (state.tableau[j].length === 0) continue;
        if (canPlaceOnTableau(top, state.tableau[j])) {
          return { src: { pile: "tableau", index: i, cardIndex: p.length - 1 }, dst: { pile: "tableau", index: j } };
        }
      }
    }
    // 3. Cell -> tableau
    for (let c = 0; c < 4; c++) {
      const card = state.cells[c];
      if (!card) continue;
      for (let j = 0; j < 8; j++) {
        if (canPlaceOnTableau(card, state.tableau[j])) {
          return { src: { pile: "cell", index: c, cardIndex: 0 }, dst: { pile: "tableau", index: j } };
        }
      }
    }
    return null;
  }

  window.FreeCell = {
    newState, move, autoMove, autoCompleteStep, safeAutoStep, isSafeToAutoPlay,
    hint, undo, isWon, canPlaceOnFoundation, canPlaceOnTableau, isValidSequence
  };
})();
