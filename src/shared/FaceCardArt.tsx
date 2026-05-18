import type { Component } from "solid-js";
import { Show } from "solid-js";
import type { Suit } from "./types";
import { SUIT_COLOR } from "./deck";
import { suitColor } from "./SuitShape";

/* K / Q / J ornament — kept as a single fixed-aspect SVG; sits inside
 * the body cell so it never collides with the corner indices. */
export const FaceCardArt: Component<{ rank: "J" | "Q" | "K"; suit: Suit }> = (
  props,
) => {
  const color = () => suitColor(props.suit);
  const accent = () =>
    SUIT_COLOR[props.suit] === "red" ? "#8a0c0c" : "#404040";

  return (
    <svg
      class="face-card-art"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        fill="none"
        rx="4"
        stroke={color()}
        stroke-width="0.6"
        stroke-opacity="0.4"
      />
      <Show when={props.rank === "K"}>
        <g transform="translate(50 46)">
          <rect x="-24" y="6" width="48" height="6" fill={color()} />
          <path
            d="M -24 7 L -19 -10 L -10 5 L -3 -12 L 0 -18 L 3 -12 L 10 5 L 19 -10 L 24 7 Z"
            fill={color()}
            stroke={accent()}
            stroke-width="1"
            stroke-linejoin="round"
          />
          <circle cx="-19" cy="-10" r="3" fill="#fff" stroke={color()} stroke-width="1.2" />
          <circle cx="0" cy="-18" r="3.4" fill="#fff" stroke={color()} stroke-width="1.2" />
          <circle cx="19" cy="-10" r="3" fill="#fff" stroke={color()} stroke-width="1.2" />
          <path
            d="M 0 -18 L 0 -30 M -5 -25 L 5 -25"
            stroke={color()}
            stroke-width="2.2"
            fill="none"
            stroke-linecap="round"
          />
        </g>
      </Show>
      <Show when={props.rank === "Q"}>
        <g transform="translate(50 48)">
          <rect x="-20" y="6" width="40" height="5" fill={color()} />
          <path
            d="M -20 7 L -15 -7 L -8 5 L 0 -12 L 8 5 L 15 -7 L 20 7 Z"
            fill={color()}
            stroke={accent()}
            stroke-width="1"
            stroke-linejoin="round"
          />
          <circle cx="-15" cy="-7" r="2.6" fill="#fff" stroke={color()} stroke-width="1" />
          <circle cx="0" cy="-12" r="3.2" fill="#fff" stroke={color()} stroke-width="1" />
          <circle cx="15" cy="-7" r="2.6" fill="#fff" stroke={color()} stroke-width="1" />
          <g transform="translate(0 -22)">
            <circle cx="0" cy="0" r="3" fill={color()} />
            <circle cx="-5" cy="2" r="2.6" fill={color()} />
            <circle cx="5" cy="2" r="2.6" fill={color()} />
            <circle cx="0" cy="5" r="2.6" fill={color()} />
          </g>
        </g>
      </Show>
      <Show when={props.rank === "J"}>
        <g transform="translate(50 52)">
          <path
            d="M 0 -28 Q -10 -18 -8 -6 Q -13 1 -8 10 Q -3 18 0 18 Q 3 18 8 10 Q 13 1 8 -6 Q 10 -18 0 -28 Z"
            fill={color()}
            stroke={accent()}
            stroke-width="1"
            stroke-linejoin="round"
          />
          <path d="M 0 -28 L 0 16" stroke={accent()} stroke-width="0.9" fill="none" />
          <path
            d="M -3 -19 Q -1 -18 0 -16 M 3 -19 Q 1 -18 0 -16"
            stroke={accent()}
            stroke-width="0.6"
            fill="none"
          />
          <path
            d="M -6 -4 Q -2 -2 0 -1 M 6 -4 Q 2 -2 0 -1"
            stroke={accent()}
            stroke-width="0.6"
            fill="none"
          />
        </g>
      </Show>
    </svg>
  );
};
