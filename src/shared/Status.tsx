import type { Component } from "solid-js";
import { formatTime } from "./utils";

export interface StatusProps {
  score: number;
  moves: number;
  startedAt: number;
  finishedAt: number | null;
  /** Forces re-evaluation of elapsed time. Use a 1Hz signal so the
   * clock ticks while the timer is running. */
  now: number;
}

export const StatusBar: Component<StatusProps> = (props) => {
  const elapsedSec = () => {
    const end = props.finishedAt ?? props.now;
    return Math.max(0, Math.floor((end - props.startedAt) / 1000));
  };
  return (
    <div id="status-bar">
      <span id="status-score">Score: {props.score | 0}</span>
      <span id="status-time">Time: {formatTime(elapsedSec())}</span>
      <span id="status-moves">Moves: {props.moves | 0}</span>
    </div>
  );
};
