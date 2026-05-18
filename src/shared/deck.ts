import type { Card, Rank, Suit, SuitColor } from "./types";

export const SUITS: readonly Suit[] = ["S", "H", "D", "C"];
export const RANKS: readonly Rank[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];

export const SUIT_GLYPH: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

export const SUIT_COLOR: Record<Suit, SuitColor> = {
  S: "black",
  C: "black",
  H: "red",
  D: "red",
};

export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 1;
}

export interface DeckOpts {
  numDecks?: number;
  suits?: readonly Suit[];
}

export function makeDeck(opts: DeckOpts = {}): Card[] {
  const numDecks = opts.numDecks ?? 1;
  const suits = opts.suits ?? SUITS;
  const cards: Card[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const s of suits) {
      for (const r of RANKS) {
        cards.push({ id: `${r}${s}#${d}`, rank: r, suit: s, faceUp: false });
      }
    }
  }
  return cards;
}
