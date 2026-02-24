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

/** Calculate effective consume exponent after refinery reductions and upgrades. */
export function calcEffectiveConsumeExponent(refineryCount, upgrades, wisdomUnlocks, prestigeCount, tuning) {
  let exp = tuning.guac.consumeExponent;
  // Refinery reduction: -0.01 per refinery
  exp -= refineryCount * 0.01;
  // Research upgrade reductions (consumeExpDelta)
  for (const [upgradeId, upgrade] of Object.entries(tuning.upgrades)) {
    if (upgrade.consumeExpDelta && upgrades[upgradeId]) {
      exp += upgrade.consumeExpDelta; // negative values reduce
    }
  }
  // Wisdom unlock: Guac Memory II (-0.01 per prestige)
  if (wisdomUnlocks.guac_memory_2) {
    exp -= 0.01 * prestigeCount;
  }
  // Floor
  let floor = tuning.guac.consumeExponentFloor;
  if (wisdomUnlocks.infinite_guac) {
    floor = 0.35;
  }
  return Math.max(exp, floor);
}

/** Calculate effective produce exponent after upgrades and wisdom unlocks. */
export function calcEffectiveProduceExponent(upgrades, wisdomUnlocks, prestigeCount, tuning) {
  let exp = tuning.guac.produceExponent;
  // Research upgrade boosts (produceExpDelta)
  for (const [upgradeId, upgrade] of Object.entries(tuning.upgrades)) {
    if (upgrade.produceExpDelta && upgrades[upgradeId]) {
      exp += upgrade.produceExpDelta;
    }
  }
  // Wisdom unlock: Guac Memory I (+0.02 per prestige)
  if (wisdomUnlocks.guac_memory_1) {
    exp += 0.02 * prestigeCount;
  }
  return exp;
}

/** Calculate effective base guac production after upgrades. */
export function calcEffectiveBaseProduction(upgrades, tuning) {
  let base = tuning.guac.baseProduction;
  for (const [upgradeId, upgrade] of Object.entries(tuning.upgrades)) {
    if (upgrade.baseProdMult && upgrades[upgradeId]) {
      base *= upgrade.baseProdMult;
    }
  }
  return base;
}

/** Calculate total guac lab avocado consumption per second (sublinear). */
export function calcGuacConsumption(labCount, tuning, refineryCount, upgrades, wisdomUnlocks, prestigeCount) {
  if (labCount <= 0) return 0;
  // Support both old signature (labCount, tuning) and new signature with extra args
  let exp;
  if (refineryCount !== undefined) {
    exp = calcEffectiveConsumeExponent(refineryCount, upgrades || {}, wisdomUnlocks || {}, prestigeCount || 0, tuning);
  } else {
    exp = Math.max(tuning.guac.consumeExponent, tuning.guac.consumeExponentFloor);
  }
  return tuning.guac.baseConsumption * Math.pow(labCount, exp);
}

/** Calculate guac produced per second at full feed. */
export function calcGuacProduction(labCount, tuning, upgrades, wisdomUnlocks, prestigeCount) {
  if (labCount <= 0) return 0;
  let exp;
  let base;
  if (upgrades !== undefined) {
    exp = calcEffectiveProduceExponent(upgrades, wisdomUnlocks || {}, prestigeCount || 0, tuning);
    base = calcEffectiveBaseProduction(upgrades, tuning);
  } else {
    exp = tuning.guac.produceExponent;
    base = tuning.guac.baseProduction;
  }
  return base * Math.pow(labCount, exp);
}

/** Calculate the guac global multiplier. */
export function calcGuacMultiplier(guacCount, tuning) {
  return 1 + Math.sqrt(guacCount) * tuning.guac.multiplierPerSqrt;
}

/** Calculate base APS (producer rates only, no global/wisdom/guac multipliers). */
export function calcBaseAps(producers, upgrades, tuning) {
  let total = 0;
  for (const [id, count] of Object.entries(producers)) {
    if (count <= 0) continue;
    total += calcProducerUnitRate(id, upgrades, tuning) * count;
  }
  return total;
}

/** Calculate total avocados per second from all producers. */
export function calcTotalAps(producers, upgrades, wisdom, guacCount, tuning) {
  let total = calcBaseAps(producers, upgrades, tuning);
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

/** Calculate click power (avocados per click). baseAps is pre-multiplier APS. */
export function calcClickPower(upgrades, producers, wisdom, guacCount, baseAps, tuning) {
  let power = tuning.production.baseClickYield;

  // Flat click bonus from producers (e.g. influencers)
  for (const [id, count] of Object.entries(producers)) {
    const p = tuning.producers[id];
    if (p && p.clickBonus && count > 0) {
      power += p.clickBonus * count;
    }
  }

  // Click multiplier upgrades
  for (const [upgradeId, upgrade] of Object.entries(tuning.upgrades)) {
    if (upgrade.clickMult && upgrades[upgradeId]) {
      power *= upgrade.clickMult;
    }
  }

  // APS percentage bonus from Throughput Clicking chain (highest tier wins)
  let apsPct = 0;
  for (const [upgradeId, upgrade] of Object.entries(tuning.upgrades)) {
    if (upgrade.apsPctPerClick && upgrades[upgradeId]) {
      apsPct = Math.max(apsPct, upgrade.apsPctPerClick);
    }
  }
  if (apsPct > 0 && baseAps > 0) {
    power += baseAps * apsPct;
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
