import { defineConfig } from "mygo-cli";

// Each game ships as its own app, from the same Go program and the same
// frontend build. SOLITAIRE_GAME picks which (scripts/app.mjs sets it);
// main.go finds the game again from the app's name.
const games = {
  klondike: {
    name: "Klondike",
    comment: "Classic Klondike Solitaire styled after the Windows Vista edition.",
  },
  freecell: {
    name: "FreeCell",
    comment: "FreeCell solitaire — almost every deal is solvable.",
  },
  spider: {
    name: "Spider",
    comment: "Spider solitaire (1-suit) — build eight K-to-A sequences to win.",
  },
  tripeaks: {
    name: "TriPeaks",
    comment: "TriPeaks solitaire — chain cards adjacent in rank to clear three peaks.",
  },
  pyramid: {
    name: "Pyramid",
    comment: "Pyramid solitaire — pair cards summing to 13 to clear the pyramid.",
  },
  hearts: {
    name: "Hearts",
    comment: "Hearts — avoid hearts and the Queen of Spades. Lowest total wins.",
  },
} as const;

type GameKey = keyof typeof games;

const key = (process.env.SOLITAIRE_GAME ?? "klondike").toLowerCase();
if (!(key in games)) {
  throw new Error(
    `Unknown SOLITAIRE_GAME "${key}"; expected one of ${Object.keys(games).join(", ")}`,
  );
}
const game = games[key as GameKey];

export default defineConfig({
  name: game.name,
  identifier: `com.solitairesuite.${key}`,
  version: "1.0.0",
  icon: `icons/${key}/icon.png`,

  devUrl: "http://localhost:1420",
  devCommand: "pnpm run dev",
  buildCommand: "pnpm run build",
  frontendDist: "dist",
  bindings: "src/shared/mygo.ts",
  out: "build",

  macos: { minimumSystemVersion: "12.0" },
  linux: { comment: game.comment, categories: ["Game", "CardGame"] },
});
