/* ---------- TriPeaks main wiring (SolidJS) ---------- */
import { render } from "solid-js/web";
import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";

import { Card } from "../shared/Card";
import { ModalRoot, show as modalShow, close as modalClose } from "../shared/Modal";
import { Overlay } from "../shared/Overlay";
import { StatusBar } from "../shared/Status";
import { useNow } from "../shared/timer";
import { formatTime, cssVarPx } from "../shared/utils";
import { registerMany, wire as wireMenu } from "../shared/menu";
import { bind as bindHotkeys } from "../shared/hotkeys";
import { applyInitial as applyInitialZoom, install as installZoom } from "../shared/zoom";
import * as Options from "../shared/options";
import * as Stats from "../shared/stats";
import { WebMenuBar, standardMenus } from "../shared/WebMenuBar";
import * as T from "./game";

const GAME_ID = "tripeaks";
interface AppOpts { zoom: number }
const OPTION_DEFAULTS: AppOpts = { zoom: 1 };

function App() {
  const opts = Options.load<AppOpts>(GAME_ID, OPTION_DEFAULTS);
  applyInitialZoom(opts.zoom);
  const [state, setState] = createStore<T.TriPeaksState>(T.newState());
  const now = useNow();

  function persistOptions() {
    Options.save<AppOpts>(GAME_ID, { zoom: opts.zoom });
  }

  /* ---- Actions ---- */

  function doRemoveTableau(i: number): boolean {
    let ok = false;
    setState(produce((s) => { ok = T.removeTableau(s, i); }));
    return ok;
  }

  function doDealStock(): boolean {
    let ok = false;
    setState(produce((s) => { ok = T.dealFromStock(s); }));
    return ok;
  }

  function undo(): boolean {
    let ok = false;
    setState(produce((s) => { ok = T.undo(s); }));
    return ok;
  }

  /* ---- End check ---- */

  function noMovesLeft(): boolean {
    if (state.stock.length > 0) return false;
    const wasteTop = state.waste[state.waste.length - 1];
    if (!wasteTop) return true;
    for (let i = 0; i < state.tableau.length; i++) {
      if (T.isAvailable(state, i) && T.canRemove(state.tableau[i], wasteTop)) return false;
    }
    return true;
  }

  function maybeEndCheck() {
    if (state.finishedAt) return;
    if (T.isWon(state)) {
      setState(produce((s) => {
        s.finishedAt = Date.now();
        s.score += 1000;
      }));
      const timeSec = Math.floor((state.finishedAt! - state.startedAt) / 1000);
      Stats.record(GAME_ID, { won: true, timeSec, score: state.score });
      modalShow({
        title: "You Win!",
        body: (
          <>
            <p style="margin:0 0 10px 0">You cleared all three peaks!</p>
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
    } else if (noMovesLeft()) {
      setState("finishedAt", Date.now());
      const timeSec = Math.floor((state.finishedAt! - state.startedAt) / 1000);
      const remaining = T.tableauRemaining(state);
      Stats.record(GAME_ID, { won: false, score: state.score });
      modalShow({
        title: "No more moves",
        body: (
          <>
            <p style="margin:0 0 10px 0">{remaining} cards remained.</p>
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
  }

  /* ---- Hint ---- */

  function showHint() {
    const h = T.hint(state);
    if (!h) return;
    const cardEl = document.querySelector(`.card[data-pile="tableau"][data-pile-index="${h.tableauIndex}"]`);
    if (cardEl) {
      cardEl.classList.add("hint-flash");
      setTimeout(() => cardEl.classList.remove("hint-flash"), 1300);
    }
  }

  /* ---- New game ---- */

  function newGame() {
    if (state.moves > 0 && !state.finishedAt) {
      Stats.record(GAME_ID, { won: false, score: state.score });
    }
    setState(T.newState());
  }

  /* ---- Click interaction ---- */

  function onPointerDown(e: PointerEvent) {
    if (state.finishedAt) return;
    if (e.button !== undefined && e.button !== 0) return;

    const target = e.target as Element;
    const stockSlot = target.closest?.("#stock");
    if (stockSlot) {
      if (doDealStock()) maybeEndCheck();
      return;
    }
    const cardEl = target.closest?.(".card") as HTMLElement | null;
    if (!cardEl) return;
    if (cardEl.dataset.pile !== "tableau") return;
    if (!cardEl.dataset.movable) return;
    const idx = parseInt(cardEl.dataset.pileIndex ?? "0", 10);
    if (doRemoveTableau(idx)) {
      maybeEndCheck();
    }
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
      body: <p style="margin:0;">TriPeaks has no configurable options at this time.</p>,
      buttons: [{ label: "OK", primary: true, onClick: modalClose }],
    });
  }

  function showAbout() {
    modalShow({
      title: "About TriPeaks",
      body: (
        <>
          <p style="margin:0 0 6px 0;"><strong>TriPeaks</strong></p>
          <p style="margin:0 0 10px 0;">Version 1.0.0</p>
          <p style="margin:0;">Clear three peaks by removing cards in chain.</p>
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
          <p style="margin:0 0 8px 0;">Remove tableau cards by clicking them. A card can be removed if it is one rank higher or lower than the top of the waste pile (A wraps to K).</p>
          <p style="margin:0 0 8px 0;">A tableau card is only available once no other cards rest on top of it.</p>
          <p style="margin:0 0 8px 0;">Click the stock to deal a new card to the waste when no playable card remains.</p>
          <p style="margin:0;">Chain consecutive moves without using the stock to score more points.</p>
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

    boardRef!.addEventListener("pointerdown", onPointerDown);
    onCleanup(() => boardRef!.removeEventListener("pointerdown", onPointerDown));
  });

  /* ---- View ---- */

  // Recompute layout when zoom changes.
  const [zoomKey, setZoomKey] = createSignal(0);
  onMount(() => {
    const obs = new MutationObserver(() => setZoomKey((k) => k + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-zoom"] });
    onCleanup(() => obs.disconnect());
  });

  const cardW = createMemo(() => { zoomKey(); return cssVarPx("--card-w"); });
  const rowY = createMemo(() => { zoomKey(); return cssVarPx("--peaks-row-y"); });

  interface PeakCard {
    key: string;
    card: { id: string; rank: T.TriPeaksCard["rank"]; suit: T.TriPeaksCard["suit"]; faceUp: boolean };
    idx: number;
    avail: boolean;
    removable: boolean;
    left: number;
    top: number;
  }

  const peakCards = createMemo<PeakCard[]>(() => {
    const halfW = cardW() / 2;
    const ry = rowY();
    const wasteCard = state.waste[state.waste.length - 1];
    const out: PeakCard[] = [];
    for (let i = 0; i < state.tableau.length; i++) {
      const card = state.tableau[i];
      if (card.removed) continue;
      const lay = T.LAYOUT[i];
      const avail = T.isAvailable(state, i);
      const faceUp = avail || lay.row === 3;
      const showCard = { id: card.id, rank: card.rank, suit: card.suit, faceUp };
      const removable = avail && !!wasteCard && T.canRemove(showCard, wasteCard);
      out.push({
        key: card.id,
        card: showCard,
        idx: i,
        avail,
        removable,
        left: lay.x * halfW,
        top: lay.row * ry,
      });
    }
    return out;
  });

  const wasteTop = createMemo(() => state.waste[state.waste.length - 1] ?? null);
  const stockTop = createMemo(() => {
    if (state.stock.length === 0) return null;
    const c = state.stock[state.stock.length - 1];
    return { ...c, faceUp: false };
  });

  return (
    <>
      <WebMenuBar
        appName="TriPeaks"
        menus={() => standardMenus({ appName: "TriPeaks" })}
      />
      <div id="board" class="tripeaks-board" ref={boardRef}>
        <div id="peaks-area">
          <For each={peakCards()}>
            {(v) => (
              <Card
                card={v.card}
                top={`${v.top}px`}
                left={`${v.left}px`}
                pile="tableau"
                pileIndex={v.idx}
                movable={v.avail}
              />
            )}
          </For>
        </div>
        <div id="bottom-row">
          <div class="pile-slot" id="stock" data-pile="stock">
            <Show when={stockTop()}>
              {(c) => (
                <Card
                  card={c()}
                  top="0px" left="0px"
                  pile="stock"
                />
              )}
            </Show>
          </div>
          <div class="pile-slot" id="waste" data-pile="waste">
            <Show when={wasteTop()}>
              {(c) => (
                <Card
                  card={c()}
                  top="0px" left="0px"
                  pile="waste"
                />
              )}
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

      <Overlay />
      <ModalRoot />
    </>
  );
}

render(() => <App />, document.getElementById("app")!);
