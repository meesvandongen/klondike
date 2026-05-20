/* Shared Tauri menu listener + action dispatcher.
 * Actions are functions of an optional payload. Plain menu items fire
 * with the action id as a string; check items fire with a payload
 * { id, checked }. Hotkey-driven fires omit the payload. */

interface MenuPayload {
  id: string;
  checked?: boolean;
}

type Action = (payload?: MenuPayload) => void;

interface TauriEventApi {
  listen: (
    name: string,
    handler: (event: { payload: unknown }) => void,
  ) => Promise<unknown>;
}

interface TauriCoreApi {
  invoke: (name: string, args?: unknown) => Promise<unknown>;
}

interface TauriGlobal {
  event?: TauriEventApi;
  core?: TauriCoreApi;
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
  }
}

const actions: Record<string, Action> = {};
const lastFiredAt = new Map<string, number>();

export function register(id: string, fn: Action): void {
  actions[id] = fn;
}

export function registerMany(map: Record<string, Action>): void {
  Object.assign(actions, map);
}

export function fire(id: string, payload?: MenuPayload): void {
  const fn = actions[id];
  if (!fn) return;
  const now = Date.now();
  if (now - (lastFiredAt.get(id) ?? 0) < 200) return;
  lastFiredAt.set(id, now);
  fn(payload);
}

export async function wire(): Promise<void> {
  const t = window.__TAURI__;
  if (!t?.event?.listen) return;
  try {
    await t.event.listen("menu", (event) => {
      const p = event.payload;
      if (typeof p === "string") {
        fire(p);
      } else if (
        p && typeof p === "object" &&
        typeof (p as MenuPayload).id === "string"
      ) {
        fire((p as MenuPayload).id, p as MenuPayload);
      }
    });
  } catch (_) {
    /* ignore */
  }
}

export function invoke(name: string, args?: unknown): Promise<unknown> {
  const t = window.__TAURI__;
  if (!t?.core?.invoke) return Promise.resolve();
  try {
    return t.core.invoke(name, args);
  } catch (_) {
    return Promise.resolve();
  }
}
