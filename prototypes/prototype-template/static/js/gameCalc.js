// Pure calculation functions — the "math layer" of the game.
//
// Discipline:
//   - Every function takes explicit arguments (no globals, no `state`, no DOM).
//   - No side effects — given the same inputs, always returns the same output.
//   - Import TUNING where needed for constants.
//
// This keeps game logic testable and separates "what happens" from "how it's displayed."

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

/** Floor fractional values for display (e.g. 3.7 olives → "3"). */
export function getDisplayCount(value) {
  return Math.floor(value);
}

/** Click yield with one-shot and repeatable upgrade support. */
export function getClickYield(baseYield, sharperPickOwned, basketLevel, basketBonusPerLevel) {
  const sharperBonus = sharperPickOwned ? 1 : 0;
  return baseYield + sharperBonus + basketLevel * basketBonusPerLevel;
}

/** Repeatable upgrade cost. */
export function getScaledCost(baseCost, level, costScale) {
  return Math.floor(baseCost + level * costScale);
}

/** Convert olives to oil. Returns a payload the caller can apply to state. */
export function getPressResult(oliveCount, olivesPerPress, oilYieldPerPress) {
  if (oliveCount < olivesPerPress) {
    return { olivesSpent: 0, oilMade: 0, canPress: false };
  }
  return { olivesSpent: olivesPerPress, oilMade: oilYieldPerPress, canPress: true };
}

/** Oil sell value with optional multiplier. */
export function getSellValue(oilToSell, baseSellPrice, marketBonus) {
  return oilToSell * baseSellPrice * marketBonus;
}
