/* ---------- Shared difficulty type + helpers ----------
 *
 * Each game maps the abstract Easy / Medium / Hard label onto a
 * game-specific knob (number of free cells, AI strength, suits in
 * deck, etc.).
 */

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export function difficultyLabel(d: Difficulty): string {
  if (d === "easy") return "Easy";
  if (d === "medium") return "Medium";
  return "Hard";
}

/** Coerce a stored value back to a valid Difficulty. */
export function coerce(value: unknown, fallback: Difficulty = "easy"): Difficulty {
  if (value === "easy" || value === "medium" || value === "hard") return value;
  return fallback;
}
