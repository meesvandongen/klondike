export type Suit = "S" | "H" | "D" | "C";
export type SuitColor = "red" | "black";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
  | "J" | "Q" | "K";

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  faceUp: boolean;
}

export interface PileRef {
  pile: string;
  index: number;
  cardIndex?: number;
}

export interface MoveSource extends PileRef {}
export interface MoveDest {
  pile: string;
  index: number;
}

export interface Pickup {
  cards: Card[];
  src?: MoveSource;
  /** Click action when there's no card to pick up (e.g. stock recycle). */
  click?: () => void;
}

export interface DragHooks {
  boardEl: HTMLElement;
  dragLayerEl: HTMLElement;
  fanY: number | (() => number);
  isLocked?: () => boolean;
  getPickup: (e: PointerEvent, cardEl: HTMLElement | null) => Pickup | null;
  tryDrop: (src: MoveSource, dropEl: HTMLElement) => boolean;
  tryAutoMove: (src: MoveSource) => boolean;
  render: (skipIds: Set<string>) => void;
  onAfter?: () => void;
}
