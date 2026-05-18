import type { Component, JSX } from "solid-js";
import { Show } from "solid-js";
import type { Card as CardModel } from "./types";
import { SuitShape, suitColorClass } from "./SuitShape";
import { PipGrid } from "./PipGrid";
import { FaceCardArt } from "./FaceCardArt";

/* ---------- Vista-style card ----------
 *
 * 3-column grid:
 *   ┌──────┬────────────┬──────┐
 *   │ TL   │            │      │
 *   │      │  card-body │      │
 *   │      │            │      │
 *   │      │            │      │
 *   │      │            │  BR  │
 *   └──────┴────────────┴──────┘
 *
 * The card-body is constrained to the middle column, so its pip art
 * physically cannot intrude on the corner indices (different grid
 * columns). Pips inside the body are placed in a CSS-grid layout
 * (see PipGrid), so adjacent pips can never overlap either — each
 * lives in its own cell with a square SVG sized to fit.
 *
 * Card stacking exposes the top --card-top-h px, which is the
 * height of the top-left corner index.
 */

export interface CardProps {
  card: CardModel;
  /** Inline absolute position inside its pile slot. */
  top?: string;
  left?: string;
  /** Make it draggable (drag manager reads this dataset attr). */
  movable?: boolean;
  /** Marker for which logical pile and indices the DOM element belongs to. */
  pile?: string;
  pileIndex?: number;
  cardIndex?: number;
  selected?: boolean;
  hintFlash?: boolean;
  /** Treat as drag clone — disables interactions, shows lifted shadow. */
  dragging?: boolean;
}

const CornerIndex: Component<{ card: CardModel }> = (props) => (
  <>
    <span class="rank">{props.card.rank}</span>
    <SuitShape suit={props.card.suit} class="suit" />
  </>
);

const Body: Component<{ card: CardModel }> = (props) => {
  const r = props.card.rank;
  if (r === "A") {
    return (
      <div class="ace-art">
        <SuitShape suit={props.card.suit} />
      </div>
    );
  }
  if (r === "J" || r === "Q" || r === "K") {
    return <FaceCardArt rank={r} suit={props.card.suit} />;
  }
  return <PipGrid rank={r} suit={props.card.suit} />;
};

export const Card: Component<CardProps> = (props) => {
  const style = (): JSX.CSSProperties => {
    const s: JSX.CSSProperties = {};
    if (props.top !== undefined) s.top = props.top;
    if (props.left !== undefined) s.left = props.left;
    return s;
  };

  const classList = () => ({
    "face-down": !props.card.faceUp,
    "face-up": props.card.faceUp,
    [suitColorClass(props.card.suit)]: props.card.faceUp,
    "face-card": props.card.faceUp &&
      (props.card.rank === "J" || props.card.rank === "Q" || props.card.rank === "K"),
    selected: !!props.selected,
    "hint-flash": !!props.hintFlash,
    dragging: !!props.dragging,
  });

  return (
    <div
      class="card"
      classList={classList()}
      style={style()}
      data-card-id={props.card.id}
      data-pile={props.pile}
      data-pile-index={props.pileIndex}
      data-card-index={props.cardIndex}
      data-movable={props.movable ? "1" : undefined}
    >
      <Show when={props.card.faceUp}>
        <div class="card-top">
          <CornerIndex card={props.card} />
        </div>
        <div class="card-body">
          <Body card={props.card} />
        </div>
        <div class="card-bottom">
          <CornerIndex card={props.card} />
        </div>
      </Show>
    </div>
  );
};
