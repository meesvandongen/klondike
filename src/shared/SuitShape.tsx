import type { Component } from "solid-js";
import type { Suit, SuitColor } from "./types";
import { SUIT_COLOR } from "./deck";

/* The suit shapes are defined in a 0..100 unit viewBox with the visual
 * centre at (50, 50). Each fills almost the full box so that a pip
 * rendered at size N occupies close to N units. */
const SHAPES: Record<Suit, () => unknown> = {
  H: () => (
    <path d="M50 92 C2 62 2 12 26 12 C38 12 50 22 50 36 C50 22 62 12 74 12 C98 12 98 62 50 92 Z" />
  ),
  D: () => <path d="M50 4 L94 50 L50 96 L6 50 Z" />,
  S: () => (
    <>
      <path d="M50 6 C96 30 96 62 50 72 C4 62 4 30 50 6 Z" />
      <path d="M32 94 L50 72 L68 94 Z" />
    </>
  ),
  C: () => (
    <>
      <circle cx="50" cy="22" r="19" />
      <circle cx="26" cy="56" r="19" />
      <circle cx="74" cy="56" r="19" />
      <path d="M44 68 C44 78 40 88 30 94 L70 94 C60 88 56 78 56 68 Z" />
    </>
  ),
};

export function suitColor(suit: Suit): string {
  return SUIT_COLOR[suit] === "red" ? "#c11414" : "#1a1a1a";
}

export function suitColorClass(suit: Suit): SuitColor {
  return SUIT_COLOR[suit];
}

/**
 * A square SVG of the given suit shape. Sized via CSS (width/height
 * on the SVG element) — the path itself lives in a fixed 0..100
 * viewBox so it scales perfectly at any rendered size.
 */
export const SuitShape: Component<{
  suit: Suit;
  class?: string;
  rotated?: boolean;
}> = (props) => {
  const Shape = () => SHAPES[props.suit]() as any;
  return (
    <svg
      class={props.class}
      classList={{ rotated: !!props.rotated }}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      fill={suitColor(props.suit)}
      aria-hidden="true"
    >
      <Shape />
    </svg>
  );
};
