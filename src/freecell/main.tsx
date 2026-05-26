/* ---------- FreeCell main wiring (SolidJS) ---------- */
import { render } from "solid-js/web";
import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";

import type { Card as CardModel, MoveSource, MoveDest, Pickup } from "../shared/types";
import { Card } from "../shared/Card";
import { ModalRoot, show as modalShow, close as modalClose } from "../shared/Modal";
import { Overlay } from "../shared/Overlay";
import { StatusBar } from "../shared/Status";
import { DragLayer } from "../shared/DragLayer";
import { createDragManager, skipIds } from "../shared/drag";
import { useNow } from "../shared/timer";
import { formatTime, cssVarPx } from "../shared/utils";
import { invoke as menuInvoke, registerMany, wire as wireMenu } from "../shared/menu";
import { bind as bindHotkeys } from "../shared/hotkeys";
import { applyInitial as applyInitialZoom, install as installZoom } from "../shared/zoom";
import * as Options from "../shared/options";
import * as Stats from "../shared/stats";
import { WebMenuBar, standardMenus } from "../shared/WebMenuBar";
import { coerce as coerceDifficulty, type Difficulty } from "../shared/difficulty";
import * as F from "./game";

const GAME_ID = "freecell";
interface AppOpts { autoComplete: boolean; zoom: number; difficulty: Difficulty }
const OPTION_DEFAULTS: AppOpts = { autoComplete: true, zoom: 1, difficulty: "easy" };

function cellsForDifficulty(d: Difficulty): number {
  if (d === "easy") return 4;
  if (d === "medium") return 2;
  return 1;
}

function App() {
  const opts = Options.load<AppOpts>(GAME_ID, OPTION_DEFAULTS);
  opts.difficulty = coerceDifficulty(opts.difficulty, "easy");
  applyInitialZoom(opts.zoom);
  const [autoComplete, setAutoComplete] = createSignal(opts.autoComplete);
  const [difficulty, setDifficulty] = createSignal<Difficulty>(opts.difficulty);
  const [state, setState] = createStore<F.FreeCellState>(
    F.newState({ numCells: cellsForDifficulty(difficulty()) }),
  );
  const now = useNow();
  let autoPlayActive = false;

  function persistOptions() {
    Options.save<AppOpts>(GAME_ID, {
      autoComplete: autoComplete(),
      zoom: opts.zoom,
      difficulty: difficulty(),
    });
  }

  /* ---- Actions ---- */

  function tryMove(src: MoveSource, dst: MoveDest): boolean {
    let ok = false;
    setState(produce((s) => { ok = F.move(s, src, dst); }));
    return ok;
  }

  function tryAutoMove(src: MoveSource): boolean {
    let ok = false;
    setState(produce((s) => { ok = F.autoMove(s, src); }));
    return ok;
  }

  function undo(): boolean {
    let ok = false;
    setState(produce((s) => { ok = F.undo(s); }));
    return ok;
  }

  /* ---- Win + auto-complete ---- */

  function maybeWinCheck() {
    if (!F.isWon(state) || state.finishedAt) return;
    setState("finishedAt", Date.now());
    const timeSec = Math.floor((state.finishedAt! - state.startedAt) / 1000);
    Stats.record(GAME_ID, { won: true, timeSec, score: state.score });
    modalShow({
      title: "You Win!",
      body: (
        <>
          <p style="margin:0 0 10px 0">You finished the deal.</p>
          <table>
            <tbody>
              <tr><td>Score</td><td>{state.score}</td></tr>
              <tr><td>Time</td><td>{formatTime(timeSec)}</td></tr>
              <tr><td>Moves</td><td>{state.moves}</td></tr>
            </tbody>
          </table>
        </>
      ),
      buttons: [
        { label: "New Game", primary: true, onClick: () => { modalClose(); newGame(); } },
        { label: "Close", onClick: modalClose },
      ],
    });
  }

  function runAutoPlay() {
    if (autoPlayActive) return;
    if (!autoComplete()) { maybeWinCheck(); return; }
    autoPlayActive = true;
    const tick = () => {
      if (!autoComplete() || state.finishedAt) {
        autoPlayActive = false;
        maybeWinCheck();
        return;
      }
      let moved = false;
      setState(produce((s) => { moved = F.safeAutoStep(s); }));
      if (moved) {
        setTimeout(tick, 80);
      } else {
        autoPlayActive = false;
        maybeWinCheck();
      }
    };
    tick();
  }

  function setAutoCompleteOpt(enabled: boolean, syncMenu: boolean) {
    setAutoComplete(enabled);
    persistOptions();
    if (syncMenu) menuInvoke("sync_auto_complete", { enabled });
    if (enabled) runAutoPlay();
  }

  function handleAutoCompleteAction(payload?: { checked?: boolean }) {
    if (payload && typeof payload.checked === "boolean") {
      setAutoCompleteOpt(payload.checked, false);
    } else {
      setAutoCompleteOpt(!autoComplete(), true);
    }
  }

  /* ---- Hint ---- */

  function showHint() {
    const h = F.hint(state);
    if (!h) return;
    let card: CardModel | null = null;
    if (h.src.pile === "tableau") {
      const p = state.tableau[h.src.index];
      card = p[h.src.cardIndex!] ?? null;
    } else if (h.src.pile === "cell") {
      card = state.cells[h.src.index];
    } else if (h.src.pile === "foundation") {
      const p = state.foundations[h.src.index];
      card = p[h.src.cardIndex!] ?? null;
    }
    if (!card) return;
    const el = document.querySelector(`.card[data-card-id="${CSS.escape(card.id)}"]`);
    if (el) {
      el.classList.add("hint-flash");
      setTimeout(() => el.classList.remove("hint-flash"), 1300);
    }
  }

  /* ---- New game ---- */

  function newGame() {
    if (state.moves > 0 && !state.finishedAt) {
      Stats.record(GAME_ID, { won: false });
    }
    setState(F.newState({ numCells: cellsForDifficulty(difficulty()) }));
  }

  /* ---- Drag pickup ---- */

  function getPickup(_e: PointerEvent, cardEl: HTMLElement | null): Pickup | null {
    if (state.finishedAt) return null;
    if (!cardEl) return null;
    const pile = cardEl.dataset.pile;
    if (!cardEl.dataset.movable) return null;

    const pileIndex = parseInt(cardEl.dataset.pileIndex ?? "0", 10);
    const cardIndex = parseInt(cardEl.dataset.cardIndex ?? "0", 10);

    let cards: CardModel[];
    if (pile === "tableau") {
      cards = state.tableau[pileIndex].slice(cardIndex);
      if (cards.length > 1 && !F.isValidSequence(cards)) return null;
    } else if (pile === "cell") {
      const c = state.cells[pileIndex];
      cards = c ? [c] : [];
    } else if (pile === "foundation") {
      const p = state.foundations[pileIndex];
      cards = p.length ? [p[p.length - 1]] : [];
    } else return null;

    if (!cards.length) return null;
    return { cards, src: { pile, index: pileIndex, cardIndex } };
  }

  function tryDrop(src: MoveSource, dropEl: HTMLElement): boolean {
    const pile = dropEl.dataset.pile;
    if (!pile) return false;
    const index = parseInt(dropEl.dataset.index ?? "0", 10);
    return tryMove(src, { pile, index });
  }

  /* ---- Dialogs ---- */

  function openStats() {
    const s = Stats.load(GAME_ID);
    const winPct = s.gamesPlayed ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0;
    const best = s.bestTimeSec == null ? "—" : formatTime(s.bestTimeSec);
    modalShow({
      title: "Statistics",
      body: (
        <table>
          <tbody>
            <tr><td>Games played</td><td>{s.gamesPlayed}</td></tr>
            <tr><td>Games won</td><td>{s.gamesWon}</td></tr>
            <tr><td>Win percentage</td><td>{winPct}%</td></tr>
            <tr><td>Best time</td><td>{best}</td></tr>
            <tr><td>Best score</td><td>{s.bestScore}</td></tr>
          </tbody>
        </table>
      ),
      buttons: [
        { label: "Reset", onClick: () => { Stats.reset(GAME_ID); modalClose(); } },
        { label: "OK", primary: true, onClick: modalClose },
      ],
    });
  }

  function openOptions() {
    let autoSel = autoComplete();
    let diffSel: Difficulty = difficulty();
    modalShow({
      title: "Options",
      body: (
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; flex-direction:column; gap:6px;">
            <span>Difficulty:</span>
            <label>
              <input type="radio" name="diff" value="easy"
                     checked={diffSel === "easy"}
                     onChange={() => { diffSel = "easy"; }} />
              Easy — 4 free cells
            </label>
            <label>
              <input type="radio" name="diff" value="medium"
                     checked={diffSel === "medium"}
                     onChange={() => { diffSel = "medium"; }} />
              Medium — 2 free cells
            </label>
            <label>
              <input type="radio" name="diff" value="hard"
                     checked={diffSel === "hard"}
                     onChange={() => { diffSel = "hard"; }} />
              Hard — 1 free cell
            </label>
          </div>
          <div style="padding-top:10px; border-top:1px solid #c5c5c5;">
            <label>
              <input type="checkbox" id="opt-autocomplete"
                     checked={autoSel}
                     onChange={(e) => { autoSel = (e.target as HTMLInputElement).checked; }} />
              Auto-play cards to foundation
            </label>
          </div>
        </div>
      ),
      buttons: [
        {
          label: "OK", primary: true,
          onClick: () => {
            modalClose();
            if (autoSel !== autoComplete()) setAutoCompleteOpt(autoSel, true);
            if (diffSel !== difficulty()) {
              setDifficulty(diffSel);
              persistOptions();
              newGame();
            }
          },
        },
        { label: "Cancel", onClick: modalClose },
      ],
    });
  }

  function showAbout() {
    modalShow({
      title: "About FreeCell",
      body: (
        <>
          <p style="margin:0 0 6px 0;"><strong>FreeCell</strong></p>
          <p style="margin:0 0 10px 0;">Version 1.0.0</p>
          <p style="margin:0;">A classic single-player card game; almost every deal is solvable.</p>
        </>
      ),
      buttons: [{ label: "OK", primary: true, onClick: modalClose }],
    });
  }

  function howToPlay() {
    modalShow({
      title: "How to Play",
      body: (
        <>
          <p style="margin:0 0 8px 0;">Build four foundations up by suit from Ace to King.</p>
          <p style="margin:0 0 8px 0;">In the cascades, stack cards in alternating colours, descending in rank.</p>
          <p style="margin:0 0 8px 0;">Four free cells each hold a single card to help with manoeuvring.</p>
          <p style="margin:0;">Multi-card moves are allowed if enough free cells and empty cascades are available.</p>
        </>
      ),
      buttons: [{ label: "OK", primary: true, onClick: modalClose }],
    });
  }

  /* ---- Boot ---- */

  let boardRef: HTMLDivElement | undefined;

  onMount(() => {
    registerMany({
      "new-game": () => newGame(),
      "restart": () => newGame(),
      "undo": () => { undo(); },
      "hint": showHint,
      "auto-complete": handleAutoCompleteAction,
      "stats": openStats,
      "options": openOptions,
      "about": showAbout,
      "how-to-play": howToPlay,
    });

    installZoom({
      initial: opts.zoom,
      onChange: (z) => { opts.zoom = z; persistOptions(); },
    });

    wireMenu();
    menuInvoke("sync_auto_complete", { enabled: autoComplete() });

    bindHotkeys({
      "F2": "new-game",
      "ctrl+z": "undo",
      "ctrl+a": "auto-complete",
      "h": "hint",
      "ctrl+=": "zoom-in",
      "ctrl+shift++": "zoom-in",
      "ctrl+-": "zoom-out",
      "ctrl+0": "zoom-reset",
    });

    const dragMgr = createDragManager({
      boardEl: boardRef!,
      fanY: () => cssVarPx("--tableau-fan-up"),
      isLocked: () => !!state.finishedAt,
      getPickup,
      tryDrop,
      tryAutoMove,
      onAfter: runAutoPlay,
    });
    dragMgr.attach();
    onCleanup(() => dragMgr.destroy());
  });

  /* ---- View ---- */

  const fanUpPx = createMemo(() => cssVarPx("--tableau-fan-up"));

  // Recompute fan offsets when zoom changes.
  const [zoomKey, setZoomKey] = createSignal(0);
  onMount(() => {
    const obs = new MutationObserver(() => setZoomKey((k) => k + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-zoom"] });
    onCleanup(() => obs.disconnect());
  });
  const fanUp = () => { zoomKey(); return fanUpPx(); };

  function isSkipped(id: string): boolean {
    return skipIds().has(id);
  }

  return (
    <>
      <WebMenuBar
        appName="FreeCell"
        menus={() => standardMenus({
          appName: "FreeCell",
          hasAutoComplete: true,
          autoComplete: autoComplete(),
        })}
      />
      <div id="board" class="freecell-board" ref={boardRef}>
        <div id="top-row">
          {/* Cells */}
          <For each={Array.from({ length: state.cells.length }, (_, i) => i)}>
            {(i) => (
              <div
                class="pile-slot cell"
                data-pile="cell"
                data-index={i}
              >
                {(() => {
                  const visible = createMemo(() => {
                    const c = state.cells[i];
                    if (!c) return null;
                    if (isSkipped(c.id)) return null;
                    return c;
                  });
                  return (
                    <Show when={visible()}>
                      {(c) => (
                        <Card
                          card={c()}
                          top="0px" left="0px"
                          pile="cell"
                          pileIndex={i}
                          cardIndex={0}
                          movable
                        />
                      )}
                    </Show>
                  );
                })()}
              </div>
            )}
          </For>

          <div class="spacer" />

          {/* Foundations */}
          <For each={[0, 1, 2, 3]}>
            {(f) => (
              <div
                class="pile-slot foundation"
                data-pile="foundation"
                data-index={f}
              >
                {(() => {
                  const top = createMemo(() => {
                    const p = state.foundations[f];
                    for (let i = p.length - 1; i >= 0; i--) {
                      if (!isSkipped(p[i].id)) return { card: p[i], index: i };
                    }
                    return null;
                  });
                  return (
                    <Show when={top()}>
                      {(t) => (
                        <Card
                          card={t().card}
                          top="0px" left="0px"
                          pile="foundation"
                          pileIndex={f}
                          cardIndex={t().index}
                          movable
                        />
                      )}
                    </Show>
                  );
                })()}
              </div>
            )}
          </For>
        </div>

        <div id="tableau-row">
          <For each={[0, 1, 2, 3, 4, 5, 6, 7]}>
            {(t) => {
              const cells = createMemo(() => {
                const p = state.tableau[t];
                const out: { card: CardModel; idx: number; offset: number }[] = [];
                let offset = 0;
                for (let i = 0; i < p.length; i++) {
                  const c = p[i];
                  if (isSkipped(c.id)) break;
                  out.push({ card: c, idx: i, offset });
                  offset += fanUp();
                }
                return out;
              });
              return (
                <div
                  class="pile-slot tall"
                  data-pile="tableau"
                  data-index={t}
                >
                  <For each={cells()}>
                    {(v) => (
                      <Card
                        card={v.card}
                        top={`${v.offset}px`}
                        left="0px"
                        pile="tableau"
                        pileIndex={t}
                        cardIndex={v.idx}
                        movable
                      />
                    )}
                  </For>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <StatusBar
        score={state.score}
        moves={state.moves}
        startedAt={state.startedAt}
        finishedAt={state.finishedAt}
        now={now()}
      />

      <DragLayer />
      <Overlay />
      <ModalRoot />
    </>
  );
}

render(() => <App />, document.getElementById("app")!);
