import { createSignal, onCleanup } from "solid-js";

/** 1 Hz signal of Date.now() — drives the elapsed-time clock. */
export function useNow() {
  const [now, setNow] = createSignal(Date.now());
  const handle = window.setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => clearInterval(handle));
  return now;
}
