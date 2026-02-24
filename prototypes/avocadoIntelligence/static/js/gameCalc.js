// Pure calculation functions — the "math layer" of the game.
//
// Discipline:
//   - Every function takes explicit arguments (no globals, no `state`, no DOM).
//   - No side effects — given the same inputs, always returns the same output.
//   - Import TUNING where needed for constants.
//
// This keeps game logic testable and separates "what happens" from "how it's displayed."

import { TUNING } from "./tuning.js";

/** Clamp a value between min and max (inclusive). */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Weighted random selection from an array of { weight, ...rest } objects. */
export function rollWeighted(outcomes) {
  const totalWeight = outcomes.reduce((sum, entry) => sum + (entry.weight || 0), 0);
  if (totalWeight <= 0) return outcomes[0];

  let roll = Math.random() * totalWeight;
  for (const entry of outcomes) {
    roll -= entry.weight || 0;
    if (roll <= 0) return entry;
  }
  return outcomes[outcomes.length - 1];
}

/** Format a rate value for display — trims unnecessary trailing zeros. */
export function formatRate(value) {
  if (Number.isInteger(value)) return String(value);
  // Show up to 1 decimal, strip trailing zero
  return parseFloat(value.toFixed(1)).toString();
}

/** Floor fractional values for display (e.g. 3.7 avocados → "3"). */
export function getDisplayCount(value) {
  return Math.floor(value);
}

/** Calculate the prestige multiplier for a given prestige count. */
export function calcPrestigeMultiplier(prestigeCount, tuning) {
  return 1 + prestigeCount * tuning.prestige.multiplierPerPrestige;
}

/** Check whether the player can prestige based on total avocados earned. */
export function canPrestige(totalAvocados, tuning) {
  return totalAvocados >= tuning.prestige.unlockThreshold;
}
