/* ---------- Hearts AI ----------
 *
 * Simple heuristic bots. Good enough to put up a reasonable fight
 * without trying to compete with serious Hearts engines.
 *
 *   Passing: dump high spades (Q♠ first, then K♠/A♠), then high
 *   hearts, then high cards in long suits, then high diamonds/clubs.
 *
 *   Following: if a trick is already point-laden, try to play under;
 *   if that's impossible, play the highest card you can to avoid
 *   taking the trick later. If safe to take, dump a high card.
 *
 *   Leading: low non-heart first (rules forbid leading hearts until
 *   broken); prefer leading from the longest suit.
 */
import type { Card, Suit } from "../shared/types";
import { rankValue } from "../shared/deck";
import {
  type HeartsState,
  legalPlays,
  cardPoints,
} from "./game";

const QS = (c: Card) => c.suit === "S" && c.rank === "Q";
const KS = (c: Card) => c.suit === "S" && c.rank === "K";
const AS = (c: Card) => c.suit === "S" && c.rank === "A";

function bySuit(hand: Card[]): Record<Suit, Card[]> {
  const out: Record<Suit, Card[]> = { S: [], H: [], D: [], C: [] };
  for (const c of hand) out[c.suit].push(c);
  for (const s of Object.keys(out) as Suit[]) {
    out[s].sort((a, b) => rankValue(a.rank) - rankValue(b.rank));
  }
  return out;
}

/** Pick 3 cards to pass. Pure function — doesn't mutate state. */
export function pickPass(hand: Card[]): Card[] {
  const by = bySuit(hand);
  const picks: Card[] = [];

  // 1. Q♠ if held without enough cover (need ≥3 low spades to keep it).
  if (by.S.some(QS)) {
    const lowSpades = by.S.filter((c) => rankValue(c.rank) < rankValue("Q")).length;
    if (lowSpades < 3) {
      picks.push(by.S.find(QS)!);
    }
  }

  // 2. A♠ / K♠ if held — high enough to lose a trick to.
  for (const c of by.S) {
    if (picks.length >= 3) break;
    if ((AS(c) || KS(c)) && !picks.includes(c)) picks.push(c);
  }

  // 3. High hearts (A, K, Q).
  for (const c of [...by.H].reverse()) {
    if (picks.length >= 3) break;
    if (rankValue(c.rank) >= rankValue("Q")) picks.push(c);
  }

  // 4. High cards in any other suit (A, K).
  for (const s of ["D", "C"] as Suit[]) {
    for (const c of [...by[s]].reverse()) {
      if (picks.length >= 3) break;
      if (rankValue(c.rank) >= rankValue("K")) picks.push(c);
    }
  }

  // 5. Pad with highest remaining non-Q♠ cards.
  if (picks.length < 3) {
    const rest = hand.filter((c) => !picks.includes(c));
    rest.sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
    for (const c of rest) {
      if (picks.length >= 3) break;
      picks.push(c);
    }
  }

  return picks.slice(0, 3);
}

/** Choose one card to play for `seat`. */
export function pickPlay(state: HeartsState, seat: number): Card {
  const legal = legalPlays(state, seat);
  if (legal.length === 1) return legal[0];

  const trick = state.trick;
  const isLead = trick.suit === null;
  const hand = state.hands[seat];

  if (isLead) {
    // Avoid leading high cards. Prefer the lowest card from the
    // shortest non-heart suit (to try to void it).
    const grouped = bySuit(hand);
    const candidates = legal.slice().sort((a, b) => {
      const lenDiff = grouped[a.suit].length - grouped[b.suit].length;
      if (lenDiff !== 0) return lenDiff;
      return rankValue(a.rank) - rankValue(b.rank);
    });
    // Avoid Q♠ on the lead if we hold ≥3 spades (still in danger).
    for (const c of candidates) {
      if (!QS(c)) return c;
    }
    return candidates[0];
  }

  // Following or discarding.
  const followers = legal.filter((c) => c.suit === trick.suit);
  if (followers.length > 0) {
    // Following suit. Determine the highest of the led suit already played.
    let highestInPlay = 0;
    for (const c of trick.plays) {
      if (c && c.suit === trick.suit) {
        highestInPlay = Math.max(highestInPlay, rankValue(c.rank));
      }
    }
    const isLastToPlay =
      trick.plays.filter((p) => p !== null).length === 3;
    const trickPoints = trick.plays.reduce<number>(
      (acc, c) => acc + (c ? cardPoints(c) : 0),
      0,
    );

    // If hearts is led and we have one, dump our highest heart that
    // doesn't take the trick.
    const under = followers.filter((c) => rankValue(c.rank) < highestInPlay);
    if (under.length > 0) {
      // Slough off our highest possible card that's still below the
      // current trick-taker — gets rid of trouble without taking.
      return under.reduce((best, c) =>
        rankValue(c.rank) > rankValue(best.rank) ? c : best,
      );
    }

    // Can only beat the trick. If it's safe (no points yet) and we're
    // last to play, take with the lowest of our followers (cheap take).
    if (trickPoints === 0 && isLastToPlay) {
      return followers[0];
    }
    // Otherwise duck with the lowest follower.
    return followers[0];
  }

  // Off-suit discard. Drop danger.
  // Priority: Q♠, then A♠/K♠, then highest heart, then highest of any suit.
  const qs = legal.find(QS);
  if (qs) return qs;
  const ks = legal.find(KS);
  if (ks) return ks;
  const as = legal.find(AS);
  if (as) return as;

  const hearts = legal.filter((c) => c.suit === "H");
  if (hearts.length > 0) {
    return hearts.reduce((best, c) =>
      rankValue(c.rank) > rankValue(best.rank) ? c : best,
    );
  }
  // No points to dump — just dump the highest legal card.
  return legal.reduce((best, c) =>
    rankValue(c.rank) > rankValue(best.rank) ? c : best,
  );
}
