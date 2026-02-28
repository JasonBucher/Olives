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

// ── Wisdom Tree Functions ──────────────────────────────────────────

/** Check if a wisdom unlock's prerequisite is met (owned or pending in overlay). */
export function isWisdomUnlockAvailable(id, wisdomUnlocks, overlayPurchases, tuning) {
  const cfg = tuning.wisdomUnlocks[id];
  if (!cfg) return false;
  if (cfg.requires === null) return true; // root node
  return !!(wisdomUnlocks[cfg.requires] || (overlayPurchases && overlayPurchases[cfg.requires]));
}

/** Walk the requires chain to get depth (ROOT = 0). */
export function getWisdomNodeDepth(id, tuning) {
  let depth = 0;
  let current = id;
  while (current) {
    const cfg = tuning.wisdomUnlocks[current];
    if (!cfg || cfg.requires === null) break;
    current = cfg.requires;
    depth++;
  }
  return depth;
}

/** Get a "replaces" effect value — deepest owned node wins for a given effectKey. */
export function calcWisdomEffect(effectKey, wisdomUnlocks, tuning, defaultValue) {
  let best = null;
  let bestDepth = -1;
  for (const [id, cfg] of Object.entries(tuning.wisdomUnlocks)) {
    if (!wisdomUnlocks[id]) continue;
    if (!cfg.effect || cfg.effect[effectKey] === undefined) continue;
    const depth = getWisdomNodeDepth(id, tuning);
    if (depth > bestDepth) {
      bestDepth = depth;
      best = cfg.effect[effectKey];
    }
  }
  return best !== null ? best : defaultValue;
}

/** Aggregate an effect across all owned nodes — multiply or sum mode. */
export function calcWisdomEffectAggregate(effectKey, wisdomUnlocks, tuning, mode, identity) {
  let result = identity;
  for (const [id, cfg] of Object.entries(tuning.wisdomUnlocks)) {
    if (!wisdomUnlocks[id]) continue;
    if (!cfg.effect || cfg.effect[effectKey] === undefined) continue;
    if (mode === "multiply") {
      result *= cfg.effect[effectKey];
    } else {
      result += cfg.effect[effectKey];
    }
  }
  return result;
}

/** Producer cost multiplier from wisdom tree (replaces semantics: deepest wins). */
export function calcWisdomProducerCostMult(wisdomUnlocks, tuning) {
  return calcWisdomEffect("producerCostMult", wisdomUnlocks, tuning, 1);
}

/** Click multiplier from wisdom tree (replaces semantics: deepest wins). */
export function calcWisdomClickMult(wisdomUnlocks, tuning) {
  return calcWisdomEffect("clickMult", wisdomUnlocks, tuning, 1);
}

/** Global APS multiplier from Neural Architecture branch (multiplicative stacking). */
export function calcWisdomGlobalApsMult(wisdomUnlocks, tuning) {
  return calcWisdomEffectAggregate("globalApsMult", wisdomUnlocks, tuning, "multiply", 1);
}

/** Achievement bonus amplifier from wisdom tree. */
export function calcWisdomAchievementBonusMult(wisdomUnlocks, tuning) {
  return calcWisdomEffect("achievementBonusMult", wisdomUnlocks, tuning, 1);
}

/** Additive guac multiplier coefficient bonus from wisdom tree. */
export function calcWisdomGuacCoeffBonus(wisdomUnlocks, tuning) {
  return calcWisdomEffectAggregate("guacCoeffBonus", wisdomUnlocks, tuning, "sum", 0);
}

/** Distillation cost multiplier (replaces semantics: deepest wins). */
export function calcWisdomDistillCostMult(wisdomUnlocks, tuning) {
  return calcWisdomEffect("distillCostMult", wisdomUnlocks, tuning, 1);
}

/** Distillation bonus amplifier (multiplicative stacking). */
export function calcWisdomDistillBonusMult(wisdomUnlocks, tuning) {
  return calcWisdomEffectAggregate("distillBonusMult", wisdomUnlocks, tuning, "multiply", 1);
}

/** Research cost multiplier (replaces semantics: deepest wins). */
export function calcWisdomResearchCostMult(wisdomUnlocks, tuning) {
  return calcWisdomEffect("researchCostMult", wisdomUnlocks, tuning, 1);
}

/** Prestige threshold from wisdom tree (replaces semantics: deepest wins). */
export function calcPrestigeThreshold(wisdomUnlocks, tuning) {
  return calcWisdomEffect("prestigeThreshold", wisdomUnlocks, tuning, tuning.prestige.unlockThreshold);
}

/** Calculate starting resources from wisdom tree (max-per-producer across all owned nodes). */
export function calcStartingResources(wisdomUnlocks, tuning) {
  let avocados = 0;
  const producers = {};
  for (const [id, cfg] of Object.entries(tuning.wisdomUnlocks)) {
    if (!wisdomUnlocks[id]) continue;
    if (!cfg.effect) continue;
    if (cfg.effect.startingAvocados) {
      avocados = Math.max(avocados, cfg.effect.startingAvocados);
    }
    if (cfg.effect.startingProducers) {
      for (const [pid, count] of Object.entries(cfg.effect.startingProducers)) {
        producers[pid] = Math.max(producers[pid] || 0, count);
      }
    }
  }
  return { avocados, producers };
}

/** Return array of unlocked regimen IDs. */
export function calcAvailableRegimens(wisdomUnlocks, tuning) {
  if (!tuning.trainingRegimens) return [];
  const result = [];
  for (const [id, cfg] of Object.entries(tuning.trainingRegimens)) {
    if (cfg.requiresUnlock && wisdomUnlocks[cfg.requiresUnlock]) {
      result.push(id);
    }
  }
  return result;
}

/** Return max number of simultaneous regimens (1 or 2 with dual_curriculum). */
export function calcMaxRegimens(wisdomUnlocks) {
  return wisdomUnlocks.dual_curriculum ? 2 : 1;
}

/** Calculate combined regimen modifiers. */
export function calcRegimenModifiers(activeRegimens, tuning) {
  const result = { clickMult: 1, producerMult: 1, guacOutputMult: 1 };
  if (!tuning.trainingRegimens || !activeRegimens) return result;
  for (const id of activeRegimens) {
    const cfg = tuning.trainingRegimens[id];
    if (!cfg) continue;
    if (cfg.clickMult) result.clickMult *= cfg.clickMult;
    if (cfg.producerMult) result.producerMult *= cfg.producerMult;
    if (cfg.guacOutputMult) result.guacOutputMult *= cfg.guacOutputMult;
  }
  return result;
}

/** Return number of persistent upgrade slots (0-3, replaces semantics). */
export function calcPersistentSlots(wisdomUnlocks, tuning) {
  return calcWisdomEffect("persistentSlots", wisdomUnlocks, tuning, 0);
}

// ── Wrapped Gift Functions ──────────────────────────────────────────

/** Returns { apsMult, clickMult, guacMult, costMult } from active gift buffs that haven't expired. */
export function calcActiveGiftBuffs(activeGiftBuffs, now) {
  let apsMult = 1;
  let clickMult = 1;
  let guacMult = 1;
  let costMult = 1;
  if (!activeGiftBuffs) return { apsMult, clickMult, guacMult, costMult };
  for (const buff of activeGiftBuffs) {
    if (buff.expiresAt > now) {
      if (buff.field === "aps") apsMult *= buff.multiplier;
      if (buff.field === "click") clickMult *= buff.multiplier;
      if (buff.field === "guac") guacMult *= buff.multiplier;
      if (buff.field === "cost") costMult *= buff.multiplier;
    }
  }
  return { apsMult, clickMult, guacMult, costMult };
}

/** Returns eligible effect pool based on wisdom unlocks. */
export function getGiftEffectPool(giftEffects, wisdomUnlocks) {
  return Object.entries(giftEffects).filter(([id, cfg]) => {
    if (cfg.requiresWisdomUnlock && !(wisdomUnlocks && wisdomUnlocks[cfg.requiresWisdomUnlock])) return false;
    if (cfg.negative && wisdomUnlocks && wisdomUnlocks.quality_control) return false;
    return true;
  });
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

/** Calculate the milestone multiplier for a producer at a given owned count. */
export function calcMilestoneMultiplier(count, tuning) {
  let mult = 1;
  for (const ms of tuning.milestones) {
    if (count >= ms.count) mult *= ms.mult;
  }
  return mult;
}

/** Return the next milestone threshold above the current count, or null if all reached. */
export function getNextMilestone(count, tuning) {
  for (const ms of tuning.milestones) {
    if (count < ms.count) return ms;
  }
  return null;
}

/** Calculate a single producer's per-unit output rate, applying upgrade and milestone multipliers. */
export function calcProducerUnitRate(id, upgrades, tuning, count) {
  let rate = tuning.producers[id].baseRate;
  for (const [upgradeId, upgrade] of Object.entries(tuning.upgrades)) {
    if (upgrade.producerId === id && upgrade.prodMult && upgrades[upgradeId]) {
      rate *= upgrade.prodMult;
    }
  }
  if (count > 0) rate *= calcMilestoneMultiplier(count, tuning);
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
export function calcGuacProduction(labCount, tuning, upgrades, wisdomUnlocks, prestigeCount, achievements, activeRegimens) {
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
  if (achievements) {
    const bb = calcAchievementBonus(achievements, tuning);
    result *= bb.guacProdMult;
  }
  // Apply regimen guac output mult
  if (activeRegimens && activeRegimens.length > 0) {
    const regMods = calcRegimenModifiers(activeRegimens, tuning);
    result *= regMods.guacOutputMult;
  }
  return result;
}

/** Calculate the guac global multiplier (asymptotic soft cap). */
export function calcGuacMultiplier(guacCount, tuning, achievements, wisdomUnlocks) {
  const coeffBonus = wisdomUnlocks ? calcWisdomGuacCoeffBonus(wisdomUnlocks, tuning) : 0;
  const coeff = tuning.guac.multiplierCoeff + coeffBonus;
  const cap = tuning.guac.guacMultCap;
  const logTerm = Math.log2(1 + guacCount) * coeff;
  let mult = 1 + (cap - 1) * (logTerm / (1 + logTerm));
  if (achievements) {
    const bb = calcAchievementBonus(achievements, tuning);
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
    const unitRate = calcProducerUnitRate(id, upgrades, tuning, count);
    const synergyMult = calcSynergyMultiplier(id, producers, upgrades, tuning);
    total += unitRate * count * synergyMult;
  }
  return total;
}

/** Calculate total avocados per second from all producers.
 *  Optional activeGiftBuffs/now params apply wrapped gift buff multipliers. */
export function calcTotalAps(producers, upgrades, wisdom, guacCount, tuning, achievements, wisdomUnlocks, activeRegimens, activeGiftBuffs, now) {
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
  total *= calcWisdomBonus(wisdom, upgrades, tuning, achievements, wisdomUnlocks);
  // Apply guac multiplier
  total *= calcGuacMultiplier(guacCount, tuning, achievements, wisdomUnlocks);
  // Apply achievement global bonus
  if (achievements) {
    const bb = calcAchievementBonus(achievements, tuning);
    total *= bb.globalMult;
  }
  // Apply wisdom tree global APS mult (Neural Architecture branch)
  if (wisdomUnlocks) {
    total *= calcWisdomGlobalApsMult(wisdomUnlocks, tuning);
  }
  // Apply regimen producer mult
  if (activeRegimens && activeRegimens.length > 0) {
    const regMods = calcRegimenModifiers(activeRegimens, tuning);
    total *= regMods.producerMult;
  }
  // Apply wrapped gift APS buff
  if (activeGiftBuffs && activeGiftBuffs.length > 0) {
    const giftBuffs = calcActiveGiftBuffs(activeGiftBuffs, now || Date.now());
    total *= giftBuffs.apsMult;
  }
  return total;
}

/** Calculate click power (avocados per click). baseAps is pre-multiplier APS.
 *  Optional activeGiftBuffs/now params apply wrapped gift buff multipliers.
 *  Optional singularityCount applies NG+ click multiplier (2^singularityCount). */
export function calcClickPower(upgrades, producers, wisdom, guacCount, baseAps, tuning, achievements, wisdomUnlocks, activeRegimens, activeGiftBuffs, now, singularityCount) {
  let power = tuning.production.baseClickYield;

  // Base click bonus from wisdom tree (e.g. curriculum_learning)
  if (wisdomUnlocks) {
    const clickBonus = calcWisdomEffectAggregate("baseClickBonus", wisdomUnlocks, tuning, "sum", 0);
    power += clickBonus;
  }

  // Base click bonus from achievements
  if (achievements) {
    const bb = calcAchievementBonus(achievements, tuning);
    power += bb.baseClickBonus;
  }

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
  power *= calcWisdomBonus(wisdom, upgrades, tuning, achievements, wisdomUnlocks);
  // Guac multiplier
  power *= calcGuacMultiplier(guacCount, tuning, achievements, wisdomUnlocks);
  // Achievement bonuses
  if (achievements) {
    const bb = calcAchievementBonus(achievements, tuning);
    power *= bb.globalMult;
    power *= bb.clickMult;
  }
  // Wisdom tree click mult
  if (wisdomUnlocks) {
    power *= calcWisdomClickMult(wisdomUnlocks, tuning);
  }
  // Regimen click mult
  if (activeRegimens && activeRegimens.length > 0) {
    const regMods = calcRegimenModifiers(activeRegimens, tuning);
    power *= regMods.clickMult;
  }
  // Apply wrapped gift click buff
  if (activeGiftBuffs && activeGiftBuffs.length > 0) {
    const giftBuffs = calcActiveGiftBuffs(activeGiftBuffs, now || Date.now());
    power *= giftBuffs.clickMult;
  }
  // Apply NG+ singularity click multiplier
  if (singularityCount > 0) {
    power *= Math.pow(tuning.singularity.clickMultPerSingularity, singularityCount);
  }
  return power;
}

/** Calculate wisdom points earned from total avocados this run. */
export function calcWisdomEarned(totalAvocadosThisRun, tuning, wisdomUnlocks) {
  const threshold = wisdomUnlocks ? calcPrestigeThreshold(wisdomUnlocks, tuning) : tuning.prestige.unlockThreshold;
  if (totalAvocadosThisRun < threshold) return 0;

  const root = tuning.prestige.scalingRoot || 2;
  let base = Math.floor(
    Math.pow(totalAvocadosThisRun, 1 / root) / tuning.prestige.divisor
  );

  // Apply wisdom earn mult from tree (recursive_insight)
  if (wisdomUnlocks) {
    const earnMult = calcWisdomEffect("wisdomEarnMult", wisdomUnlocks, tuning, 1);
    if (earnMult !== 1) {
      base = Math.floor(base * earnMult);
    }
  }
  // Every prestige above threshold earns at least 1 wisdom
  return Math.max(base, 1);
}

/** Calculate the wisdom bonus multiplier. */
export function calcWisdomBonus(wisdom, upgrades, tuning, achievements, wisdomUnlocks) {
  let mult = tuning.prestige.wisdomMultPerPoint;
  // Wisdom mult bonus from tree (aggregate all nodes with wisdomMultBonus)
  if (wisdomUnlocks) {
    const treeBonus = calcWisdomEffectAggregate("wisdomMultBonus", wisdomUnlocks, tuning, "sum", 0);
    mult += treeBonus;
  } else if (upgrades.wisdom_boost) {
    mult += tuning.upgrades.wisdom_boost ? tuning.upgrades.wisdom_boost.wisdomMult : 0.05;
  }
  // Achievement wisdom effectiveness bonus
  if (achievements) {
    const bb = calcAchievementBonus(achievements, tuning);
    mult *= bb.wisdomMult;
  }
  return 1 + wisdom * mult;
}

/** Check whether the player can prestige based on total avocados earned this run. */
export function canPrestige(totalAvocadosThisRun, tuning, wisdomUnlocks) {
  const threshold = wisdomUnlocks ? calcPrestigeThreshold(wisdomUnlocks, tuning) : tuning.prestige.unlockThreshold;
  return totalAvocadosThisRun >= threshold;
}

/**
 * Calculate achievement bonus multipliers from earned achievements.
 * Returns { globalMult, clickMult, guacProdMult, guacMult, wisdomMult, baseClickBonus }.
 */
export function calcAchievementBonus(achievements, tuning, wisdomUnlocks) {
  const result = { globalMult: 1, clickMult: 1, guacProdMult: 1, guacMult: 1, wisdomMult: 1, baseClickBonus: 0 };
  if (!tuning.achievements) return result;
  const bbMult = wisdomUnlocks ? calcWisdomAchievementBonusMult(wisdomUnlocks, tuning) : 1;
  for (const [id, cfg] of Object.entries(tuning.achievements)) {
    if (!achievements[id]) continue;
    if (cfg.globalMult)     result.globalMult     += cfg.globalMult * bbMult;
    if (cfg.clickMult)      result.clickMult      += cfg.clickMult * bbMult;
    if (cfg.guacProdMult)   result.guacProdMult   += cfg.guacProdMult * bbMult;
    if (cfg.guacMult)       result.guacMult       += cfg.guacMult * bbMult;
    if (cfg.wisdomMult)     result.wisdomMult     += cfg.wisdomMult * bbMult;
    if (cfg.baseClickBonus) result.baseClickBonus += cfg.baseClickBonus * bbMult;
  }
  return result;
}

/** Calculate offline progress grant from saved APS and elapsed time. */
export function calcOfflineProgress(savedAps, elapsedMs, tuning) {
  const cfg = tuning.offlineProgress;
  const elapsedSeconds = elapsedMs / 1000;
  if (elapsedSeconds < cfg.minElapsedSeconds || savedAps <= 0) {
    return { grant: 0, elapsedSeconds, capped: false };
  }
  const effectiveSeconds = Math.min(elapsedSeconds, cfg.maxElapsedSeconds);
  const capped = elapsedSeconds > cfg.maxElapsedSeconds;
  const grant = savedAps * effectiveSeconds * cfg.fraction;
  return { grant, elapsedSeconds, capped };
}

/**
 * Calculate the distillation cost (wisdom required) for the next distillation.
 */
export function calcDistillationCost(distillationCount, tuning, wisdomUnlocks) {
  if (!tuning.distillation) return Infinity;
  const costs = tuning.distillation.costs;
  if (distillationCount >= costs.length) return Infinity;
  let cost = costs[distillationCount];
  if (wisdomUnlocks) {
    cost = Math.floor(cost * calcWisdomDistillCostMult(wisdomUnlocks, tuning));
  }
  return cost;
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
export function calcDistillationBonus(modelVersion, tuning, wisdomUnlocks) {
  const result = {
    apsMult: 1, clickBaseBonus: 0, guacProdMult: 1, costMult: 1,
    startingWisdom: 0, multiplierCoeffBonus: 0, consumeFloorBonus: 0,
    allProdMult: 1, wisdomEarnMult: 1, unlocksFoundationModel: false,
  };
  if (!tuning.distillation || modelVersion <= 0) return result;
  const bonuses = tuning.distillation.bonuses;
  const bonusMult = wisdomUnlocks ? calcWisdomDistillBonusMult(wisdomUnlocks, tuning) : 1;
  for (let i = 0; i < Math.min(modelVersion, bonuses.length); i++) {
    const b = bonuses[i];
    if (b.apsMult) result.apsMult *= 1 + (b.apsMult - 1) * bonusMult;
    if (b.baseClickBonus) result.clickBaseBonus += b.baseClickBonus * bonusMult;
    if (b.guacProdMult) result.guacProdMult *= 1 + (b.guacProdMult - 1) * bonusMult;
    if (b.costMult) result.costMult *= b.costMult; // cost reduction not amplified
    if (b.startingWisdom) result.startingWisdom += Math.floor(b.startingWisdom * bonusMult);
    if (b.multiplierCoeffBonus) result.multiplierCoeffBonus += b.multiplierCoeffBonus * bonusMult;
    if (b.consumeFloorBonus) result.consumeFloorBonus += b.consumeFloorBonus; // not amplified
    if (b.allProdMult) result.allProdMult *= 1 + (b.allProdMult - 1) * bonusMult;
    if (b.wisdomEarnMult) result.wisdomEarnMult *= 1 + (b.wisdomEarnMult - 1) * bonusMult;
    if (b.unlocksFoundationModel) result.unlocksFoundationModel = true;
  }
  return result;
}
