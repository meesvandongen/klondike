/* ---------- Hearts main wiring (SolidJS) ----------
 *
 * Drives the rules engine and AI loop. Only seat 0 (South) is human;
 * during the pass phase you click cards in your hand to toggle them
 * into the selection, then press "Pass". During play you click any
 * highlighted (legal) card to play it. AI seats act on a short timer
 * so the table feels turn-by-turn rather than instant.
 */
import { render } from "solid-js/web";
import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";

import type { Card as CardModel } from "../shared/types";
import { Card } from "../shared/Card";
import { ModalRoot, show as modalShow, close as modalClose } from "../shared/Modal";
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
import * as H from "./game";
import * as AI from "./ai";

const GAME_ID = "hearts";
const SEAT_SHORT = ["You", "West", "North", "East"];
const DIR_LABELS: Record<H.PassDir, string> = {
  L: "left", R: "right", A: "across", N: "no pass",
};

interface AppOpts { zoom: number; targetScore: number; difficulty: Difficulty }
const OPTION_DEFAULTS: AppOpts = { zoom: 1, targetScore: 100, difficulty: "medium" };

function App() {
  const opts = Options.load<AppOpts>(GAME_ID, OPTION_DEFAULTS);
  opts.difficulty = coerceDifficulty(opts.difficulty, "medium");
  applyInitialZoom(opts.zoom);
  const [state, setState] = createStore<H.HeartsState>(
    H.newState({ targetScore: opts.targetScore }),
  );
  const now = useNow();
  let aiTimer: number | null = null;

  function persistOptions() {
    Options.save<AppOpts>(GAME_ID, opts);
  }

  /* ---- Helpers ---- */

  function legalIds(seat: number): Set<string> {
    return new Set(H.legalPlays(state, seat).map((c) => c.id));
  }

  function clearAiTimer() {
    if (aiTimer !== null) { clearTimeout(aiTimer); aiTimer = null; }
  }

  /* ---- AI / trick loop ---- */

  function scheduleAi(delay = 650) {
    clearAiTimer();
    if (state.phase !== "play") return;
    if (state.finishedAt) return;
    if (H.isTrickPendingClear(state)) return; // wait for trick clear
    if (state.currentPlayer === 0) return;

    aiTimer = setTimeout(() => {
      aiTimer = null;
      const seat = state.currentPlayer;
      if (state.phase !== "play" || seat === 0) return;
      if (H.isTrickPendingClear(state)) return;
      const card = AI.pickPlay(state, seat, opts.difficulty);
      setState(produce((s) => { H.playCard(s, seat, card); }));
      afterPlay();
    }, delay) as unknown as number;
  }

  function clearTrickAndContinue() {
    clearAiTimer();
    aiTimer = setTimeout(() => {
      aiTimer = null;
      // If the hand just ended, the engine has already flipped phase.
      if (state.phase === "between") { showHandSummary(); return; }
      if (state.phase === "done") { showGameOver(); return; }
      setState(produce((s) => { H.clearCompletedTrick(s); }));
      if (state.currentPlayer === 0) return;
      scheduleAi(450);
    }, 1000) as unknown as number;
  }

  function afterPlay() {
    if (H.isTrickPendingClear(state) && state.phase === "play") {
      clearTrickAndContinue();
      return;
    }
    if (state.phase === "between") {
      // Last trick of the hand — keep it visible briefly too.
      clearAiTimer();
      aiTimer = setTimeout(() => {
        aiTimer = null;
        showHandSummary();
      }, 1000) as unknown as number;
      return;
    }
    if (state.phase === "done") {
      showGameOver();
      return;
    }
    if (state.currentPlayer !== 0) {
      scheduleAi();
    }
  }

  /* ---- Pass commit ---- */

  function commitPassFlow() {
    const south = state.pending[0];
    if (!south || south.length !== 3) return;
    setState(produce((s) => {
      // Fill AI selections.
      for (let seat = 1; seat < 4; seat++) {
        const picks = AI.pickPass(s.hands[seat], opts.difficulty);
        H.setPending(s, seat, picks);
      }
      H.commitPass(s);
    }));
    if (state.currentPlayer !== 0) scheduleAi();
  }

  /* ---- Hand summary + game-over modals ---- */

  function showHandSummary() {
    const wonHand = state.scoreThisHand[0] === 0;
    const shootSeat = state.scoreThisHand.findIndex((p) => p === 26);
    let headline = "Hand complete.";
    if (shootSeat >= 0) {
      headline = `${SEAT_SHORT[shootSeat]} shot the moon!`;
    } else if (wonHand) {
      headline = "Clean hand — no points taken.";
    }
    modalShow({
      title: "End of Hand",
      body: (
        <div id="scores-popup">
          <p style="margin:0 0 10px 0;">{headline}</p>
          <table>
            <thead>
              <tr><th>Player</th><th>Hand</th><th>Total</th></tr>
            </thead>
            <tbody>
              <For each={[0, 1, 2, 3]}>
                {(seat) => (
                  <tr>
                    <td>{SEAT_SHORT[seat]}</td>
                    <td>{state.scoreThisHand[seat]}</td>
                    <td>{state.totals[seat]}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      ),
      buttons: [
        {
          label: "Continue", primary: true,
          onClick: () => {
            modalClose();
            setState(produce((s) => H.nextHand(s)));
            if (state.phase === "play" && state.currentPlayer !== 0) scheduleAi();
          },
        },
      ],
    });
  }

  function showGameOver() {
    clearAiTimer();
    const w = H.winner(state);
    const youWon = w === 0;
    if (youWon) {
      const timeSec = Math.floor((state.finishedAt! - state.startedAt) / 1000);
      Stats.record(GAME_ID, { won: true, timeSec, score: 100 - state.totals[0] });
    } else {
      Stats.record(GAME_ID, { won: false });
    }
    modalShow({
      title: youWon ? "You Win!" : "Game Over",
      body: (
        <div id="scores-popup">
          <p style="margin:0 0 10px 0;">
            {youWon
              ? "You finished with the lowest score!"
              : `${SEAT_SHORT[w!]} took the round.`}
          </p>
          <table>
            <thead>
              <tr><th>Player</th><th>Total</th></tr>
            </thead>
            <tbody>
              <For each={[0, 1, 2, 3]}>
                {(seat) => (
                  <tr>
                    <td>{SEAT_SHORT[seat]}</td>
                    <td>{state.totals[seat]}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      ),
      buttons: [
        { label: "New Game", primary: true, onClick: () => { modalClose(); newGame(); } },
        { label: "Close", onClick: modalClose },
      ],
    });
  }

  /* ---- New game ---- */

  function newGame() {
    clearAiTimer();
    if (state.moves > 0 && !state.finishedAt) {
      Stats.record(GAME_ID, { won: false });
    }
    setState(H.newState({ targetScore: opts.targetScore }));
    if (state.phase === "play" && state.currentPlayer !== 0) scheduleAi();
  }

  function undoMove() {
    clearAiTimer();
    setState(produce((s) => H.undo(s)));
    if (state.phase === "play" && state.currentPlayer !== 0) scheduleAi();
  }

  /* ---- Click ---- */

  function onCardClick(card: CardModel) {
    if (state.finishedAt) return;
    if (state.phase === "pass") {
      setState(produce((s) => { H.togglePassSelection(s, card); }));
      return;
    }
    if (state.phase !== "play") return;
    if (state.currentPlayer !== 0) return;
    if (!H.isLegalPlay(state, 0, card)) return;
    setState(produce((s) => { H.playCard(s, 0, card, { pushUndo: true }); }));
    afterPlay();
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
    let target = opts.targetScore;
    let diffSel: Difficulty = opts.difficulty;
    modalShow({
      title: "Options",
      body: (
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; flex-direction:column; gap:6px;">
            <span>Difficulty (AI strength):</span>
            <label>
              <input type="radio" name="diff" value="easy"
                     checked={diffSel === "easy"}
                     onChange={() => { diffSel = "easy"; }} />
              Easy — opponents play passively
            </label>
            <label>
              <input type="radio" name="diff" value="medium"
                     checked={diffSel === "medium"}
                     onChange={() => { diffSel = "medium"; }} />
              Medium — balanced heuristic
            </label>
            <label>
              <input type="radio" name="diff" value="hard"
                     checked={diffSel === "hard"}
                     onChange={() => { diffSel = "hard"; }} />
              Hard — opponents pass and play aggressively
            </label>
          </div>
          <div style="padding-top:10px; border-top:1px solid #c5c5c5; display:flex; flex-direction:column; gap:6px;">
            <span>Game ends when any player reaches:</span>
            <label>
              <input type="radio" name="target" value="50"
                     checked={target === 50}
                     onChange={() => { target = 50; }} />
              50 points (short)
            </label>
            <label>
              <input type="radio" name="target" value="100"
                     checked={target === 100}
                     onChange={() => { target = 100; }} />
              100 points (standard)
            </label>
            <label>
              <input type="radio" name="target" value="200"
                     checked={target === 200}
                     onChange={() => { target = 200; }} />
              200 points (long)
            </label>
          </div>
        </div>
      ),
      buttons: [
        {
          label: "OK", primary: true,
          onClick: () => {
            modalClose();
            const needsRestart =
              target !== opts.targetScore || diffSel !== opts.difficulty;
            opts.targetScore = target;
            opts.difficulty = diffSel;
            if (needsRestart) {
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
      title: "About Hearts",
      body: (
        <>
          <p style="margin:0 0 6px 0;"><strong>Hearts</strong></p>
          <p style="margin:0 0 10px 0;">Version 1.0.0</p>
          <p style="margin:0;">Avoid hearts and the Queen of Spades. Lowest score after the target wins.</p>
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
          <p style="margin:0 0 8px 0;">Each hand you pass 3 cards (left, right, across, then hold — repeating).</p>
          <p style="margin:0 0 8px 0;">Holder of the 2♣ leads. You must follow suit if you can. No hearts may be led until one has been played off-suit ("hearts broken").</p>
          <p style="margin:0 0 8px 0;">Hearts are 1 point each; the Q♠ is 13. The lowest total at game end wins.</p>
          <p style="margin:0;">Take <em>all</em> 26 points in one hand to "shoot the moon": every opponent scores 26 instead.</p>
        </>
      ),
      buttons: [{ label: "OK", primary: true, onClick: modalClose }],
    });
  }

  /* ---- Boot ---- */

  onMount(() => {
    registerMany({
      "new-game": () => newGame(),
      "restart": () => newGame(),
      "undo": () => undoMove(),
      "hint": () => { /* hearts has no useful one-shot hint */ },
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
      "ctrl+=": "zoom-in",
      "ctrl+shift++": "zoom-in",
      "ctrl+-": "zoom-out",
      "ctrl+0": "zoom-reset",
    });

    if (state.phase === "play" && state.currentPlayer !== 0) scheduleAi();
  });

  onCleanup(() => clearAiTimer());

  /* ---- Derived view data ---- */

  const cardW = createMemo(() => cssVarPx("--card-w"));
  const cardH = createMemo(() => cssVarPx("--card-h"));
  const [zoomKey, setZoomKey] = createSignal(0);
  onMount(() => {
    const obs = new MutationObserver(() => setZoomKey((k) => k + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-zoom"] });
    onCleanup(() => obs.disconnect());
  });
  const w = () => { zoomKey(); return cardW(); };
  const h = () => { zoomKey(); return cardH(); };

  /* ---- Board size tracking ---- */

  let boardRef: HTMLDivElement | undefined;
  const [boardSize, setBoardSize] = createSignal({ w: 1100, h: 800 });
  onMount(() => {
    if (!boardRef) return;
    const measure = () => {
      const w = boardRef!.clientWidth;
      const h = boardRef!.clientHeight;
      // On Safari/WebKit a freshly-mounted element may report 0 if
      // layout hasn't flushed; ignore the bogus reading rather than
      // collapsing every fan onto a single point.
      if (w > 0 && h > 0) setBoardSize({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(boardRef);
    onCleanup(() => ro.disconnect());
  });

  /** Width available for the horizontal hands (north + south). The
   * seat rows span the full grid; only the padding is reserved. */
  const horizontalSlotWidth = createMemo(() => {
    zoomKey();
    return Math.max(w() * 3, boardSize().w - 40);
  });

  /** Available height for the side vertical fans. */
  const verticalSlotHeight = createMemo(() => {
    zoomKey();
    return Math.max(w() * 2, boardSize().h - 2 * (h() + 26) - 60);
  });

  const passDirText = createMemo(() => DIR_LABELS[state.passDir]);

  /** Fan layout helper: given a count, total slot extent and card
   * extent, returns the per-card step size (overlap) so cards fan
   * out centred and never spread further than `maxStep`. */
  function fanStep(n: number, slot: number, card: number, maxStep: number): number {
    if (n <= 1) return 0;
    const ideal = (slot - card) / (n - 1);
    return Math.max(8, Math.min(maxStep, ideal));
  }

  function HorizontalHand(props: {
    seat: number;
    hand: CardModel[];
    faceUp: boolean;
    slotWidth: number;
    selectable: boolean;
    selectedIds: Set<string>;
    legalIds: Set<string> | null;
    isSouth: boolean;
  }) {
    const layout = createMemo(() => {
      const n = props.hand.length;
      const cw = w();
      const step = fanStep(n, props.slotWidth, cw, cw * 0.55);
      const usedW = step * Math.max(0, n - 1) + cw;
      const startX = Math.max(0, (props.slotWidth - usedW) / 2);
      return { step, startX, usedW };
    });
    return (
      <div
        class={`fan-h ${props.isSouth ? "is-south" : "is-north"}`}
        style={`width:${props.slotWidth}px;`}
      >
        <For each={props.hand}>
          {(c, i) => {
            const left = createMemo(() => layout().startX + layout().step * i());
            const cardShown: CardModel = props.faceUp ? c : { ...c, faceUp: false };
            const isLegal = !props.legalIds || props.legalIds.has(c.id);
            const isSelected = props.selectedIds.has(c.id);
            const movable = props.selectable && (props.legalIds ? isLegal : true);
            const illegal = props.selectable && props.legalIds !== null && !isLegal;
            return (
              <div
                class="card-wrap"
                classList={{ illegal }}
                style={`position:absolute; top:0; left:${left()}px;`}
              >
                <Card
                  card={cardShown}
                  top="0px"
                  left="0px"
                  pile="hand"
                  pileIndex={props.seat}
                  cardIndex={i()}
                  movable={movable}
                  selected={isSelected}
                />
              </div>
            );
          }}
        </For>
      </div>
    );
  }

  function VerticalHand(props: { seat: number; count: number; slotHeight: number }) {
    const layout = createMemo(() => {
      const n = props.count;
      const cardThickness = w();      // card-w is the visual height of a landscape card
      const step = fanStep(n, props.slotHeight, cardThickness, cardThickness * 0.55);
      const usedH = step * Math.max(0, n - 1) + cardThickness;
      const startY = Math.max(0, (props.slotHeight - usedH) / 2);
      return { step, startY };
    });
    return (
      <div
        class="fan-v"
        style={`height:${props.slotHeight}px;`}
      >
        <For each={Array.from({ length: props.count }, (_, i) => i)}>
          {(i) => (
            <div
              class="card-back"
              style={`top:${layout().startY + layout().step * i}px;`}
            />
          )}
        </For>
      </div>
    );
  }


  const southLegal = createMemo(() => state.phase === "play" && state.currentPlayer === 0
    ? legalIds(0)
    : null);
  const selectedIds = createMemo(() =>
    new Set((state.pending[0] ?? []).map((c) => c.id)),
  );

  function onSouthClick(e: MouseEvent) {
    const target = (e.target as Element)?.closest?.(".card") as HTMLElement | null;
    if (!target) return;
    const cardId = target.dataset.cardId;
    if (!cardId) return;
    const card = state.hands[0].find((c) => c.id === cardId);
    if (!card) return;
    onCardClick(card);
  }

  const trickCards = createMemo(() => state.trick.plays.map((p) => p));

  const yourTotal = createMemo(() => state.totals[0]);

  return (
    <>
      <WebMenuBar
        appName="Hearts"
        menus={() => standardMenus({ appName: "Hearts", hasHint: false })}
      />
      <div id="board" class="hearts-board" ref={boardRef}>
        {/* North seat */}
        <div class="seat seat-north">
          <HorizontalHand
            seat={2}
            hand={state.hands[2]}
            faceUp={false}
            slotWidth={horizontalSlotWidth()}
            selectable={false}
            selectedIds={new Set()}
            legalIds={null}
            isSouth={false}
          />
          <div class="seat-label" classList={{ "tag-current": state.currentPlayer === 2 && state.phase === "play" }}>
            North · {state.totals[2]}
          </div>
        </div>

        {/* West seat */}
        <div class="seat seat-west">
          <VerticalHand seat={1} count={state.hands[1].length} slotHeight={verticalSlotHeight()} />
          <div class="seat-label" classList={{ "tag-current": state.currentPlayer === 1 && state.phase === "play" }}>
            West · {state.totals[1]}
          </div>
        </div>

        {/* Center trick area */}
        <div class="seat seat-mid">
          <Show when={state.phase === "pass"}>
            <div id="pass-banner">
              Pass {DIR_LABELS[state.passDir]} — pick 3 cards
              <Show when={state.passDir !== "N"}>
                {" "}({(state.pending[0] ?? []).length}/3)
              </Show>
            </div>
            <button
              id="pass-action"
              disabled={(state.pending[0] ?? []).length !== 3}
              onClick={commitPassFlow}
            >Pass</button>
          </Show>

          <div id="trick-area">
            <For each={[0, 1, 2, 3]}>
              {(seat) => {
                const cls = ["trick-south", "trick-west", "trick-north", "trick-east"][seat];
                const card = createMemo(() => trickCards()[seat]);
                return (
                  <div class={`trick-slot ${cls}`}>
                    <Show when={card()}>
                      {(c) => (
                        <Card
                          card={c()}
                          top="0px"
                          left="0px"
                          pile="trick"
                          pileIndex={seat}
                        />
                      )}
                    </Show>
                  </div>
                );
              }}
            </For>
            <Show when={state.phase === "play" && !H.isTrickPendingClear(state)}>
              <div class={`arrow dir-${["S","W","N","E"][state.currentPlayer]}`}>▲</div>
            </Show>
          </div>
        </div>

        {/* East seat */}
        <div class="seat seat-east">
          <VerticalHand seat={3} count={state.hands[3].length} slotHeight={verticalSlotHeight()} />
          <div class="seat-label" classList={{ "tag-current": state.currentPlayer === 3 && state.phase === "play" }}>
            East · {state.totals[3]}
          </div>
        </div>

        {/* South seat */}
        <div class="seat seat-south" onClick={onSouthClick}>
          <HorizontalHand
            seat={0}
            hand={state.hands[0]}
            faceUp={true}
            slotWidth={horizontalSlotWidth()}
            selectable={
              state.phase === "pass" ||
              (state.phase === "play" && state.currentPlayer === 0)
            }
            selectedIds={selectedIds()}
            legalIds={southLegal()}
            isSouth={true}
          />
          <div class="seat-label" classList={{ "tag-current": state.currentPlayer === 0 && state.phase === "play" }}>
            You · {state.totals[0]} · pass {passDirText()}
          </div>
        </div>
      </div>

      <StatusBar
        score={yourTotal()}
        moves={state.moves}
        startedAt={state.startedAt}
        finishedAt={state.finishedAt}
        now={now()}
      />

      <ModalRoot />
    </>
  );
}

render(() => <App />, document.getElementById("app")!);
