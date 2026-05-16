/* ---------- Klondike solver ----------
 * Decides whether a deal is winnable within a time/node budget.
 * Used to pre-shuffle until a solvable deal is found.
 */
(function () {
  const K = window.Klondike;
  if (!K) return;

  const SUIT_COLOR = K.SUIT_COLOR;
  const rankValue = K.rankValue;

  function cloneCard(c) {
    return { id: c.id, rank: c.rank, suit: c.suit, faceUp: c.faceUp };
  }
  function clonePile(p) {
    return p.map(cloneCard);
  }
  function cloneState(s) {
    return {
      tableau: s.tableau.map(clonePile),
      stock: clonePile(s.stock),
      waste: clonePile(s.waste),
      foundations: s.foundations.map(clonePile),
      draw: s.draw
    };
  }

  function totalFoundation(state) {
    let n = 0;
    for (const p of state.foundations) n += p.length;
    return n;
  }

  function won(state) {
    return totalFoundation(state) === 52;
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

  /* ---- State key for memoization ---- */
  function stateKey(state) {
    let s = "";
    for (const col of state.tableau) {
      for (const c of col) s += (c.faceUp ? "+" : "-") + c.id;
      s += "|";
    }
    s += ";";
    for (const p of state.foundations) {
      s += p.length ? p[p.length - 1].id : "_";
      s += ",";
    }
    s += ";";
    for (const c of state.stock) s += c.id;
    s += "/";
    for (const c of state.waste) s += c.id;
    return s;
  }

  /* ---- Move enumeration ---- */
  function collectMoves(state) {
    const moves = [];

    const wasteTop = state.waste[state.waste.length - 1];

    // Foundation: top of waste / top of each tableau column
    if (wasteTop) {
      for (let f = 0; f < 4; f++) {
        if (canPlaceOnFoundation(wasteTop, state.foundations[f])) {
          moves.push({ t: "w2f", f, prio: 0 });
          break;
        }
      }
    }
    for (let c = 0; c < 7; c++) {
      const col = state.tableau[c];
      if (col.length === 0) continue;
      const top = col[col.length - 1];
      if (!top.faceUp) continue;
      for (let f = 0; f < 4; f++) {
        if (canPlaceOnFoundation(top, state.foundations[f])) {
          moves.push({ t: "t2f", c, f, prio: 0 });
          break;
        }
      }
    }

    // Tableau -> tableau (any movable starting card)
    for (let from = 0; from < 7; from++) {
      const col = state.tableau[from];
      let firstUp = -1;
      for (let i = 0; i < col.length; i++) {
        if (col[i].faceUp) {
          firstUp = i;
          break;
        }
      }
      if (firstUp < 0) continue;
      for (let start = firstUp; start < col.length; start++) {
        const card = col[start];
        for (let to = 0; to < 7; to++) {
          if (to === from) continue;
          if (!canPlaceOnTableau(card, state.tableau[to])) continue;
          // Prune obviously pointless K-to-empty moves
          if (state.tableau[to].length === 0 && start === firstUp && firstUp === 0) continue;
          const flipsCard = start === firstUp && firstUp > 0;
          const prio = flipsCard ? 1 : 3;
          moves.push({ t: "t2t", from, to, start, prio });
        }
      }
    }

    // Waste -> tableau
    if (wasteTop) {
      for (let to = 0; to < 7; to++) {
        if (canPlaceOnTableau(wasteTop, state.tableau[to])) {
          moves.push({ t: "w2t", to, prio: 2 });
        }
      }
    }

    // Stock deal
    if (state.stock.length > 0 || state.waste.length > 0) {
      moves.push({ t: "deal", prio: 4 });
    }

    moves.sort((a, b) => a.prio - b.prio);
    return moves;
  }

  /* ---- Apply move (returns undo closure) ---- */
  function applyMove(state, m) {
    switch (m.t) {
      case "deal": {
        if (state.stock.length === 0) {
          const n = state.waste.length;
          for (let i = 0; i < n; i++) {
            const c = state.waste.pop();
            c.faceUp = false;
            state.stock.push(c);
          }
          return () => {
            for (let i = 0; i < n; i++) {
              const c = state.stock.pop();
              c.faceUp = true;
              state.waste.push(c);
            }
          };
        }
        const n = Math.min(state.draw, state.stock.length);
        for (let i = 0; i < n; i++) {
          const c = state.stock.pop();
          c.faceUp = true;
          state.waste.push(c);
        }
        return () => {
          for (let i = 0; i < n; i++) {
            const c = state.waste.pop();
            c.faceUp = false;
            state.stock.push(c);
          }
        };
      }
      case "w2f": {
        const c = state.waste.pop();
        state.foundations[m.f].push(c);
        return () => {
          state.waste.push(state.foundations[m.f].pop());
        };
      }
      case "t2f": {
        const col = state.tableau[m.c];
        const c = col.pop();
        state.foundations[m.f].push(c);
        let flipped = false;
        if (col.length > 0 && !col[col.length - 1].faceUp) {
          col[col.length - 1].faceUp = true;
          flipped = true;
        }
        return () => {
          if (flipped) col[col.length - 1].faceUp = false;
          col.push(state.foundations[m.f].pop());
        };
      }
      case "w2t": {
        const c = state.waste.pop();
        state.tableau[m.to].push(c);
        return () => {
          state.waste.push(state.tableau[m.to].pop());
        };
      }
      case "t2t": {
        const fromCol = state.tableau[m.from];
        const toCol = state.tableau[m.to];
        const moved = fromCol.splice(m.start);
        for (const c of moved) toCol.push(c);
        let flipped = false;
        if (fromCol.length > 0 && !fromCol[fromCol.length - 1].faceUp) {
          fromCol[fromCol.length - 1].faceUp = true;
          flipped = true;
        }
        return () => {
          if (flipped) fromCol[fromCol.length - 1].faceUp = false;
          const back = toCol.splice(toCol.length - moved.length);
          for (const c of back) fromCol.push(c);
        };
      }
    }
  }

  /* ---- Solver ---- */
  function isSolvable(initial, opts = {}) {
    const maxNodes = opts.maxNodes || 120000;
    const maxTimeMs = opts.maxTimeMs || 1500;
    const state = cloneState(initial);
    const seen = new Set();
    const start = Date.now();
    let nodes = 0;
    let timedOut = false;

    function recurse() {
      if (timedOut) return false;
      if (++nodes > maxNodes || Date.now() - start > maxTimeMs) {
        timedOut = true;
        return false;
      }
      if (won(state)) return true;
      const k = stateKey(state);
      if (seen.has(k)) return false;
      seen.add(k);

      const moves = collectMoves(state);
      for (const m of moves) {
        const undo = applyMove(state, m);
        const ok = recurse();
        undo();
        if (ok) return true;
        if (timedOut) return false;
      }
      return false;
    }

    const ok = recurse();
    return { solvable: ok, timedOut, nodes };
  }

  /* ---- Generate a winnable shuffle ---- */
  function findSolvableState(opts = {}) {
    const draw = opts.draw || 1;
    const totalBudgetMs = opts.totalBudgetMs || 3500;
    const perAttemptMs = opts.perAttemptMs || 1200;
    const perAttemptNodes = opts.perAttemptNodes || 100000;
    const start = Date.now();
    let lastState = null;
    let attempts = 0;
    while (Date.now() - start < totalBudgetMs) {
      attempts += 1;
      const state = K.newState({ draw });
      lastState = state;
      const left = totalBudgetMs - (Date.now() - start);
      const r = isSolvable(state, {
        maxTimeMs: Math.max(200, Math.min(perAttemptMs, left)),
        maxNodes: perAttemptNodes
      });
      if (r.solvable) return { state, attempts, verified: true };
    }
    return { state: lastState, attempts, verified: false };
  }

  K.isSolvable = isSolvable;
  K.findSolvableState = findSolvableState;
})();
