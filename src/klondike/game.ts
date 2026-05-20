/* ---------- Klondike game engine ---------- */
import type { Card, Rank, Suit, MoveSource, MoveDest } from "../shared/types";
import { SUITS, RANKS, SUIT_COLOR, rankValue } from "../shared/deck";
import { shuffle } from "../shared/utils";

export interface KlondikeState {
  tableau: Card[][];
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  draw: number;
  score: number;
  moves: number;
  startedAt: number;
  history: Snapshot[];
  finishedAt: number | null;
  stockRecycled: number;
}

interface Snapshot {
  tableau: Card[][];
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  score: number;
  moves: number;
  stockRecycled: number;
}

export interface HintMove {
  src: MoveSource;
  dst: MoveDest;
}

function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ id: r + s, rank: r, suit: s, faceUp: false });
    }
  }
  return deck;
}

export function newState(opts: { draw?: number } = {}): KlondikeState {
  const draw = opts.draw ?? 1;
  const deck = shuffle(makeDeck());

  const tableau: Card[][] = [[], [], [], [], [], [], []];
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop()!;
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }

  const stock = deck.map((c) => ({ ...c, faceUp: false }));
  return {
    tableau,
    stock,
    waste: [],
    foundations: [[], [], [], []],
    draw,
    score: 0,
    moves: 0,
    startedAt: Date.now(),
    history: [],
    finishedAt: null,
    stockRecycled: 0,
  };
}

function snapshot(state: KlondikeState): Snapshot {
  return {
    tableau: state.tableau.map((c) => c.map((x) => ({ ...x }))),
    stock: state.stock.map((x) => ({ ...x })),
    waste: state.waste.map((x) => ({ ...x })),
    foundations: state.foundations.map((c) => c.map((x) => ({ ...x }))),
    score: state.score,
    moves: state.moves,
    stockRecycled: state.stockRecycled,
  };
}

function restore(state: KlondikeState, snap: Snapshot): void {
  state.tableau = snap.tableau.map((c) => c.map((x) => ({ ...x })));
  state.stock = snap.stock.map((x) => ({ ...x }));
  state.waste = snap.waste.map((x) => ({ ...x }));
  state.foundations = snap.foundations.map((c) => c.map((x) => ({ ...x })));
  state.score = snap.score;
  state.moves = snap.moves;
  state.stockRecycled = snap.stockRecycled;
}

function pushHistory(state: KlondikeState): void {
  state.history.push(snapshot(state));
  if (state.history.length > 200) state.history.shift();
}

export function undo(state: KlondikeState): boolean {
  const snap = state.history.pop();
  if (!snap) return false;
  restore(state, snap);
  return true;
}

export function canPlaceOnFoundation(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.rank === "A";
  const top = pile[pile.length - 1];
  return (
    card.suit === top.suit && rankValue(card.rank) === rankValue(top.rank) + 1
  );
}

export function canPlaceOnTableau(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.rank === "K";
  const top = pile[pile.length - 1];
  if (!top.faceUp) return false;
  return (
    SUIT_COLOR[card.suit] !== SUIT_COLOR[top.suit] &&
    rankValue(card.rank) === rankValue(top.rank) - 1
  );
}

export function isValidSequence(cards: Card[]): boolean {
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

function getSource(state: KlondikeState, src: MoveSource): Card[] | null {
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

function topSlice(state: KlondikeState, src: MoveSource): Card[] | null {
  const pile = getSource(state, src);
  if (!pile) return null;
  const start = src.cardIndex == null ? pile.length - 1 : src.cardIndex;
  if (start < 0 || start >= pile.length) return null;
  return pile.slice(start);
}

export function dealFromStock(state: KlondikeState): boolean {
  pushHistory(state);
  if (state.stock.length === 0) {
    if (state.waste.length === 0) {
      state.history.pop();
      return false;
    }
    while (state.waste.length) {
      const c = state.waste.pop()!;
      c.faceUp = false;
      state.stock.push(c);
    }
    state.stockRecycled += 1;
    if (state.draw === 3) state.score = Math.max(0, state.score - 20);
    else state.score = Math.max(0, state.score - 100);
    state.moves += 1;
    return true;
  }

  const n = Math.min(state.draw, state.stock.length);
  for (let i = 0; i < n; i++) {
    const c = state.stock.pop()!;
    c.faceUp = true;
    state.waste.push(c);
  }
  state.moves += 1;
  return true;
}

export function move(
  state: KlondikeState,
  src: MoveSource,
  dst: MoveDest,
): boolean {
  const slice = topSlice(state, src);
  if (!slice || slice.length === 0) return false;
  const moving = slice[0];

  if (src.pile === "stock") return false;

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

  const srcPile = getSource(state, src)!;
  const removed = srcPile.splice(srcPile.length - slice.length, slice.length);

  let dstPile: Card[];
  if (dst.pile === "foundation") {
    dstPile = state.foundations[dst.index];
    state.score += 10;
  } else {
    dstPile = state.tableau[dst.index];
    if (src.pile === "foundation") state.score = Math.max(0, state.score - 15);
    if (src.pile === "waste") state.score += 5;
  }
  for (const c of removed) dstPile.push(c);

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

export function autoMove(state: KlondikeState, src: MoveSource): boolean {
  const pile = getSource(state, src);
  if (!pile || pile.length === 0) return false;
  const startIdx = src.cardIndex == null ? pile.length - 1 : src.cardIndex;
  if (startIdx < 0 || startIdx >= pile.length) return false;

  const slice = pile.slice(startIdx);
  const moving = slice[0];
  if (!moving.faceUp) return false;
  if (slice.length > 1 && !isValidSequence(slice)) return false;

  const moveTo = (dst: MoveDest) =>
    move(state, { pile: src.pile, index: src.index, cardIndex: startIdx }, dst);

  if (slice.length === 1) {
    for (let i = 0; i < 4; i++) {
      if (canPlaceOnFoundation(moving, state.foundations[i])) {
        return moveTo({ pile: "foundation", index: i });
      }
    }
  }

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

export function isWon(state: KlondikeState): boolean {
  return state.foundations.every((p) => p.length === 13);
}

export function autoCompleteStep(state: KlondikeState): boolean {
  const allFaceUp = state.tableau.every((p) => p.every((c) => c.faceUp));
  if (!allFaceUp) return false;

  const candidates: {
    pile: string;
    index: number;
    card: Card;
    cardIndex: number;
  }[] = [];
  for (let i = 0; i < 7; i++) {
    const p = state.tableau[i];
    if (p.length)
      candidates.push({
        pile: "tableau",
        index: i,
        card: p[p.length - 1],
        cardIndex: p.length - 1,
      });
  }
  if (state.waste.length) {
    candidates.push({
      pile: "waste",
      index: 0,
      card: state.waste[state.waste.length - 1],
      cardIndex: state.waste.length - 1,
    });
  }

  candidates.sort((a, b) => rankValue(a.card.rank) - rankValue(b.card.rank));

  for (const c of candidates) {
    for (let f = 0; f < 4; f++) {
      if (canPlaceOnFoundation(c.card, state.foundations[f])) {
        return move(
          state,
          { pile: c.pile, index: c.index, cardIndex: c.cardIndex },
          { pile: "foundation", index: f },
        );
      }
    }
  }
  return false;
}

export function isSafeToAutoPlay(state: KlondikeState, card: Card): boolean {
  const r = rankValue(card.rank);
  if (r <= 2) return true;
  const oppSuits: Suit[] = SUIT_COLOR[card.suit] === "red" ? ["S", "C"] : ["H", "D"];
  for (const s of oppSuits) {
    let top: Card | null = null;
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

export function safeAutoStep(state: KlondikeState): boolean {
  const candidates: { card: Card; src: MoveSource }[] = [];
  if (state.waste.length) {
    candidates.push({
      card: state.waste[state.waste.length - 1],
      src: { pile: "waste", index: 0, cardIndex: state.waste.length - 1 },
    });
  }
  for (let i = 0; i < 7; i++) {
    const p = state.tableau[i];
    if (p.length && p[p.length - 1].faceUp) {
      candidates.push({
        card: p[p.length - 1],
        src: { pile: "tableau", index: i, cardIndex: p.length - 1 },
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

export function hint(state: KlondikeState): HintMove | null {
  const tops: {
    pile: string;
    index: number;
    card: Card;
    cardIndex: number;
  }[] = [];
  for (let i = 0; i < 7; i++) {
    const p = state.tableau[i];
    if (p.length)
      tops.push({
        pile: "tableau",
        index: i,
        card: p[p.length - 1],
        cardIndex: p.length - 1,
      });
  }
  if (state.waste.length) {
    tops.push({
      pile: "waste",
      index: 0,
      card: state.waste[state.waste.length - 1],
      cardIndex: state.waste.length - 1,
    });
  }

  for (const t of tops) {
    if (!t.card.faceUp) continue;
    for (let f = 0; f < 4; f++) {
      if (canPlaceOnFoundation(t.card, state.foundations[f])) {
        return {
          src: { pile: t.pile, index: t.index, cardIndex: t.cardIndex },
          dst: { pile: "foundation", index: f },
        };
      }
    }
  }

  for (let i = 0; i < 7; i++) {
    const p = state.tableau[i];
    let firstFaceUp = -1;
    for (let k = 0; k < p.length; k++) {
      if (p[k].faceUp) {
        firstFaceUp = k;
        break;
      }
    }
    if (firstFaceUp <= 0) continue;
    const slice = p.slice(firstFaceUp);
    if (!isValidSequence(slice)) continue;
    for (let j = 0; j < 7; j++) {
      if (j === i) continue;
      if (canPlaceOnTableau(slice[0], state.tableau[j])) {
        return {
          src: { pile: "tableau", index: i, cardIndex: firstFaceUp },
          dst: { pile: "tableau", index: j },
        };
      }
    }
  }

  if (state.waste.length) {
    const c = state.waste[state.waste.length - 1];
    for (let j = 0; j < 7; j++) {
      if (canPlaceOnTableau(c, state.tableau[j])) {
        return {
          src: {
            pile: "waste",
            index: 0,
            cardIndex: state.waste.length - 1,
          },
          dst: { pile: "tableau", index: j },
        };
      }
    }
  }

  for (let i = 0; i < 7; i++) {
    const p = state.tableau[i];
    let firstFaceUp = -1;
    for (let k = 0; k < p.length; k++) {
      if (p[k].faceUp) {
        firstFaceUp = k;
        break;
      }
    }
    if (firstFaceUp <= 0) continue;
    if (p[firstFaceUp].rank !== "K") continue;
    for (let j = 0; j < 7; j++) {
      if (j === i) continue;
      if (state.tableau[j].length === 0) {
        return {
          src: { pile: "tableau", index: i, cardIndex: firstFaceUp },
          dst: { pile: "tableau", index: j },
        };
      }
    }
  }

  return null;
}

export type { Card, Rank, Suit };
