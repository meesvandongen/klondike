/* ---------- Web menu bar ----------
 *
 * Rendered only when the page is running in a browser (i.e. not
 * embedded in Tauri). It mirrors the native menu defined in
 * `src-tauri/src/lib.rs` so the web build doesn't lose access to
 * New Game, Undo, Hint, Options, etc.
 *
 * Items are dispatched through the same `fire(action)` channel
 * used by the Tauri menu listener, so individual games don't need
 * any new wiring beyond what they already register.
 */
import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { fire } from "./menu";

export interface MenuItem {
  /** Visible label. */
  label: string;
  /** Action id to fire on click. Omit on separators. */
  action?: string;
  /** Optional shortcut hint shown right-aligned. */
  shortcut?: string;
  /** When true, the item is rendered with a leading check glyph. */
  checked?: boolean;
  /** When true, the item is disabled. */
  disabled?: boolean;
}

export interface MenuColumn {
  label: string;
  items: (MenuItem | { separator: true })[];
}

function isSeparator(it: MenuItem | { separator: true }): it is { separator: true } {
  return (it as { separator?: true }).separator === true;
}

export function isWeb(): boolean {
  if (typeof window === "undefined") return false;
  return !window.__TAURI__;
}

export interface StandardMenuOpts {
  appName: string;
  /** Show Auto-Complete toggle in the Edit menu. */
  hasAutoComplete?: boolean;
  /** Current auto-complete state (for the check glyph). */
  autoComplete?: boolean;
  /** Show Draw One / Draw Three radios in the View menu. */
  hasDrawModes?: boolean;
  /** Current draw mode (1 or 3) for the check glyph. */
  drawMode?: number;
  /** Show Hint item in Edit menu. Hearts hides this. */
  hasHint?: boolean;
}

/** Default suite of menus matching the native Tauri menu. */
export function standardMenus(opts: StandardMenuOpts): MenuColumn[] {
  const edit: (MenuItem | { separator: true })[] = [
    { label: "Undo", action: "undo", shortcut: "Ctrl+Z" },
  ];
  if (opts.hasHint !== false) {
    edit.push({ separator: true });
    edit.push({ label: "Hint", action: "hint", shortcut: "H" });
  }
  if (opts.hasAutoComplete) {
    edit.push({
      label: "Auto-Complete",
      action: "auto-complete",
      shortcut: "Ctrl+A",
      checked: opts.autoComplete ?? true,
    });
  }

  const view: (MenuItem | { separator: true })[] = [];
  if (opts.hasDrawModes) {
    view.push({ label: "Draw One",   action: "draw-1", checked: opts.drawMode === 1 });
    view.push({ label: "Draw Three", action: "draw-3", checked: opts.drawMode === 3 });
    view.push({ separator: true });
  }
  view.push({ label: "Zoom In",     action: "zoom-in",    shortcut: "Ctrl+=" });
  view.push({ label: "Zoom Out",    action: "zoom-out",   shortcut: "Ctrl+-" });
  view.push({ label: "Actual Size", action: "zoom-reset", shortcut: "Ctrl+0" });

  return [
    {
      label: "Game",
      items: [
        { label: "New Game", action: "new-game", shortcut: "F2" },
        { label: "Restart",  action: "restart" },
        { separator: true },
        { label: "Statistics…", action: "stats" },
        { label: "Options…",    action: "options" },
      ],
    },
    { label: "Edit", items: edit },
    { label: "View", items: view },
    {
      label: "Help",
      items: [
        { label: "How to Play", action: "how-to-play" },
        { separator: true },
        { label: `About ${opts.appName}`, action: "about" },
      ],
    },
  ];
}

export function WebMenuBar(props: { menus: () => MenuColumn[]; appName: string }) {
  const [open, setOpen] = createSignal<number | null>(null);

  function closeOnOutside(e: MouseEvent) {
    if (open() === null) return;
    const target = e.target as Element | null;
    if (target?.closest("#web-menu-bar")) return;
    setOpen(null);
  }
  // Only attach web-only behavior when actually running in a browser.
  // Inside Tauri the native menu replaces the web menu, and applying the
  // `data-web-menu` attribute would push the board down by 28px under
  // an invisible menu bar.
  const web = isWeb();
  onMount(() => {
    if (!web) return;
    document.addEventListener("mousedown", closeOnOutside);
    document.documentElement.dataset.webMenu = "1";
  });
  onCleanup(() => {
    if (!web) return;
    document.removeEventListener("mousedown", closeOnOutside);
    delete document.documentElement.dataset.webMenu;
  });

  return (
    <Show when={isWeb()}>
      <div id="web-menu-bar">
        <a class="menu-brand" href="../index.html">{props.appName}</a>
        <For each={props.menus()}>
          {(col, ci) => (
            <div
              class="menu-col"
              classList={{ open: open() === ci() }}
              onMouseEnter={() => { if (open() !== null) setOpen(ci()); }}
            >
              <button
                class="menu-col-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(open() === ci() ? null : ci());
                }}
              >
                {col.label}
              </button>
              <Show when={open() === ci()}>
                <div class="menu-dropdown">
                  <For each={col.items}>
                    {(it) => isSeparator(it) ? (
                      <div class="menu-sep" />
                    ) : (
                      <button
                        class="menu-item"
                        disabled={it.disabled}
                        onClick={() => {
                          setOpen(null);
                          if (it.action) fire(it.action);
                        }}
                      >
                        <span class="menu-check">{it.checked ? "✓" : ""}</span>
                        <span class="menu-label">{it.label}</span>
                        <Show when={it.shortcut}>
                          <span class="menu-shortcut">{it.shortcut}</span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
