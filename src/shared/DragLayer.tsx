import { For, Show } from "solid-js";
import { Card } from "./Card";
import { dragVisual } from "./drag";

export function DragLayer() {
  return (
    <div id="drag-layer">
      <Show when={dragVisual()}>
        {(v) => (
          <For each={v().cards}>
            {(card, i) => (
              <Card
                card={card}
                left={`${v().x}px`}
                top={`${v().y + i() * v().fanY}px`}
                dragging
              />
            )}
          </For>
        )}
      </Show>
    </div>
  );
}
