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

/** Format a rate value for display — abbreviates large values, trims trailing zeros for small. */
export function formatRate(value) {
  if (value >= 1e6) return formatNumber(value);
  if (Number.isInteger(value)) return String(value);
  // Show up to 1 decimal, strip trailing zero
  return parseFloat(value.toFixed(1)).toString();
}

/** Floor fractional values for display (e.g. 3.7 avocados → "3"). */
export function getDisplayCount(value) {
  return Math.floor(value);
}

/** Abbreviation suffixes for large numbers. */
const SUFFIXES = [
  { threshold: 1e21, divisor: 1e21, suffix: "Sx" },
  { threshold: 1e18, divisor: 1e18, suffix: "Qi" },
  { threshold: 1e15, divisor: 1e15, suffix: "Qa" },
  { threshold: 1e12, divisor: 1e12, suffix: "T" },
  { threshold: 1e9,  divisor: 1e9,  suffix: "B" },
  { threshold: 1e6,  divisor: 1e6,  suffix: "M" },
];

/** Format a number with abbreviation for >= 1M, commas for smaller values. */
export function formatNumber(value) {
  for (const { threshold, divisor, suffix } of SUFFIXES) {
    if (value >= threshold) {
      const scaled = value / divisor;
      if (scaled >= 100) return `${Math.floor(scaled)} ${suffix}`;
      if (scaled >= 10) return `${scaled.toFixed(1)} ${suffix}`;
      return `${scaled.toFixed(2)} ${suffix}`;
    }
  }
  const rounded = Math.round(value * 10) / 10;
  if (rounded % 1 === 0) return Math.floor(rounded).toLocaleString();
  return rounded.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Calculate the cost of the next producer unit. */
export function calcProducerCost(id, ownedCount, tuning) {
  const p = tuning.producers[id];
  return Math.floor(p.baseCost * Math.pow(p.costGrowth, ownedCount));
}

/** Calculate the total cost of buying `quantity` producers starting from `ownedCount`. */
export function calcBulkProducerCost(id, ownedCount, quantity, tuning, costMult = 1) {
  if (quantity <= 0) return 0;
  let total = 0;
  for (let i = 0; i < quantity; i++) {
    total += Math.floor(calcProducerCost(id, ownedCount + i, tuning) * costMult);
  }
  return total;
}

/** Calculate the maximum number of producers affordable within `budget`. */
export function calcMaxAffordable(id, ownedCount, budget, tuning, costMult = 1) {
  let count = 0;
  let remaining = budget;
  while (true) {
    const cost = Math.floor(calcProducerCost(id, ownedCount + count, tuning) * costMult);
    if (cost > remaining) break;
    remaining -= cost;
    count++;
  }
  return count;
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
    floor = 0.55;
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

/** Calculate total guac lab avocado consumption per second (sublinear + maintenance). */
export function calcGuacConsumption(labCount, tuning, refineryCount, upgrades, wisdomUnlocks, prestigeCount, guacCount) {
  if (labCount <= 0) return 0;
  // Support both old signature (labCount, tuning) and new signature with extra args
  let exp;
  if (refineryCount !== undefined) {
    exp = calcEffectiveConsumeExponent(refineryCount, upgrades || {}, wisdomUnlocks || {}, prestigeCount || 0, tuning);
  } else {
    exp = Math.max(tuning.guac.consumeExponent, tuning.guac.consumeExponentFloor);
  }
  let consumption = tuning.guac.baseConsumption * Math.pow(labCount, exp);
  // Maintenance: accumulated guac has an ongoing cost
  const maintenanceRate = tuning.guac.guacMaintenanceRate || 0;
  consumption += (guacCount || 0) * maintenanceRate;
  return consumption;
}

/** Calculate guac produced per second at full feed. */
export function calcGuacProduction(labCount, tuning, upgrades, wisdomUnlocks, prestigeCount, benchmarks) {
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
  let result = base * Math.pow(labCount, exp);
  if (benchmarks) {
    const bb = calcBenchmarkBonus(benchmarks, tuning);
    result *= bb.guacProdMult;
  }
  return result;
}

/** Calculate the guac global multiplier (asymptotic soft cap). */
export function calcGuacMultiplier(guacCount, tuning, benchmarks) {
  const coeff = tuning.guac.multiplierCoeff;
  const cap = tuning.guac.guacMultCap;
  const logTerm = Math.log2(1 + guacCount) * coeff;
  let mult = 1 + (cap - 1) * (logTerm / (1 + logTerm));
  if (benchmarks) {
    const bb = calcBenchmarkBonus(benchmarks, tuning);
    mult = 1 + (mult - 1) * bb.guacMult;
  }
  return mult;
}

/** Calculate synergy multiplier for a target producer from owned synergy upgrades.
 *  Multiple synergies targeting the same producer are additive with each other,
 *  then applied as one multiplier: 1 + sum(pct * sourceCount). */
export function calcSynergyMultiplier(targetId, producers, upgrades, tuning) {
  let bonus = 0;
  for (const [upgradeId, upgrade] of Object.entries(tuning.upgrades)) {
    if (upgrade.synergyTarget === targetId && upgrade.synergyPct && upgrades[upgradeId]) {
      const sourceCount = producers[upgrade.synergySource] || 0;
      bonus += upgrade.synergyPct * sourceCount;
    }
  }
  return 1 + bonus;
}

/** Calculate base APS (producer rates only, no global/wisdom/guac multipliers). */
export function calcBaseAps(producers, upgrades, tuning) {
  let total = 0;
  for (const [id, count] of Object.entries(producers)) {
    if (count <= 0) continue;
    const unitRate = calcProducerUnitRate(id, upgrades, tuning);
    const synergyMult = calcSynergyMultiplier(id, producers, upgrades, tuning);
    total += unitRate * count * synergyMult;
  }
  return total;
}

/** Calculate total avocados per second from all producers. */
export function calcTotalAps(producers, upgrades, wisdom, guacCount, tuning, benchmarks) {
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
  total *= calcWisdomBonus(wisdom, upgrades, tuning, benchmarks);
  // Apply guac multiplier
  total *= calcGuacMultiplier(guacCount, tuning, benchmarks);
  // Apply benchmark global bonus
  if (benchmarks) {
    const bb = calcBenchmarkBonus(benchmarks, tuning);
    total *= bb.globalMult;
  }
  return total;
}

/** Calculate click power (avocados per click). baseAps is pre-multiplier APS. */
export function calcClickPower(upgrades, producers, wisdom, guacCount, baseAps, tuning, benchmarks) {
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
  power *= calcWisdomBonus(wisdom, upgrades, tuning, benchmarks);
  // Guac multiplier
  power *= calcGuacMultiplier(guacCount, tuning, benchmarks);
  // Benchmark bonuses
  if (benchmarks) {
    const bb = calcBenchmarkBonus(benchmarks, tuning);
    power *= bb.globalMult;
    power *= bb.clickMult;
  }
  return power;
}

/** Calculate wisdom points earned from total avocados this run. */
export function calcWisdomEarned(totalAvocadosThisRun, tuning) {
  if (totalAvocadosThisRun < tuning.prestige.unlockThreshold) return 0;
  return Math.floor(Math.sqrt(totalAvocadosThisRun) / tuning.prestige.divisor);
}

/** Calculate the wisdom bonus multiplier. */
export function calcWisdomBonus(wisdom, upgrades, tuning, benchmarks) {
  let mult = tuning.prestige.wisdomMultPerPoint;
  // wisdom_boost upgrade increases effectiveness
  if (upgrades.wisdom_boost) {
    mult += tuning.upgrades.wisdom_boost.wisdomMult;
  }
  // Benchmark wisdom effectiveness bonus
  if (benchmarks) {
    const bb = calcBenchmarkBonus(benchmarks, tuning);
    mult *= bb.wisdomMult;
  }
  return 1 + wisdom * mult;
}

/** Check whether the player can prestige based on total avocados earned this run. */
export function canPrestige(totalAvocadosThisRun, tuning) {
  return totalAvocadosThisRun >= tuning.prestige.unlockThreshold;
}

/**
 * Calculate benchmark bonus multipliers from earned benchmarks.
 * Returns { globalMult, clickMult, guacProdMult, guacMult, wisdomMult }.
 */
export function calcBenchmarkBonus(benchmarks, tuning) {
  const result = { globalMult: 1, clickMult: 1, guacProdMult: 1, guacMult: 1, wisdomMult: 1 };
  if (!tuning.benchmarks) return result;
  for (const [id, cfg] of Object.entries(tuning.benchmarks)) {
    if (!benchmarks[id]) continue;
    if (cfg.globalMult)   result.globalMult   += cfg.globalMult;
    if (cfg.clickMult)    result.clickMult    += cfg.clickMult;
    if (cfg.guacProdMult) result.guacProdMult += cfg.guacProdMult;
    if (cfg.guacMult)     result.guacMult     += cfg.guacMult;
    if (cfg.wisdomMult)   result.wisdomMult   += cfg.wisdomMult;
  }
  return result;
}

/**
 * Calculate the distillation cost (wisdom required) for the next distillation.
 */
export function calcDistillationCost(distillationCount, tuning) {
  if (!tuning.distillation) return Infinity;
  const costs = tuning.distillation.costs;
  if (distillationCount >= costs.length) return Infinity;
  return costs[distillationCount];
}

/**
 * Check if the player can distill.
 */
export function canDistill(totalWisdomSinceLastDistill, distillationCount, tuning) {
  const cost = calcDistillationCost(distillationCount, tuning);
  return totalWisdomSinceLastDistill >= cost;
}

/**
 * Calculate cumulative distillation bonuses for a given model version.
 * Returns { apsMult, clickBaseBonus, guacProdMult, costMult, startingWisdom,
 *           multiplierCoeffBonus, consumeFloorBonus, allProdMult, wisdomEarnMult,
 *           unlocksFoundationModel }.
 */
export function calcDistillationBonus(modelVersion, tuning) {
  const result = {
    apsMult: 1, clickBaseBonus: 0, guacProdMult: 1, costMult: 1,
    startingWisdom: 0, multiplierCoeffBonus: 0, consumeFloorBonus: 0,
    allProdMult: 1, wisdomEarnMult: 1, unlocksFoundationModel: false,
  };
  if (!tuning.distillation || modelVersion <= 0) return result;
  const bonuses = tuning.distillation.bonuses;
  for (let i = 0; i < Math.min(modelVersion, bonuses.length); i++) {
    const b = bonuses[i];
    if (b.apsMult) result.apsMult *= b.apsMult;
    if (b.baseClickBonus) result.clickBaseBonus += b.baseClickBonus;
    if (b.guacProdMult) result.guacProdMult *= b.guacProdMult;
    if (b.costMult) result.costMult *= b.costMult;
    if (b.startingWisdom) result.startingWisdom += b.startingWisdom;
    if (b.multiplierCoeffBonus) result.multiplierCoeffBonus += b.multiplierCoeffBonus;
    if (b.consumeFloorBonus) result.consumeFloorBonus += b.consumeFloorBonus;
    if (b.allProdMult) result.allProdMult *= b.allProdMult;
    if (b.wisdomEarnMult) result.wisdomEarnMult *= b.wisdomEarnMult;
    if (b.unlocksFoundationModel) result.unlocksFoundationModel = true;
  }
  return result;
}
