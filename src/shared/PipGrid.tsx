import type { Component } from "solid-js";
import { For } from "solid-js";
import type { Rank, Suit } from "./types";
import { SuitShape } from "./SuitShape";

/**
 * Pip layout for number cards.
 *
 *   Each rank defines a fixed-row grid (3 columns: L, C, R). Pips
 *   sit in named cells so they CANNOT overlap each other — the grid
 *   distributes rows evenly and each pip occupies exactly one cell.
 *   The pip SVG is forced to be a perfect square that fits inside
 *   its cell (aspect-ratio + max-width/height in CSS), so adjacent
 *   pips can never collide regardless of card aspect or zoom.
 *
 *   `rot: true` rotates the pip 180° (used for the bottom half so
 *   the layout reads symmetrically when the card is flipped).
 */

type Col = "L" | "C" | "R";
interface PipCell {
  col: Col;
  row: number;
  rot: boolean;
}

export interface RankLayout {
  rows: number;
  pips: PipCell[];
}

/* Classic playing-card pip patterns. Top half pips read in card-up
 * orientation; bottom half pips are rotated 180° so the card is
 * point-symmetric (the traditional look). */
const LAYOUTS: Record<Exclude<Rank, "A" | "J" | "Q" | "K">, RankLayout> = {
  "2": {
    rows: 2,
    pips: [
      { col: "C", row: 1, rot: false },
      { col: "C", row: 2, rot: true },
    ],
  },
  "3": {
    rows: 3,
    pips: [
      { col: "C", row: 1, rot: false },
      { col: "C", row: 2, rot: false },
      { col: "C", row: 3, rot: true },
    ],
  },
  "4": {
    rows: 2,
    pips: [
      { col: "L", row: 1, rot: false },
      { col: "R", row: 1, rot: false },
      { col: "L", row: 2, rot: true },
      { col: "R", row: 2, rot: true },
    ],
  },
  "5": {
    rows: 3,
    pips: [
      { col: "L", row: 1, rot: false },
      { col: "R", row: 1, rot: false },
      { col: "C", row: 2, rot: false },
      { col: "L", row: 3, rot: true },
      { col: "R", row: 3, rot: true },
    ],
  },
  "6": {
    rows: 3,
    pips: [
      { col: "L", row: 1, rot: false },
      { col: "R", row: 1, rot: false },
      { col: "L", row: 2, rot: false },
      { col: "R", row: 2, rot: false },
      { col: "L", row: 3, rot: true },
      { col: "R", row: 3, rot: true },
    ],
  },
  "7": {
    rows: 4,
    pips: [
      { col: "L", row: 1, rot: false },
      { col: "R", row: 1, rot: false },
      { col: "C", row: 2, rot: false },
      { col: "L", row: 3, rot: true },
      { col: "R", row: 3, rot: true },
      { col: "L", row: 4, rot: true },
      { col: "R", row: 4, rot: true },
    ],
  },
  "8": {
    rows: 5,
    pips: [
      { col: "L", row: 1, rot: false },
      { col: "R", row: 1, rot: false },
      { col: "C", row: 2, rot: false },
      { col: "L", row: 3, rot: false },
      { col: "R", row: 3, rot: false },
      { col: "C", row: 4, rot: true },
      { col: "L", row: 5, rot: true },
      { col: "R", row: 5, rot: true },
    ],
  },
  "9": {
    rows: 5,
    pips: [
      { col: "L", row: 1, rot: false },
      { col: "R", row: 1, rot: false },
      { col: "L", row: 2, rot: false },
      { col: "R", row: 2, rot: false },
      { col: "C", row: 3, rot: false },
      { col: "L", row: 4, rot: true },
      { col: "R", row: 4, rot: true },
      { col: "L", row: 5, rot: true },
      { col: "R", row: 5, rot: true },
    ],
  },
  "10": {
    rows: 6,
    pips: [
      { col: "L", row: 1, rot: false },
      { col: "R", row: 1, rot: false },
      { col: "C", row: 2, rot: false },
      { col: "L", row: 3, rot: false },
      { col: "R", row: 3, rot: false },
      { col: "L", row: 4, rot: true },
      { col: "R", row: 4, rot: true },
      { col: "C", row: 5, rot: true },
      { col: "L", row: 6, rot: true },
      { col: "R", row: 6, rot: true },
    ],
  },
};

const COL_INDEX: Record<Col, number> = { L: 1, C: 2, R: 3 };

export const PipGrid: Component<{ rank: Rank; suit: Suit }> = (props) => {
  const layout = () => LAYOUTS[props.rank as keyof typeof LAYOUTS];
  return (
    <div
      class="pip-grid"
      style={{
        "grid-template-rows": `repeat(${layout().rows}, 1fr)`,
      }}
    >
      <For each={layout().pips}>
        {(cell) => (
          <div
            class="pip-cell"
            style={{
              "grid-column": COL_INDEX[cell.col],
              "grid-row": cell.row,
            }}
          >
            <SuitShape suit={props.suit} rotated={cell.rot} />
          </div>
        )}
      </For>
    </div>
  );
};
