import { createSignal, Show, For, type JSX } from "solid-js";

export interface ModalButton {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

interface ModalState {
  title: string;
  body: JSX.Element;
  buttons: ModalButton[];
}

const [state, setState] = createSignal<ModalState | null>(null);

export function show(opts: {
  title: string;
  body: JSX.Element;
  buttons?: ModalButton[];
}): void {
  setState({
    title: opts.title,
    body: opts.body,
    buttons: opts.buttons ?? [{ label: "OK", onClick: close, primary: true }],
  });
}

export function close(): void {
  setState(null);
}

export function isOpen(): boolean {
  return state() !== null;
}

export function activatePrimary(): void {
  const s = state();
  if (!s) return;
  const primary = s.buttons.find((b) => b.primary) ?? s.buttons[0];
  primary?.onClick();
}

export function ModalRoot() {
  return (
    <Show when={state()}>
      {(s) => (
        <div id="modal-root">
          <div class="modal-backdrop" onClick={close}></div>
          <div class="modal">
            <div class="modal-title-bar">
              <span class="modal-title">{s().title}</span>
              <button
                class="modal-close"
                aria-label="Close"
                onClick={close}
              >
                ×
              </button>
            </div>
            <div class="modal-content">{s().body}</div>
            <div class="modal-buttons">
              <For each={s().buttons}>
                {(b) => (
                  <button
                    onClick={b.onClick}
                    autofocus={b.primary || undefined}
                  >
                    {b.label}
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
