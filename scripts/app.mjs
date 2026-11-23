#!/usr/bin/env node
// Runs the mygo CLI for one game of the suite:
//
//   node scripts/app.mjs dev [game]              # live-reloading desktop app
//   node scripts/app.mjs build [game] [flags...] # packaged app in build/
//
// The game (klondike by default) reaches mygo.config.ts as SOLITAIRE_GAME.
// This script exists so the package.json scripts work the same in
// cmd.exe, PowerShell and POSIX shells.
import { spawnSync } from "node:child_process";

const GAMES = ["klondike", "freecell", "spider", "tripeaks", "pyramid", "hearts"];

const [command, ...rest] = process.argv.slice(2);
if (!command) {
  console.error("usage: node scripts/app.mjs <dev|build|generate> [game] [mygo flags...]");
  process.exit(2);
}
let game = "klondike";
if (rest[0] && !rest[0].startsWith("-")) game = rest.shift().toLowerCase();
if (!GAMES.includes(game)) {
  console.error(`unknown game "${game}"; expected one of ${GAMES.join(", ")}`);
  process.exit(2);
}

const result = spawnSync("mygo", [command, ...rest], {
  stdio: "inherit",
  shell: process.platform === "win32", // resolves node_modules/.bin/mygo.cmd
  env: { ...process.env, SOLITAIRE_GAME: game },
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
