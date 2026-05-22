/* ---------- Spider main wiring (SolidJS) ---------- */
import { render } from "solid-js/web";
import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";

import type { Card as CardModel, MoveSource, Pickup } from "../shared/types";
import { Card } from "../shared/Card";
import { ModalRoot, show as modalShow, close as modalClose } from "../shared/Modal";
import { Overlay } from "../shared/Overlay";
import { StatusBar } from "../shared/Status";
import { DragLayer } from "../shared/DragLayer";
import { createDragManager, skipIds } from "../shared/drag";
import { useNow } from "../shared/timer";
import { formatTime, cssVarPx } from "../shared/utils";
import { registerMany, wire as wireMenu } from "../shared/menu";
import { bind as bindHotkeys } from "../shared/hotkeys";
import { install as installZoom } from "../shared/zoom";
import * as Options from "../shared/options";
import * as Stats from "../shared/stats";
import { WebMenuBar, standardMenus } from "../shared/WebMenuBar";
import * as S from "./game";

const GAME_ID = "spider";
interface AppOpts { zoom: number }
const OPTION_DEFAULTS: AppOpts = { zoom: 1 };

function App() {
  const opts = Options.load<AppOpts>(GAME_ID, OPTION_DEFAULTS);
  const [state, setState] = createStore<S.SpiderState>(S.newState());
  const now = useNow();

  function persistOptions() {
    Options.save<AppOpts>(GAME_ID, { zoom: opts.zoom });
  }

  /* ---- Actions ---- */

  function tryMoveSrcDst(src: MoveSource, dstIndex: number): boolean {
    let ok = false;
    setState(produce((s) => {
      ok = S.move(s, src, { pile: "tableau", index: dstIndex });
    }));
    return ok;
  }

  function tryAutoMove(src: MoveSource): boolean {
    let ok = false;
    setState(produce((s) => { ok = S.autoMove(s, src); }));
    return ok;
  }

  function dealStock(): boolean {
    let ok = false;
    setState(produce((s) => { ok = S.dealFromStock(s); }));
    return ok;
  }

  function undo(): boolean {
    let ok = false;
    setState(produce((s) => { ok = S.undo(s); }));
    return ok;
  }

  /* ---- Win + hint ---- */

  function maybeWinCheck() {
    if (!S.isWon(state) || state.finishedAt) return;
    setState("finishedAt", Date.now());
    const timeSec = Math.floor((state.finishedAt! - state.startedAt) / 1000);
    Stats.record(GAME_ID, { won: true, timeSec, score: state.score });
    modalShow({
      title: "You Win!",
      body: (
        <>
          <p style="margin:0 0 10px 0">All eight sequences completed.</p>
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

  function showHint() {
    const h = S.hint(state);
    if (!h) return;
    const cardId = state.tableau[h.src.index][h.src.cardIndex!].id;
    const el = document.querySelector(`.card[data-card-id="${CSS.escape(cardId)}"]`);
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
    setState(S.newState());
  }

  /* ---- Drag pickup ---- */

  function getPickup(e: PointerEvent, cardEl: HTMLElement | null): Pickup | null {
    if (state.finishedAt) return null;

    const stockSlot = (e.target as Element).closest?.("#stock");
    if (stockSlot) {
      return {
        cards: [],
        click: () => {
          const dealt = dealStock();
          if (dealt) {
            maybeWinCheck();
          } else if (state.tableau.some((c) => c.length === 0)) {
            modalShow({
              title: "Cannot Deal",
              body: <p style="margin:0;">All columns must contain at least one card before dealing.</p>,
              buttons: [{ label: "OK", primary: true, onClick: modalClose }],
            });
          }
        },
      };
    }
    if (!cardEl) return null;
    if (!cardEl.dataset.movable) return null;
    const pileIndex = parseInt(cardEl.dataset.pileIndex ?? "0", 10);
    const cardIndex = parseInt(cardEl.dataset.cardIndex ?? "0", 10);
    const cards = state.tableau[pileIndex].slice(cardIndex);
    if (!cards.length || !S.isMovableRun(cards)) return null;
    return { cards, src: { pile: "tableau", index: pileIndex, cardIndex } };
  }

  function tryDrop(src: MoveSource, dropEl: HTMLElement): boolean {
    const pile = dropEl.dataset.pile;
    if (pile !== "tableau") return false;
    const index = parseInt(dropEl.dataset.index ?? "0", 10);
    return tryMoveSrcDst(src, index);
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
    modalShow({
      title: "Options",
      body: <p style="margin:0;">Spider is running in 1-suit mode (Spades only). Future versions will offer 2- and 4-suit difficulty.</p>,
      buttons: [{ label: "OK", primary: true, onClick: modalClose }],
    });
  }

  function showAbout() {
    modalShow({
      title: "About Spider",
      body: (
        <>
          <p style="margin:0 0 6px 0;"><strong>Spider</strong> (1-suit)</p>
          <p style="margin:0 0 10px 0;">Version 1.0.0</p>
          <p style="margin:0;">Build eight K-to-A sequences to clear the board.</p>
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
          <p style="margin:0 0 8px 0;">Form descending runs in the tableau. A complete K-to-A run in the same suit is removed automatically.</p>
          <p style="margin:0 0 8px 0;">Move single cards or any descending same-suit run.</p>
          <p style="margin:0 0 8px 0;">Click the stock to deal one card to each column. All columns must be non-empty to deal.</p>
          <p style="margin:0;">Clear all eight sequences to win.</p>
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

    bindHotkeys({
      "F2": "new-game",
      "ctrl+z": "undo",
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
      onAfter: maybeWinCheck,
    });
    dragMgr.attach();
    onCleanup(() => dragMgr.destroy());
  });

  /* ---- View ---- */

  const fanUpPx = createMemo(() => cssVarPx("--tableau-fan-up"));
  const fanDownPx = createMemo(() => cssVarPx("--tableau-fan-down"));

  const [zoomKey, setZoomKey] = createSignal(0);
  onMount(() => {
    const obs = new MutationObserver(() => setZoomKey((k) => k + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-zoom"] });
    onCleanup(() => obs.disconnect());
  });
  const fanUp = () => { zoomKey(); return fanUpPx(); };
  const fanDown = () => { zoomKey(); return fanDownPx(); };

  function isSkipped(id: string): boolean {
    return skipIds().has(id);
  }

  const dealsLeft = createMemo(() => Math.floor(state.stock.length / 10));

  return (
    <>
      <WebMenuBar
        appName="Spider"
        menus={() => standardMenus({ appName: "Spider" })}
      />
      <div id="board" class="spider-board" ref={boardRef}>
        <div id="tableau-row">
          <For each={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}>
            {(t) => {
              const cells = createMemo(() => {
                const p = state.tableau[t];
                const out: { card: CardModel; idx: number; offset: number }[] = [];
                let offset = 0;
                for (let i = 0; i < p.length; i++) {
                  const c = p[i];
                  if (isSkipped(c.id)) break;
                  out.push({ card: c, idx: i, offset });
                  offset += c.faceUp ? fanUp() : fanDown();
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
                        movable={v.card.faceUp}
                      />
                    )}
                  </For>
                </div>
              );
            }}
          </For>
        </div>
        <div id="bottom-row">
          <div class="pile-slot" id="completed">
            <div class="completed-count">{state.completed}/8 completed</div>
          </div>
          <div class="spacer" />
          <div class="pile-slot" id="stock" data-pile="stock">
            <Show when={dealsLeft() > 0}>
              <For each={Array.from({ length: dealsLeft() }, (_, i) => i)}>
                {(i) => (
                  <Card
                    card={{ id: `stock-${i}`, rank: "A", suit: "S", faceUp: false }}
                    top={`${i * -2}px`}
                    left={`${i * 3}px`}
                    pile="stock"
                  />
                )}
              </For>
            </Show>
          </div>
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
