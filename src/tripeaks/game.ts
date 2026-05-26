/* ---------- TriPeaks engine ----------
 *
 * 28 tableau cards arranged as three peaks (1+2+3+...+10 spread).
 * Stock (24) + waste (1+).
 * Click a tableau card whose rank is +/-1 (cyclic A<->K) of the waste top
 * to send it to the waste. Click the stock to deal a new waste card.
 * Win: all 28 tableau cards removed.
 */
import type { Card, Rank } from "../shared/types";
import { rankValue, makeDeck as baseMakeDeck } from "../shared/deck";
import { shuffle } from "../shared/utils";

export interface TriPeaksCard extends Card {
  removed: boolean;
}

export interface TriPeaksState {
  tableau: TriPeaksCard[];
  stock: Card[];
  waste: Card[];
  chain: number;
  score: number;
  moves: number;
  startedAt: number;
  finishedAt: number | null;
  history: Snapshot[];
  /** When true, A and K wrap (cyclic ranks). When false, A↔K is not allowed. */
  wrap: boolean;
  /** When true, all peak cards begin face-up (Easy mode reveal). */
  allFaceUp: boolean;
}

interface Snapshot {
  tableau: TriPeaksCard[];
  stock: Card[];
  waste: Card[];
  chain: number;
  score: number;
  moves: number;
}

export interface LayoutEntry {
  row: number;
  x: number;
  covers: number[];
}

export interface HintResult {
  tableauIndex: number;
}

// Layout: each card has (row, xUnit) where xUnit is in half-card units.
// covers[i] = indices of cards that must be removed before i is available.
export const LAYOUT: LayoutEntry[] = [
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
  { row: 3, x: 18, covers: [] },         // 27
];

export function newState(opts: { wrap?: boolean; allFaceUp?: boolean } = {}): TriPeaksState {
  const wrap = opts.wrap ?? true;
  const allFaceUp = opts.allFaceUp ?? false;
  const deck = shuffle(baseMakeDeck()).map((c) => ({ ...c, faceUp: false }));
  const tableau: TriPeaksCard[] = [];
  for (let i = 0; i < 28; i++) {
    tableau.push({ ...deck[i], removed: false });
  }
  const stock = deck.slice(28).map((c) => ({ ...c, faceUp: false }));
  const waste: Card[] = [];
  return {
    tableau, stock, waste,
    chain: 0,
    score: 0,
    moves: 0,
    startedAt: Date.now(),
    finishedAt: null,
    history: [],
    wrap,
    allFaceUp,
  };
}

export function isAvailable(state: TriPeaksState, i: number): boolean {
  const card = state.tableau[i];
  if (!card || card.removed) return false;
  for (const j of LAYOUT[i].covers) {
    if (!state.tableau[j].removed) return false;
  }
  return true;
}

export function cyclicRankDiff(a: Rank, b: Rank): number {
  const d = Math.abs(rankValue(a) - rankValue(b));
  return Math.min(d, 13 - d);
}

export function linearRankDiff(a: Rank, b: Rank): number {
  return Math.abs(rankValue(a) - rankValue(b));
}

export function canRemove(
  card: Card,
  wasteTop: Card | null | undefined,
  wrap: boolean = true,
): boolean {
  if (!wasteTop) return false;
  const diff = wrap
    ? cyclicRankDiff(card.rank, wasteTop.rank)
    : linearRankDiff(card.rank, wasteTop.rank);
  return diff === 1;
}

function snapshot(state: TriPeaksState): Snapshot {
  return {
    tableau: state.tableau.map((c) => ({ ...c })),
    stock: state.stock.map((c) => ({ ...c })),
    waste: state.waste.map((c) => ({ ...c })),
    chain: state.chain,
    score: state.score,
    moves: state.moves,
  };
}

function restore(state: TriPeaksState, snap: Snapshot): void {
  state.tableau = snap.tableau.map((c) => ({ ...c }));
  state.stock = snap.stock.map((c) => ({ ...c }));
  state.waste = snap.waste.map((c) => ({ ...c }));
  state.chain = snap.chain;
  state.score = snap.score;
  state.moves = snap.moves;
}

function pushHistory(state: TriPeaksState): void {
  state.history.push(snapshot(state));
  if (state.history.length > 200) state.history.shift();
}

export function undo(state: TriPeaksState): boolean {
  const snap = state.history.pop();
  if (!snap) return false;
  restore(state, snap);
  return true;
}

export function removeTableau(state: TriPeaksState, i: number): boolean {
  const card = state.tableau[i];
  if (!isAvailable(state, i)) return false;
  const wasteTop = state.waste[state.waste.length - 1];
  if (!canRemove(card, wasteTop, state.wrap)) return false;
  pushHistory(state);
  card.removed = true;
  state.waste.push({ ...card, faceUp: true });
  state.chain += 1;
  state.score += state.chain * 100;
  state.moves += 1;
  return true;
}

export function dealFromStock(state: TriPeaksState): boolean {
  if (state.stock.length === 0) return false;
  pushHistory(state);
  const c = state.stock.pop()!;
  c.faceUp = true;
  state.waste.push(c);
  state.chain = 0;
  state.score = Math.max(0, state.score - 5);
  state.moves += 1;
  return true;
}

export function isWon(state: TriPeaksState): boolean {
  return state.tableau.every((c) => c.removed);
}

export function hint(state: TriPeaksState): HintResult | null {
  const wasteTop = state.waste[state.waste.length - 1];
  if (!wasteTop) return null;
  for (let i = 0; i < state.tableau.length; i++) {
    if (isAvailable(state, i) && canRemove(state.tableau[i], wasteTop, state.wrap)) {
      return { tableauIndex: i };
    }
  }
  return null;
}

export function tableauRemaining(state: TriPeaksState): number {
  return state.tableau.filter((c) => !c.removed).length;
}
