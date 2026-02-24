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

/** Format large numbers with K/M/B/T suffixes. Shows 1 decimal for small values. */
export function formatNumber(value) {
  if (value < 10) return parseFloat(value.toFixed(1)).toString();
  if (value < 1000) return String(Math.floor(value));
  const suffixes = [
    { threshold: 1e12, suffix: "T" },
    { threshold: 1e9,  suffix: "B" },
    { threshold: 1e6,  suffix: "M" },
    { threshold: 1e3,  suffix: "K" },
  ];
  for (const { threshold, suffix } of suffixes) {
    if (value >= threshold) {
      const scaled = value / threshold;
      // Show 1 decimal if < 10, otherwise integer
      if (scaled < 10) return parseFloat(scaled.toFixed(1)) + suffix;
      return Math.floor(scaled) + suffix;
    }
  }
  return String(Math.floor(value));
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

/** Calculate total avocados per second from all producers. */
export function calcTotalAps(producers, upgrades, wisdom, tuning) {
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
  return total;
}

/** Calculate click power (avocados per click). */
export function calcClickPower(upgrades, wisdom, tuning) {
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
  return power;
}

/** Calculate wisdom points earned from total avocados this run. */
export function calcWisdomEarned(totalAvocadosThisRun, tuning) {
  if (totalAvocadosThisRun < tuning.prestige.unlockThreshold) return 0;
  return Math.floor(Math.pow(totalAvocadosThisRun / tuning.prestige.wisdomDivisor, tuning.prestige.wisdomExponent));
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
