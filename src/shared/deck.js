/* ---------- Shared deck primitives ---------- */
(function () {
  const SUITS = ["S", "H", "D", "C"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUIT_GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" };
  const SUIT_COLOR = { S: "black", C: "black", H: "red", D: "red" };

  function rankValue(rank) {
    return RANKS.indexOf(rank) + 1;
  }

  /**
   * Build a deck.
   *   { numDecks=1, suits=SUITS } -> array of {id, rank, suit, faceUp:false}
   * Card ids include the deck index so multi-deck builds stay unique.
   */
  function makeDeck(opts = {}) {
    const numDecks = opts.numDecks || 1;
    const suits = opts.suits || SUITS;
    const cards = [];
    for (let d = 0; d < numDecks; d++) {
      for (const s of suits) {
        for (const r of RANKS) {
          cards.push({ id: `${r}${s}#${d}`, rank: r, suit: s, faceUp: false });
        }
      }
    }
    return cards;
  }

  window.Deck = {
    SUITS, RANKS, SUIT_GLYPH, SUIT_COLOR,
    rankValue, makeDeck
  };
})();
