import { createSignal, Show } from "solid-js";

const [visible, setVisible] = createSignal(false);
const [label, setLabel] = createSignal("Dealing…");

export function show(text?: string): void {
  if (text) setLabel(text);
  setVisible(true);
}

export function hide(): void {
  setVisible(false);
}

export function Overlay() {
  return (
    <Show when={visible()}>
      <div id="dealing-overlay">
        <div class="dealing-card" />
        <div class="dealing-label">{label()}</div>
      </div>
    </Show>
  );
}
