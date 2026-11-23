/* Shared native-menu listener + action dispatcher.
 * Actions are functions of an optional payload. The desktop app's menu
 * (main.go) sends { id } for plain items and { id, checked } for check
 * items; hotkey-driven and web-menu fires omit the payload. */
import { isMyGo } from "mygo-runtime";
import { Menu, events, type MenuAction } from "./mygo";

type MenuPayload = MenuAction;

type Action = (payload?: MenuPayload) => void;

const actions: Record<string, Action> = {};
const lastFiredAt = new Map<string, number>();

/** Whether the page runs in the MyGo desktop app (vs. a browser tab). */
export function isDesktop(): boolean {
  return isMyGo();
}

export function register(id: string, fn: Action): void {
  actions[id] = fn;
}

export function registerMany(map: Record<string, Action>): void {
  Object.assign(actions, map);
}

export function fire(id: string, payload?: MenuPayload): void {
  const fn = actions[id];
  if (!fn) return;
  // A menu accelerator and the page's own hotkey handler can both see
  // the same key press; collapse them into one action.
  const now = Date.now();
  if (now - (lastFiredAt.get(id) ?? 0) < 200) return;
  lastFiredAt.set(id, now);
  fn(payload);
}

export function wire(): void {
  if (!isDesktop()) return;
  events.menu.on((p) => {
    if (p && typeof p.id === "string") {
      fire(p.id, p.checked === undefined ? undefined : p);
    }
  });
}

/** Check Draw One / Draw Three in the native menu. No-op in a browser. */
export function syncDrawMode(mode: number): void {
  if (isDesktop()) Menu.syncDrawMode(mode).catch(() => {});
}

/** Check or uncheck Auto-Complete in the native menu. No-op in a browser. */
export function syncAutoComplete(enabled: boolean): void {
  if (isDesktop()) Menu.syncAutoComplete(enabled).catch(() => {});
}
