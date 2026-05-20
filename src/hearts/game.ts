/* ---------- Hearts game engine ----------
 *
 * 4-player trick-taking. Player 0 is the human (South); 1, 2, 3 are
 * AI seats (West, North, East). Play proceeds clockwise: after p
 * plays, the next seat is (p + 1) % 4.
 *
 * Each hand:
 *   1. Deal 13 cards to each seat.
 *   2. Passing phase (skipped on every fourth hand): each seat
 *      selects 3 cards and they're swapped simultaneously.
 *   3. Holder of 2♣ leads the first trick.
 *   4. 13 tricks of follow-suit-or-discard. Highest of led suit wins
 *      and leads next.
 *   5. Tally hearts (1 pt each) and Q♠ (13 pt). Shoot the moon → 26
 *      to the others, 0 to the shooter.
 *
 * Game ends when any seat reaches the target score (default 100).
 * Lowest total wins.
 */
import type { Card, Suit, Rank } from "../shared/types";
import { SUITS, RANKS, rankValue } from "../shared/deck";
import { shuffle } from "../shared/utils";

export type PassDir = "L" | "R" | "A" | "N";

export type Phase = "pass" | "play" | "between" | "done";

export interface Trick {
  leader: number;
  plays: (Card | null)[];   // index = seat, null if not yet played
  suit: Suit | null;
}

interface Snapshot {
  hands: Card[][];
  trick: Trick;
  taken: Card[][];
  scoreThisHand: number[];
  totals: number[];
  heartsBroken: boolean;
  currentPlayer: number;
  phase: Phase;
  handNum: number;
  passDir: PassDir;
  pending: (Card[] | null)[];
  firstTrickOfHand: boolean;
}

export interface HeartsState {
  hands: Card[][];           // length 4, each holds remaining cards
  trick: Trick;
  taken: Card[][];           // captured tricks this hand, by seat
  scoreThisHand: number[];   // running points this hand, per seat
  totals: number[];          // accumulated game points, per seat
  heartsBroken: boolean;
  currentPlayer: number;
  phase: Phase;
  handNum: number;           // 0-based hand counter (used for pass direction)
  passDir: PassDir;
  pending: (Card[] | null)[]; // cards selected/queued to pass, per seat
  firstTrickOfHand: boolean;
  targetScore: number;
  startedAt: number;
  finishedAt: number | null;
  moves: number;
  history: Snapshot[];
}

function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ id: r + s, rank: r, suit: s, faceUp: true });
    }
  }
  return deck;
}

function sortHand(hand: Card[]): Card[] {
  const order: Record<Suit, number> = { C: 0, D: 1, S: 2, H: 3 };
  return hand.sort((a, b) => {
    const so = order[a.suit] - order[b.suit];
    if (so !== 0) return so;
    return rankValue(a.rank) - rankValue(b.rank);
  });
}

export function passDirForHand(n: number): PassDir {
  const cycle: PassDir[] = ["L", "R", "A", "N"];
  return cycle[n % 4];
}

/** Recipient of a pass from `from` given the direction. */
export function passTarget(from: number, dir: PassDir): number {
  if (dir === "L") return (from + 1) % 4;
  if (dir === "R") return (from + 3) % 4;
  if (dir === "A") return (from + 2) % 4;
  return from;
}

function dealHands(): Card[][] {
  const deck = shuffle(makeDeck());
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < 52; i++) hands[i % 4].push(deck[i]);
  for (const h of hands) sortHand(h);
  return hands;
}

function find2C(hands: Card[][]): number {
  for (let s = 0; s < 4; s++) {
    if (hands[s].some((c) => c.rank === "2" && c.suit === "C")) return s;
  }
  return 0;
}

function emptyTrick(leader: number): Trick {
  return { leader, plays: [null, null, null, null], suit: null };
}

export function newState(opts: { targetScore?: number } = {}): HeartsState {
  const hands = dealHands();
  const dir = passDirForHand(0);
  const phase: Phase = dir === "N" ? "play" : "pass";
  const leader = phase === "play" ? find2C(hands) : 0;
  return {
    hands,
    trick: emptyTrick(leader),
    taken: [[], [], [], []],
    scoreThisHand: [0, 0, 0, 0],
    totals: [0, 0, 0, 0],
    heartsBroken: false,
    currentPlayer: leader,
    phase,
    handNum: 0,
    passDir: dir,
    pending: [null, null, null, null],
    firstTrickOfHand: true,
    targetScore: opts.targetScore ?? 100,
    startedAt: Date.now(),
    finishedAt: null,
    moves: 0,
    history: [],
  };
}

function snapshot(state: HeartsState): Snapshot {
  return {
    hands: state.hands.map((h) => h.map((c) => ({ ...c }))),
    trick: {
      leader: state.trick.leader,
      plays: state.trick.plays.map((c) => (c ? { ...c } : null)),
      suit: state.trick.suit,
    },
    taken: state.taken.map((t) => t.map((c) => ({ ...c }))),
    scoreThisHand: [...state.scoreThisHand],
    totals: [...state.totals],
    heartsBroken: state.heartsBroken,
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    handNum: state.handNum,
    passDir: state.passDir,
    pending: state.pending.map((p) => (p ? p.map((c) => ({ ...c })) : null)),
    firstTrickOfHand: state.firstTrickOfHand,
  };
}

function restore(state: HeartsState, s: Snapshot): void {
  state.hands = s.hands.map((h) => h.map((c) => ({ ...c })));
  state.trick = {
    leader: s.trick.leader,
    plays: s.trick.plays.map((c) => (c ? { ...c } : null)),
    suit: s.trick.suit,
  };
  state.taken = s.taken.map((t) => t.map((c) => ({ ...c })));
  state.scoreThisHand = [...s.scoreThisHand];
  state.totals = [...s.totals];
  state.heartsBroken = s.heartsBroken;
  state.currentPlayer = s.currentPlayer;
  state.phase = s.phase;
  state.handNum = s.handNum;
  state.passDir = s.passDir;
  state.pending = s.pending.map((p) => (p ? p.map((c) => ({ ...c })) : null));
  state.firstTrickOfHand = s.firstTrickOfHand;
}

function pushHistory(state: HeartsState): void {
  state.history.push(snapshot(state));
  if (state.history.length > 200) state.history.shift();
}

/** Undo one human action. Rolls back through any AI moves that
 * happened automatically after it. */
export function undo(state: HeartsState): boolean {
  const snap = state.history.pop();
  if (!snap) return false;
  restore(state, snap);
  return true;
}

/* ---------- Card values + identity helpers ---------- */

export function isPointCard(c: Card): boolean {
  return c.suit === "H" || (c.suit === "S" && c.rank === "Q");
}

export function cardPoints(c: Card): number {
  if (c.suit === "H") return 1;
  if (c.suit === "S" && c.rank === "Q") return 13;
  return 0;
}

/* ---------- Rule queries ---------- */

/** All legal plays from `hand` given the current trick state. */
export function legalPlays(state: HeartsState, seat: number): Card[] {
  const hand = state.hands[seat];
  if (hand.length === 0) return [];

  // A trick that's still on the table after completion is logically
  // already collected — treat it as an empty trick for legality.
  const trickIsCleared = isTrickPendingClear(state);
  const trick = trickIsCleared
    ? { leader: state.currentPlayer, plays: [null, null, null, null] as (Card | null)[], suit: null as Suit | null }
    : state.trick;
  const isLead = trick.suit === null;

  if (isLead) {
    if (state.firstTrickOfHand) {
      const twoC = hand.find((c) => c.rank === "2" && c.suit === "C");
      return twoC ? [twoC] : [];
    }
    if (!state.heartsBroken) {
      const nonHearts = hand.filter((c) => c.suit !== "H");
      if (nonHearts.length > 0) return nonHearts;
    }
    return hand.slice();
  }

  // Following.
  const followers = hand.filter((c) => c.suit === trick.suit);
  if (followers.length > 0) return followers;

  // Can't follow suit: free to play anything, with a first-trick
  // restriction (no hearts and no Q♠ unless that's literally all you
  // have).
  if (state.firstTrickOfHand) {
    const safe = hand.filter((c) => !isPointCard(c));
    if (safe.length > 0) return safe;
  }
  return hand.slice();
}

export function isLegalPlay(state: HeartsState, seat: number, card: Card): boolean {
  return legalPlays(state, seat).some((c) => c.id === card.id);
}

/* ---------- Passing ---------- */

export function clearPending(state: HeartsState, seat: number): void {
  state.pending[seat] = null;
}

/** Toggle a card in seat 0's pending pass selection. Returns the
 * new selection (1..3 cards). Returns null if the click was a no-op. */
export function togglePassSelection(state: HeartsState, card: Card): Card[] | null {
  if (state.phase !== "pass") return null;
  const list = state.pending[0] ?? [];
  const idx = list.findIndex((c) => c.id === card.id);
  if (idx >= 0) {
    const next = list.slice(0, idx).concat(list.slice(idx + 1));
    state.pending[0] = next.length ? next : null;
    return state.pending[0] ?? [];
  }
  if (list.length >= 3) return list;
  if (!state.hands[0].some((c) => c.id === card.id)) return null;
  const next = [...list, card];
  state.pending[0] = next;
  return next;
}

/** Set all four players' pass selections (AI picks must be filled
 * by the caller before invoking commitPass). */
export function setPending(state: HeartsState, seat: number, cards: Card[]): void {
  if (cards.length !== 3) throw new Error("must select exactly 3 cards to pass");
  state.pending[seat] = cards.map((c) => ({ ...c }));
}

export function commitPass(state: HeartsState): boolean {
  if (state.phase !== "pass") return false;
  for (let s = 0; s < 4; s++) {
    if (!state.pending[s] || state.pending[s]!.length !== 3) return false;
  }
  pushHistory(state);
  const moved: Card[][] = [[], [], [], []];
  for (let s = 0; s < 4; s++) {
    const target = passTarget(s, state.passDir);
    moved[target] = state.pending[s]!;
    // Remove from sender's hand.
    state.hands[s] = state.hands[s].filter(
      (c) => !state.pending[s]!.some((p) => p.id === c.id),
    );
  }
  for (let s = 0; s < 4; s++) {
    state.hands[s] = sortHand([...state.hands[s], ...moved[s]]);
  }
  state.pending = [null, null, null, null];
  state.phase = "play";
  state.firstTrickOfHand = true;
  state.heartsBroken = false;
  const leader = find2C(state.hands);
  state.trick = emptyTrick(leader);
  state.currentPlayer = leader;
  state.moves += 1;
  return true;
}

/* ---------- Playing tricks ---------- */

function trickWinner(trick: Trick): number {
  let bestSeat = trick.leader;
  let bestRank = -1;
  for (let i = 0; i < 4; i++) {
    const c = trick.plays[i];
    if (!c) continue;
    if (c.suit !== trick.suit) continue;
    const r = rankValue(c.rank);
    if (r > bestRank) {
      bestRank = r;
      bestSeat = i;
    }
  }
  return bestSeat;
}

function trickComplete(trick: Trick): boolean {
  return trick.plays.every((p) => p !== null);
}

function pointsInTrick(trick: Trick): number {
  let total = 0;
  for (const c of trick.plays) if (c) total += cardPoints(c);
  return total;
}

/** True if the previous trick is still on the table waiting for
 * `clearCompletedTrick` to be called. */
export function isTrickPendingClear(state: HeartsState): boolean {
  return state.trick.plays.every((p) => p !== null);
}

/** Discard a completed-but-visible trick. No-op if there's nothing
 * to clear. Idempotent. */
export function clearCompletedTrick(state: HeartsState): boolean {
  if (!isTrickPendingClear(state)) return false;
  if (state.hands.every((h) => h.length === 0)) return false; // hand-end path
  state.trick = emptyTrick(state.currentPlayer);
  return true;
}

/** Play one card from `seat` (the current player). Returns true on
 * success. Does NOT auto-advance through AI turns — caller drives
 * the loop. */
export function playCard(
  state: HeartsState,
  seat: number,
  card: Card,
  opts: { pushUndo?: boolean } = {},
): boolean {
  if (state.phase !== "play") return false;
  if (state.currentPlayer !== seat) return false;

  // If a completed trick is still on the table, clear it first.
  // Validation runs against the fresh empty trick.
  clearCompletedTrick(state);

  if (!isLegalPlay(state, seat, card)) return false;
  if (opts.pushUndo) pushHistory(state);

  // Remove from hand.
  const hand = state.hands[seat];
  const idx = hand.findIndex((c) => c.id === card.id);
  if (idx < 0) return false;
  const played = hand.splice(idx, 1)[0];

  // Record into trick.
  if (state.trick.suit === null) state.trick.suit = played.suit;
  state.trick.plays[seat] = played;
  if (played.suit === "H") state.heartsBroken = true;

  if (trickComplete(state.trick)) {
    const winner = trickWinner(state.trick);
    const pts = pointsInTrick(state.trick);
    for (const c of state.trick.plays) if (c) state.taken[winner].push(c);
    state.scoreThisHand[winner] += pts;
    state.firstTrickOfHand = false;
    state.currentPlayer = winner;
    // Leave the trick on the table; caller will clear it after a
    // visible pause via clearCompletedTrick().
    if (state.hands.every((h) => h.length === 0)) {
      finishHand(state);
    }
  } else {
    state.currentPlayer = (seat + 1) % 4;
  }

  state.moves += 1;
  return true;
}

function finishHand(state: HeartsState): void {
  // Shoot-the-moon detection.
  let shooter = -1;
  for (let s = 0; s < 4; s++) {
    if (state.scoreThisHand[s] === 26) {
      shooter = s;
      break;
    }
  }
  if (shooter >= 0) {
    const adjusted = [26, 26, 26, 26];
    adjusted[shooter] = 0;
    for (let s = 0; s < 4; s++) state.totals[s] += adjusted[s];
  } else {
    for (let s = 0; s < 4; s++) state.totals[s] += state.scoreThisHand[s];
  }
  if (state.totals.some((t) => t >= state.targetScore)) {
    state.phase = "done";
    state.finishedAt = Date.now();
  } else {
    state.phase = "between";
  }
}

/** Start the next hand (clears taken pile, deals fresh, picks pass
 * dir). Called after the human acknowledges the score modal. */
export function nextHand(state: HeartsState): void {
  if (state.phase !== "between") return;
  state.handNum += 1;
  state.hands = dealHands();
  state.taken = [[], [], [], []];
  state.scoreThisHand = [0, 0, 0, 0];
  state.heartsBroken = false;
  state.firstTrickOfHand = true;
  state.pending = [null, null, null, null];
  state.passDir = passDirForHand(state.handNum);
  if (state.passDir === "N") {
    state.phase = "play";
    const leader = find2C(state.hands);
    state.trick = emptyTrick(leader);
    state.currentPlayer = leader;
  } else {
    state.phase = "pass";
    state.trick = emptyTrick(0);
    state.currentPlayer = 0;
  }
}

export function winner(state: HeartsState): number | null {
  if (state.phase !== "done") return null;
  let best = 0;
  for (let s = 1; s < 4; s++) if (state.totals[s] < state.totals[best]) best = s;
  return best;
}

export { rankValue, RANKS, SUITS };
export type { Rank, Suit };
