/* ---------- Pyramid engine ----------
 *
 * 28 pyramid cards arranged in 7 rows of 1..7.
 * Stock (24) + waste. Pair two AVAILABLE cards summing to 13 to remove them.
 * K alone (13) is removed instantly. 3 stock recycles allowed.
 * Win: all 28 pyramid cards removed.
 */
import type { Card, Rank } from "../shared/types";
import { rankValue, makeDeck as baseMakeDeck } from "../shared/deck";
import { shuffle } from "../shared/utils";

export const ROWS = 7;
export const TOTAL = 28;
export const MAX_CYCLES = 3;

export interface PyramidCard extends Card {
  removed: boolean;
}

export interface PyramidRef {
  pile: "pyramid" | "waste";
  index: number;
}

export interface PyramidState {
  pyramid: PyramidCard[];
  stock: Card[];
  waste: Card[];
  cycles: number;
  score: number;
  moves: number;
  startedAt: number;
  finishedAt: number | null;
  history: Snapshot[];
}

interface Snapshot {
  pyramid: PyramidCard[];
  stock: Card[];
  waste: Card[];
  cycles: number;
  score: number;
  moves: number;
}

export interface HintResult {
  refs: PyramidRef[];
}

export function indexOf(row: number, col: number): number {
  return row * (row + 1) / 2 + col;
}

export function rowColOf(i: number): { row: number; col: number } {
  let r = 0;
  while ((r + 1) * (r + 2) / 2 <= i) r++;
  const c = i - r * (r + 1) / 2;
  return { row: r, col: c };
}

export function rankPoint(rank: Rank): number {
  return rankValue(rank);
}

export function newState(): PyramidState {
  const deck = shuffle(baseMakeDeck());
  const pyramid: PyramidCard[] = [];
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
    history: [],
  };
}

export function isAvailable(state: PyramidState, i: number): boolean {
  const card = state.pyramid[i];
  if (!card || card.removed) return false;
  const { row, col } = rowColOf(i);
  if (row === ROWS - 1) return true;
  const a = indexOf(row + 1, col);
  const b = indexOf(row + 1, col + 1);
  return state.pyramid[a].removed && state.pyramid[b].removed;
}

export function refCard(state: PyramidState, ref: PyramidRef): Card | null {
  if (ref.pile === "pyramid") {
    const c = state.pyramid[ref.index];
    return c && !c.removed ? c : null;
  }
  if (ref.pile === "waste") {
    return state.waste.length ? state.waste[state.waste.length - 1] : null;
  }
  return null;
}

export function refAvailable(state: PyramidState, ref: PyramidRef): boolean {
  if (ref.pile === "pyramid") return isAvailable(state, ref.index);
  if (ref.pile === "waste") return state.waste.length > 0;
  return false;
}

function snapshot(state: PyramidState): Snapshot {
  return {
    pyramid: state.pyramid.map((c) => ({ ...c })),
    stock: state.stock.map((c) => ({ ...c })),
    waste: state.waste.map((c) => ({ ...c })),
    cycles: state.cycles,
    score: state.score,
    moves: state.moves,
  };
}

function restore(state: PyramidState, snap: Snapshot): void {
  state.pyramid = snap.pyramid.map((c) => ({ ...c }));
  state.stock = snap.stock.map((c) => ({ ...c }));
  state.waste = snap.waste.map((c) => ({ ...c }));
  state.cycles = snap.cycles;
  state.score = snap.score;
  state.moves = snap.moves;
}

function pushHistory(state: PyramidState): void {
  state.history.push(snapshot(state));
  if (state.history.length > 200) state.history.shift();
}

export function undo(state: PyramidState): boolean {
  const snap = state.history.pop();
  if (!snap) return false;
  restore(state, snap);
  return true;
}

function removeRef(state: PyramidState, ref: PyramidRef): void {
  if (ref.pile === "pyramid") state.pyramid[ref.index].removed = true;
  else if (ref.pile === "waste") state.waste.pop();
}

/** Remove a single K. Returns true on success. */
export function removeKing(state: PyramidState, ref: PyramidRef): boolean {
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
export function removePair(
  state: PyramidState,
  refA: PyramidRef,
  refB: PyramidRef,
): boolean {
  if (refA.pile === refB.pile && refA.index === refB.index) return false;
  const a = refCard(state, refA);
  const b = refCard(state, refB);
  if (!a || !b) return false;
  if (!refAvailable(state, refA) || !refAvailable(state, refB)) return false;
  if (rankPoint(a.rank) + rankPoint(b.rank) !== 13) return false;
  pushHistory(state);
  // Remove higher pyramid index first when both are pyramid (so cover-relations resolve cleanly).
  const order: PyramidRef[] = [refA, refB];
  if (refA.pile === "pyramid" && refB.pile === "pyramid" && refA.index < refB.index) {
    order.reverse();
  }
  for (const r of order) removeRef(state, r);
  state.score += 10;
  state.moves += 1;
  return true;
}

export function dealFromStock(state: PyramidState): boolean {
  if (state.stock.length === 0) {
    if (state.cycles >= MAX_CYCLES) return false;
    pushHistory(state);
    while (state.waste.length) {
      const c = state.waste.pop()!;
      c.faceUp = false;
      state.stock.push(c);
    }
    state.cycles += 1;
    state.moves += 1;
    state.score = Math.max(0, state.score - 25);
    return true;
  }
  pushHistory(state);
  const c = state.stock.pop()!;
  c.faceUp = true;
  state.waste.push(c);
  state.moves += 1;
  return true;
}

export function isWon(state: PyramidState): boolean {
  return state.pyramid.every((c) => c.removed);
}

/** Enumerate all currently-pairable refs. */
export function availableRefs(state: PyramidState): PyramidRef[] {
  const refs: PyramidRef[] = [];
  for (let i = 0; i < state.pyramid.length; i++) {
    if (isAvailable(state, i)) refs.push({ pile: "pyramid", index: i });
  }
  if (state.waste.length) refs.push({ pile: "waste", index: 0 });
  return refs;
}

export function noMovesLeft(state: PyramidState): boolean {
  const refs = availableRefs(state);
  // K alone
  for (const r of refs) {
    const card = refCard(state, r);
    if (card?.rank === "K") return false;
  }
  // pairs
  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      const a = refCard(state, refs[i]);
      const b = refCard(state, refs[j]);
      if (!a || !b) continue;
      if (rankPoint(a.rank) + rankPoint(b.rank) === 13) return false;
    }
  }
  if (state.stock.length > 0) return false;
  if (state.cycles < MAX_CYCLES) return false;
  return true;
}

export function hint(state: PyramidState): HintResult | null {
  const refs = availableRefs(state);
  // K alone first
  for (const r of refs) {
    const c = refCard(state, r);
    if (c?.rank === "K") return { refs: [r] };
  }
  // pair that removes from pyramid (prefer)
  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      const a = refCard(state, refs[i]);
      const b = refCard(state, refs[j]);
      if (!a || !b) continue;
      if (rankPoint(a.rank) + rankPoint(b.rank) === 13) {
        if (refs[i].pile === "pyramid" && refs[j].pile === "pyramid") return { refs: [refs[i], refs[j]] };
      }
    }
  }
  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      const a = refCard(state, refs[i]);
      const b = refCard(state, refs[j]);
      if (!a || !b) continue;
      if (rankPoint(a.rank) + rankPoint(b.rank) === 13) return { refs: [refs[i], refs[j]] };
    }
  }
  return null;
}

export function pyramidRemaining(state: PyramidState): number {
  return state.pyramid.filter((c) => !c.removed).length;
}
