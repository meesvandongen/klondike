/* ---------- Spider engine ----------
 *
 * 104 cards arranged in 8 decks. The deck composition depends on the
 * `suits` setting (1, 2 or 4) — the total card count is always 104.
 * 10 tableau columns: cols 0-3 get 6 cards, cols 4-9 get 5 cards (54 cards).
 * Stock: 50 cards, dealt 10 at a time, one per column.
 * Completed K-down-to-A in-suit sequences are removed to the "completed" pile.
 * No foundations; win = 8 completed sequences.
 */
import type { Card, MoveSource, MoveDest, Suit } from "../shared/types";
import { rankValue, makeDeck as baseMakeDeck } from "../shared/deck";
import { shuffle } from "../shared/utils";

export type SpiderSuits = 1 | 2 | 4;

export interface SpiderState {
  tableau: Card[][];
  stock: Card[];
  completed: number;
  score: number;
  moves: number;
  startedAt: number;
  finishedAt: number | null;
  history: Snapshot[];
  suits: SpiderSuits;
}

interface Snapshot {
  tableau: Card[][];
  stock: Card[];
  completed: number;
  score: number;
  moves: number;
}

export interface HintMove {
  src: MoveSource;
  dst: MoveDest;
}

function makeDeck(suits: SpiderSuits): Card[] {
  // Always 104 cards total: numDecks * suitsUsed * 13 = 104.
  // suits=1 → 8 decks of 1 suit; suits=2 → 4 decks of 2; suits=4 → 2 decks of 4.
  if (suits === 1) {
    return baseMakeDeck({ numDecks: 8, suits: ["S"] });
  }
  if (suits === 2) {
    return baseMakeDeck({ numDecks: 4, suits: ["S", "H"] });
  }
  const allSuits: Suit[] = ["S", "H", "D", "C"];
  return baseMakeDeck({ numDecks: 2, suits: allSuits });
}

export function newState(opts: { suits?: SpiderSuits } = {}): SpiderState {
  const suits = opts.suits ?? 1;
  const deck = shuffle(makeDeck(suits));
  const tableau: Card[][] = [[], [], [], [], [], [], [], [], [], []];
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
    completed: 0,
    score: 500,
    moves: 0,
    startedAt: Date.now(),
    finishedAt: null,
    history: [],
    suits,
  };
}

function snapshot(state: SpiderState): Snapshot {
  return {
    tableau: state.tableau.map((c) => c.map((x) => ({ ...x }))),
    stock: state.stock.map((x) => ({ ...x })),
    completed: state.completed,
    score: state.score,
    moves: state.moves,
  };
}

function restore(state: SpiderState, snap: Snapshot): void {
  state.tableau = snap.tableau.map((c) => c.map((x) => ({ ...x })));
  state.stock = snap.stock.map((x) => ({ ...x }));
  state.completed = snap.completed;
  state.score = snap.score;
  state.moves = snap.moves;
}

function pushHistory(state: SpiderState): void {
  state.history.push(snapshot(state));
  if (state.history.length > 200) state.history.shift();
}

export function undo(state: SpiderState): boolean {
  const snap = state.history.pop();
  if (!snap) return false;
  restore(state, snap);
  return true;
}

/** Run-of-same-suit descending sequence check. */
export function isMovableRun(cards: Card[]): boolean {
  for (let i = 1; i < cards.length; i++) {
    if (cards[i].suit !== cards[i - 1].suit) return false;
    if (rankValue(cards[i].rank) !== rankValue(cards[i - 1].rank) - 1) return false;
    if (!cards[i].faceUp || !cards[i - 1].faceUp) return false;
  }
  return true;
}

/** Loose sequence: any descending sequence (color/suit ignored). */
export function canPlaceOnTableau(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return true;
  const top = pile[pile.length - 1];
  if (!top.faceUp) return false;
  return rankValue(card.rank) === rankValue(top.rank) - 1;
}

function checkCompletion(state: SpiderState, colIdx: number): void {
  const col = state.tableau[colIdx];
  if (col.length < 13) return;
  const tail = col.slice(col.length - 13);
  if (!isMovableRun(tail)) return;
  if (tail[0].rank !== "K" || tail[12].rank !== "A") return;
  col.splice(col.length - 13, 13);
  state.completed += 1;
  state.score += 100;
  if (col.length > 0 && !col[col.length - 1].faceUp) {
    col[col.length - 1].faceUp = true;
  }
}

export function move(state: SpiderState, src: MoveSource, dst: MoveDest): boolean {
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

  checkCompletion(state, dst.index);
  return true;
}

export function autoMove(state: SpiderState, src: MoveSource): boolean {
  if (src.pile !== "tableau") return false;
  const fromCol = state.tableau[src.index];
  const startIdx = src.cardIndex == null ? fromCol.length - 1 : src.cardIndex;
  if (startIdx < 0 || startIdx >= fromCol.length) return false;
  const slice = fromCol.slice(startIdx);
  if (!isMovableRun(slice)) return false;
  const moving = slice[0];

  // Pass 0: tableau with same-suit anchor
  for (let i = 0; i < 10; i++) {
    if (i === src.index) continue;
    const dst = state.tableau[i];
    if (dst.length === 0) continue;
    const top = dst[dst.length - 1];
    if (!top.faceUp) continue;
    if (rankValue(moving.rank) === rankValue(top.rank) - 1 && moving.suit === top.suit) {
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

export function dealFromStock(state: SpiderState): boolean {
  if (state.stock.length < 10) return false;
  // Rule: no empty columns allowed when dealing.
  if (state.tableau.some((c) => c.length === 0)) return false;
  pushHistory(state);
  for (let i = 0; i < 10; i++) {
    const c = state.stock.pop()!;
    c.faceUp = true;
    state.tableau[i].push(c);
    checkCompletion(state, i);
  }
  state.moves += 1;
  return true;
}

export function isWon(state: SpiderState): boolean {
  return state.completed === 8;
}

/** Auto-complete step: no-op for Spider (completion happens automatically). */
export function autoCompleteStep(_state: SpiderState): boolean {
  return false;
}

export function hint(state: SpiderState): HintMove | null {
  // 1. Move that completes a sequence (or extends same-suit anchor)
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
      for (let j = 0; j < 10; j++) {
        if (j === i) continue;
        const dst = state.tableau[j];
        if (dst.length === 0) continue;
        const top = dst[dst.length - 1];
        if (!top.faceUp) continue;
        if (rankValue(slice[0].rank) === rankValue(top.rank) - 1 && slice[0].suit === top.suit) {
          return { src: { pile: "tableau", index: i, cardIndex: k }, dst: { pile: "tableau", index: j } };
        }
      }
      break;
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
