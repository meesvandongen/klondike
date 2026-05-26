/* ---------- Klondike main wiring (SolidJS) ---------- */
import { render } from "solid-js/web";
import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";

import type { Card as CardModel, MoveSource, MoveDest, Pickup } from "../shared/types";
import { Card } from "../shared/Card";
import { ModalRoot, show as modalShow, close as modalClose } from "../shared/Modal";
import { Overlay, show as overlayShow, hide as overlayHide } from "../shared/Overlay";
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
import * as K from "./game";
import { findSolvableState } from "./solver";

const GAME_ID = "klondike";
interface AppOpts { drawMode: number; autoComplete: boolean; zoom: number; difficulty: Difficulty }
const OPTION_DEFAULTS: AppOpts = { drawMode: 1, autoComplete: true, zoom: 1, difficulty: "easy" };

function App() {
  const opts = Options.load<AppOpts>(GAME_ID, OPTION_DEFAULTS);
  opts.difficulty = coerceDifficulty(opts.difficulty, "easy");
  applyInitialZoom(opts.zoom);
  const [drawMode, setDrawMode] = createSignal(opts.drawMode);
  const [autoComplete, setAutoComplete] = createSignal(opts.autoComplete);
  const [difficulty, setDifficulty] = createSignal<Difficulty>(opts.difficulty);
  const [state, setState] = createStore<K.KlondikeState>(K.newState({ draw: drawMode() }));
  const [dealing, setDealing] = createSignal(false);
  const now = useNow();
  let autoPlayActive = false;

  function persistOptions() {
    Options.save<AppOpts>(GAME_ID, {
      drawMode: drawMode(),
      autoComplete: autoComplete(),
      zoom: opts.zoom,
      difficulty: difficulty(),
    });
  }

  /* ---- Actions ---- */

  function dealStock(): boolean {
    let ok = false;
    setState(produce((s) => { ok = K.dealFromStock(s); }));
    return ok;
  }

  function tryMove(src: MoveSource, dst: MoveDest): boolean {
    let ok = false;
    setState(produce((s) => { ok = K.move(s, src, dst); }));
    return ok;
  }

  function tryAutoMove(src: MoveSource): boolean {
    let ok = false;
    setState(produce((s) => { ok = K.autoMove(s, src); }));
    return ok;
  }

  function undo(): boolean {
    let ok = false;
    setState(produce((s) => { ok = K.undo(s); }));
    return ok;
  }

  /* ---- Win + auto-complete ---- */

  function maybeWinCheck() {
    if (!K.isWon(state) || state.finishedAt) return;
    setState("finishedAt", Date.now());
    const timeSec = Math.floor((state.finishedAt! - state.startedAt) / 1000);
    Stats.record(GAME_ID, { won: true, timeSec, score: state.score });
    modalShow({
      title: "You Win!",
      body: (
        <>
          <p style="margin:0 0 10px 0">Congratulations — you cleared the board.</p>
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
      if (!autoComplete() || state.finishedAt || dealing()) {
        autoPlayActive = false;
        maybeWinCheck();
        return;
      }
      let moved = false;
      setState(produce((s) => { moved = K.safeAutoStep(s); }));
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
    const h = K.hint(state);
    if (!h) return;
    const pile =
      h.src.pile === "tableau"
        ? state.tableau[h.src.index]
        : h.src.pile === "waste"
        ? state.waste
        : state.foundations[h.src.index];
    const cardId = pile[h.src.cardIndex!].id;
    const el = document.querySelector(`.card[data-card-id="${CSS.escape(cardId)}"]`);
    if (el) {
      el.classList.add("hint-flash");
      setTimeout(() => el.classList.remove("hint-flash"), 1300);
    }
  }

  /* ---- New game ---- */

  async function newGame() {
    if (state.moves > 0 && !state.finishedAt) {
      Stats.record(GAME_ID, { won: false });
    }
    setDealing(true);
    const d = difficulty();
    if (d === "hard") {
      overlayShow("Dealing…");
      await new Promise((r) => setTimeout(r, 30));
      setState(K.newState({ draw: drawMode() }));
    } else {
      overlayShow(d === "easy" ? "Dealing a winnable game…" : "Dealing…");
      await new Promise((r) => setTimeout(r, 30));
      const result = d === "easy"
        ? findSolvableState({ draw: drawMode() })
        : findSolvableState({ draw: drawMode(), totalBudgetMs: 800, perAttemptMs: 300 });
      setState(result.state);
    }
    setDealing(false);
    overlayHide();
  }

  /* ---- Drag pickup ---- */

  function getPickup(e: PointerEvent, cardEl: HTMLElement | null): Pickup | null {
    if (state.finishedAt || dealing()) return null;

    const stockSlot = (e.target as Element).closest?.("#stock");
    if (stockSlot && !cardEl) {
      return { cards: [], click: () => { dealStock(); } };
    }
    if (!cardEl) return null;
    const pile = cardEl.dataset.pile;
    if (pile === "stock") {
      return { cards: [], click: () => { dealStock(); } };
    }
    if (!cardEl.dataset.movable) return null;

    const pileIndex = parseInt(cardEl.dataset.pileIndex ?? "0", 10);
    const cardIndex = parseInt(cardEl.dataset.cardIndex ?? "0", 10);

    let cards: CardModel[];
    if (pile === "tableau") cards = state.tableau[pileIndex].slice(cardIndex);
    else if (pile === "waste") cards = [state.waste[cardIndex]];
    else if (pile === "foundation") cards = [state.foundations[pileIndex][cardIndex]];
    else return null;

    if (!cards.length) return null;
    return { cards, src: { pile, index: pileIndex, cardIndex } };
  }

  function tryDrop(src: MoveSource, dropEl: HTMLElement): boolean {
    const pile = dropEl.dataset.pile;
    if (!pile || pile === "stock" || pile === "waste") return false;
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
    let drawSel = drawMode();
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
              Easy — guaranteed-winnable deal
            </label>
            <label>
              <input type="radio" name="diff" value="medium"
                     checked={diffSel === "medium"}
                     onChange={() => { diffSel = "medium"; }} />
              Medium — usually winnable
            </label>
            <label>
              <input type="radio" name="diff" value="hard"
                     checked={diffSel === "hard"}
                     onChange={() => { diffSel = "hard"; }} />
              Hard — random deal (may be unsolvable)
            </label>
          </div>
          <div style="padding-top:10px; border-top:1px solid #c5c5c5; display:flex; flex-direction:column; gap:6px;">
            <label>
              <input type="radio" name="draw" value="1"
                     checked={drawSel === 1}
                     onChange={() => { drawSel = 1; }} />
              Draw one card
            </label>
            <label>
              <input type="radio" name="draw" value="3"
                     checked={drawSel === 3}
                     onChange={() => { drawSel = 3; }} />
              Draw three cards
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
            const needsRedeal = diffSel !== difficulty() || drawSel !== drawMode();
            if (diffSel !== difficulty()) {
              setDifficulty(diffSel);
            }
            if (drawSel !== drawMode()) {
              setDrawMode(drawSel);
              menuInvoke("sync_draw_mode", { mode: drawSel });
            }
            if (needsRedeal) {
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
      title: "About Klondike",
      body: (
        <>
          <p style="margin:0 0 6px 0;"><strong>Klondike</strong></p>
          <p style="margin:0 0 10px 0;">Version 1.0.0</p>
          <p style="margin:0;">A classic single-player card game in the style of the Windows Vista edition.</p>
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
          <p style="margin:0 0 8px 0;">In the tableau, stack cards in alternating colours, descending in rank.</p>
          <p style="margin:0 0 8px 0;">Click the stock pile to deal new cards. Click a card to auto-send it to the foundations.</p>
          <p style="margin:0;">Use Hint, Undo and Auto-Complete from the Edit menu.</p>
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
      "draw-1": () => {
        if (drawMode() !== 1) {
          setDrawMode(1);
          persistOptions();
          newGame();
        }
      },
      "draw-3": () => {
        if (drawMode() !== 3) {
          setDrawMode(3);
          persistOptions();
          newGame();
        }
      },
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
    menuInvoke("sync_draw_mode", { mode: drawMode() });
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
      isLocked: () => dealing() || !!state.finishedAt,
      getPickup,
      tryDrop,
      tryAutoMove,
      onAfter: runAutoPlay,
    });
    dragMgr.attach();
    onCleanup(() => dragMgr.destroy());

    // initial deal
    newGame();
  });

  /* ---- View ---- */

  const fanUpPx = createMemo(() => cssVarPx("--tableau-fan-up"));
  const fanDownPx = createMemo(() => cssVarPx("--tableau-fan-down"));

  // Recompute fan offsets when zoom changes.
  // Subscribe to a 'zoom' attribute on <html> via Solid's reactivity.
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

  return (
    <>
      <WebMenuBar
        appName="Klondike"
        menus={() => standardMenus({
          appName: "Klondike",
          hasAutoComplete: true,
          autoComplete: autoComplete(),
          hasDrawModes: true,
          drawMode: drawMode(),
        })}
      />
      <div id="board" class="klondike-board" ref={boardRef}>
        <div id="top-row">
          {/* Stock */}
          <div class="pile-slot" id="stock" data-pile="stock">
            <Show when={state.stock.length > 0}>
              <Card
                card={{ ...state.stock[state.stock.length - 1], faceUp: false }}
                top="0px" left="0px"
                pile="stock"
              />
            </Show>
          </div>

          {/* Waste */}
          <div class="pile-slot" id="waste" data-pile="waste">
            {(() => {
              const visible = createMemo(() => {
                const out: { card: CardModel; originalIdx: number }[] = [];
                for (let i = 0; i < state.waste.length; i++) {
                  const c = state.waste[i];
                  if (isSkipped(c.id)) continue;
                  out.push({ card: c, originalIdx: i });
                }
                return out;
              });
              const showCount = createMemo(() => Math.min(state.draw, visible().length));
              const startV = createMemo(() => visible().length - showCount());
              return (
                <For each={visible().slice(startV())}>
                  {(v, i) => {
                    const isTop = () => i() === showCount() - 1;
                    return (
                      <Card
                        card={v.card}
                        top="0px"
                        left={`${i() * 18}px`}
                        pile="waste"
                        cardIndex={v.originalIdx}
                        movable={isTop()}
                      />
                    );
                  }}
                </For>
              );
            })()}
          </div>

          <div class="spacer" />

          {/* Foundations */}
          <For each={[0, 1, 2, 3]}>
            {(f) => (
              <div
                class="pile-slot foundation"
                id={`foundation-${f}`}
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
          <For each={[0, 1, 2, 3, 4, 5, 6]}>
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
