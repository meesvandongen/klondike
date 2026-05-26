/* ---------- Pyramid main wiring (SolidJS) ---------- */
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
import { coerce as coerceDifficulty, type Difficulty } from "../shared/difficulty";
import * as P from "./game";

const GAME_ID = "pyramid";
interface AppOpts { zoom: number; difficulty: Difficulty }
const OPTION_DEFAULTS: AppOpts = { zoom: 1, difficulty: "easy" };

function cyclesForDifficulty(d: Difficulty): number {
  if (d === "easy") return 3;
  if (d === "medium") return 1;
  return 0;
}

function refKey(r: P.PyramidRef): string {
  return `${r.pile}#${r.index}`;
}

function App() {
  const opts = Options.load<AppOpts>(GAME_ID, OPTION_DEFAULTS);
  opts.difficulty = coerceDifficulty(opts.difficulty, "easy");
  applyInitialZoom(opts.zoom);
  const [difficulty, setDifficulty] = createSignal<Difficulty>(opts.difficulty);
  const [state, setState] = createStore<P.PyramidState>(
    P.newState({ maxCycles: cyclesForDifficulty(difficulty()) }),
  );
  const [selected, setSelected] = createSignal<P.PyramidRef | null>(null);
  const now = useNow();

  function persistOptions() {
    Options.save<AppOpts>(GAME_ID, { zoom: opts.zoom, difficulty: difficulty() });
  }

  /* ---- Actions ---- */

  function doRemoveKing(ref: P.PyramidRef): boolean {
    let ok = false;
    setState(produce((s) => { ok = P.removeKing(s, ref); }));
    return ok;
  }

  function doRemovePair(a: P.PyramidRef, b: P.PyramidRef): boolean {
    let ok = false;
    setState(produce((s) => { ok = P.removePair(s, a, b); }));
    return ok;
  }

  function doDealStock(): boolean {
    let ok = false;
    setState(produce((s) => { ok = P.dealFromStock(s); }));
    return ok;
  }

  function undo(): boolean {
    let ok = false;
    setState(produce((s) => { ok = P.undo(s); }));
    if (ok) setSelected(null);
    return ok;
  }

  /* ---- End check ---- */

  function maybeEndCheck() {
    if (state.finishedAt) return;
    if (P.isWon(state)) {
      setState(produce((s) => {
        s.finishedAt = Date.now();
        s.score += 100;
      }));
      const timeSec = Math.floor((state.finishedAt! - state.startedAt) / 1000);
      Stats.record(GAME_ID, { won: true, timeSec, score: state.score });
      modalShow({
        title: "You Win!",
        body: (
          <>
            <p style="margin:0 0 10px 0">Pyramid cleared!</p>
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
    } else if (P.noMovesLeft(state)) {
      setState("finishedAt", Date.now());
      const timeSec = Math.floor((state.finishedAt! - state.startedAt) / 1000);
      const remaining = P.pyramidRemaining(state);
      Stats.record(GAME_ID, { won: false, score: state.score });
      modalShow({
        title: "No more moves",
        body: (
          <>
            <p style="margin:0 0 10px 0">{remaining} pyramid cards remained.</p>
            <table>
              <tbody>
                <tr><td>Score</td><td>{state.score}</td></tr>
                <tr><td>Time</td><td>{formatTime(timeSec)}</td></tr>
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
    const h = P.hint(state);
    if (!h) return;
    for (const r of h.refs) {
      const sel = r.pile === "waste"
        ? `.card[data-pile="waste"]`
        : `.card[data-pile="pyramid"][data-pile-index="${r.index}"]`;
      const el = document.querySelector(sel);
      if (el) {
        el.classList.add("hint-flash");
        setTimeout(() => el.classList.remove("hint-flash"), 1300);
      }
    }
  }

  /* ---- New game ---- */

  function newGame() {
    if (state.moves > 0 && !state.finishedAt) {
      Stats.record(GAME_ID, { won: false, score: state.score });
    }
    setState(P.newState({ maxCycles: cyclesForDifficulty(difficulty()) }));
    setSelected(null);
  }

  /* ---- Click interaction ---- */

  function onPointerDown(e: PointerEvent) {
    if (state.finishedAt) return;
    if (e.button !== undefined && e.button !== 0) return;

    const target = e.target as Element;
    const stockSlot = target.closest?.("#stock");
    if (stockSlot) {
      setSelected(null);
      doDealStock();
      maybeEndCheck();
      return;
    }

    const cardEl = target.closest?.(".card") as HTMLElement | null;
    if (!cardEl) return;
    if (!cardEl.dataset.movable) return;

    const pile = cardEl.dataset.pile;
    if (pile !== "pyramid" && pile !== "waste") return;

    const ref: P.PyramidRef = {
      pile,
      index: parseInt(cardEl.dataset.pileIndex ?? "0", 10),
    };
    const card = P.refCard(state, ref);
    if (!card) return;

    // Click an available K alone removes it.
    if (card.rank === "K") {
      if (doRemoveKing(ref)) {
        setSelected(null);
        maybeEndCheck();
      }
      return;
    }

    const sel = selected();
    if (!sel) {
      setSelected(ref);
      return;
    }
    if (refKey(sel) === refKey(ref)) {
      setSelected(null);
      return;
    }
    // Try pair.
    const moved = doRemovePair(sel, ref);
    setSelected(null);
    if (moved) {
      maybeEndCheck();
    } else {
      setSelected(ref);
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
              Easy — 3 stock recycles
            </label>
            <label>
              <input type="radio" name="diff" value="medium"
                     checked={diffSel === "medium"}
                     onChange={() => { diffSel = "medium"; }} />
              Medium — 1 stock recycle
            </label>
            <label>
              <input type="radio" name="diff" value="hard"
                     checked={diffSel === "hard"}
                     onChange={() => { diffSel = "hard"; }} />
              Hard — single pass through stock
            </label>
          </div>
        </div>
      ),
      buttons: [
        {
          label: "OK", primary: true,
          onClick: () => {
            modalClose();
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
      title: "About Pyramid",
      body: (
        <>
          <p style="margin:0 0 6px 0;"><strong>Pyramid</strong></p>
          <p style="margin:0 0 10px 0;">Version 1.0.0</p>
          <p style="margin:0;">Clear the pyramid by pairing cards that sum to 13.</p>
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
          <p style="margin:0 0 8px 0;">Pair two available cards whose ranks sum to 13 to remove them.</p>
          <p style="margin:0 0 8px 0;">A = 1, J = 11, Q = 12, K = 13 (Kings remove alone).</p>
          <p style="margin:0 0 8px 0;">A pyramid card is available once both cards covering it from below have been removed.</p>
          <p style="margin:0;">The stock deals one card to the waste; the waste top can also be paired. {state.maxCycles} stock {state.maxCycles === 1 ? "recycle is" : "recycles are"} allowed.</p>
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
  const colGap = createMemo(() => { zoomKey(); return cssVarPx("--pyramid-col-gap"); });
  const rowY = createMemo(() => { zoomKey(); return cssVarPx("--pyramid-row-y"); });

  interface PyramidCardView {
    key: string;
    card: { id: string; rank: P.PyramidCard["rank"]; suit: P.PyramidCard["suit"]; faceUp: boolean };
    idx: number;
    avail: boolean;
    selected: boolean;
    left: number;
    top: number;
  }

  const pyramidCards = createMemo<PyramidCardView[]>(() => {
    const cw = cardW();
    const gap = colGap();
    const ry = rowY();
    const sel = selected();
    const out: PyramidCardView[] = [];
    for (let i = 0; i < state.pyramid.length; i++) {
      const card = state.pyramid[i];
      if (card.removed) continue;
      const { row, col } = P.rowColOf(i);
      const avail = P.isAvailable(state, i);
      const rowOffset = ((6 - row) * (cw + gap)) / 2;
      const left = rowOffset + col * (cw + gap);
      const isSelected = !!sel && sel.pile === "pyramid" && sel.index === i;
      out.push({
        key: card.id,
        card: { id: card.id, rank: card.rank, suit: card.suit, faceUp: true },
        idx: i,
        avail,
        selected: isSelected,
        left,
        top: row * ry,
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
  const wasteSelected = createMemo(() => {
    const sel = selected();
    return !!sel && sel.pile === "waste";
  });

  return (
    <>
      <WebMenuBar
        appName="Pyramid"
        menus={() => standardMenus({ appName: "Pyramid" })}
      />
      <div id="board" class="pyramid-board" ref={boardRef}>
        <div id="pyramid-area">
          <For each={pyramidCards()}>
            {(v) => (
              <Card
                card={v.card}
                top={`${v.top}px`}
                left={`${v.left}px`}
                pile="pyramid"
                pileIndex={v.idx}
                movable={v.avail}
                selected={v.selected}
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
                  pileIndex={0}
                  movable
                  selected={wasteSelected()}
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
