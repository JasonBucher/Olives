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

/** Format numbers with commas. Shows one decimal when non-zero, drops trailing .0. */
export function formatNumber(value) {
  const rounded = Math.round(value * 10) / 10;
  if (rounded % 1 === 0) return Math.floor(rounded).toLocaleString();
  return rounded.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Calculate the cost of the next producer unit. */
export function calcProducerCost(id, ownedCount, tuning) {
  const p = tuning.producers[id];
  return Math.floor(p.baseCost * Math.pow(p.costGrowth, ownedCount));
}

/** Calculate a single producer's per-unit output rate, applying per-producer upgrade multipliers. */
export function calcProducerUnitRate(id, upgrades, tuning) {
  let rate = tuning.producers[id].baseRate;
  for (const [upgradeId, upgrade] of Object.entries(tuning.upgrades)) {
    if (upgrade.producerId === id && upgrade.prodMult && upgrades[upgradeId]) {
      rate *= upgrade.prodMult;
    }
  }
  return rate;
}

/** Calculate the guac global multiplier. */
export function calcGuacMultiplier(guacCount, tuning) {
  return 1 + Math.sqrt(guacCount) * tuning.guac.multiplierPerSqrt;
}

/** Calculate total avocados per second from all producers. */
export function calcTotalAps(producers, upgrades, wisdom, guacCount, tuning) {
  let total = 0;
  for (const [id, count] of Object.entries(producers)) {
    if (count <= 0) continue;
    total += calcProducerUnitRate(id, upgrades, tuning) * count;
  }
  // Apply global multipliers from upgrades
  let globalMult = 1;
  for (const [upgradeId, upgrade] of Object.entries(tuning.upgrades)) {
    if (upgrade.globalMult && upgrades[upgradeId]) {
      globalMult *= upgrade.globalMult;
    }
  }
  total *= globalMult;
  // Apply wisdom bonus
  total *= calcWisdomBonus(wisdom, upgrades, tuning);
  // Apply guac multiplier
  total *= calcGuacMultiplier(guacCount, tuning);
  return total;
}

/** Calculate click power (avocados per click). */
export function calcClickPower(upgrades, wisdom, guacCount, tuning) {
  let power = tuning.production.baseClickYield;
  // Click multiplier upgrades
  for (const [upgradeId, upgrade] of Object.entries(tuning.upgrades)) {
    if (upgrade.clickMult && upgrades[upgradeId]) {
      power *= upgrade.clickMult;
    }
  }
  // Global multipliers
  let globalMult = 1;
  for (const [upgradeId, upgrade] of Object.entries(tuning.upgrades)) {
    if (upgrade.globalMult && upgrades[upgradeId]) {
      globalMult *= upgrade.globalMult;
    }
  }
  power *= globalMult;
  // Wisdom bonus
  power *= calcWisdomBonus(wisdom, upgrades, tuning);
  // Guac multiplier
  power *= calcGuacMultiplier(guacCount, tuning);
  return power;
}

/** Calculate wisdom points earned from total avocados this run. */
export function calcWisdomEarned(totalAvocadosThisRun, tuning) {
  if (totalAvocadosThisRun < tuning.prestige.unlockThreshold) return 0;
  return Math.floor(Math.sqrt(totalAvocadosThisRun) / tuning.prestige.divisor);
}

/** Calculate the wisdom bonus multiplier. */
export function calcWisdomBonus(wisdom, upgrades, tuning) {
  let mult = tuning.prestige.wisdomMultPerPoint;
  // wisdom_boost upgrade increases effectiveness
  if (upgrades.wisdom_boost) {
    mult += tuning.upgrades.wisdom_boost.wisdomMult;
  }
  return 1 + wisdom * mult;
}

/** Check whether the player can prestige based on total avocados earned this run. */
export function canPrestige(totalAvocadosThisRun, tuning) {
  return totalAvocadosThisRun >= tuning.prestige.unlockThreshold;
}
