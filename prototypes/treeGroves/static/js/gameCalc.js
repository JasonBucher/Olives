// Pure game-logic calculation functions.
// Every function takes explicit arguments — no DOM, no side effects, no closures over module state.

// --- Format helpers ---

export function formatOlivesPerSecond(value) {
  const rounded = value < 1 ? value.toFixed(3) : value.toFixed(2);
  return rounded.replace(/\.?0+$/, "");
}

export function formatOilPerPress(value) {
  return value < 1 ? value.toFixed(3) : value.toFixed(2);
}

// --- Inventory helpers ---

export function getDisplayCount(actualValue) {
  return Math.floor(actualValue);
}

export function getShippableCount(actualValue) {
  return Math.floor(actualValue);
}

// --- Cultivator ---

export function getCultivatorHireCost(count, tuning) {
  const baseCost = tuning.workers.cultivator.baseCost;
  const threshold = tuning.workers.cultivator.costScaleThreshold;

  if (count < threshold) {
    return baseCost + (count * tuning.workers.cultivator.costScaleLow);
  } else {
    const costAtThreshold = baseCost + (threshold * tuning.workers.cultivator.costScaleLow);
    const beyondThreshold = count - threshold;
    return costAtThreshold + (beyondThreshold * tuning.workers.cultivator.costScaleHigh);
  }
}

export function getCultivatorBonusPerSecond(count, tuning, foremanIsActive) {
  let bonus = count * tuning.workers.cultivator.olivesPerSecondPerCultivator;
  if (foremanIsActive) {
    bonus *= tuning.managers.foreman.growthMultiplier;
  }
  return bonus;
}

// --- Grove ---

export function getGroveExpansionBonus(upgrades, tuning) {
  let bonus = 0;
  const expansions = tuning.investments.groveExpansion;
  for (let i = 0; i < expansions.length; i++) {
    const upgradeId = `expand_grove_${expansions[i].idSuffix}`;
    if (upgrades[upgradeId]) {
      bonus += expansions[i].capacityBonus;
    }
  }
  return bonus;
}

// --- Harvester ---

export function getHarvesterHireCost(count, tuning) {
  return tuning.workers.harvester.baseCost + (count * tuning.workers.harvester.costScale);
}

export function getHarvesterOlivesBonus(count, tuning) {
  return count * tuning.workers.harvester.olivesPerHarvest;
}

export function calculateHarvesterHirePreview(count, tuning) {
  const nextCount = count + 1;
  const currentOlives = count * tuning.workers.harvester.olivesPerHarvest;
  const nextOlives = nextCount * tuning.workers.harvester.olivesPerHarvest;
  return {
    olives: { current: currentOlives, next: nextOlives },
  };
}

// --- Presser ---

export function getPresserHireCost(count, tuning) {
  return tuning.workers.presser.baseCost + (count * tuning.workers.presser.costScale);
}

export function getBaseOilPerOlive(tuning) {
  return tuning.press.baseOilPerPress / tuning.press.olivesPerPress;
}

export function getTotalOilPerOlive(presserCount, tuning, pressManagerIsActive) {
  let bonusPerOlive = presserCount * tuning.workers.presser.oilPerOlivePerPresser;
  if (pressManagerIsActive) {
    bonusPerOlive *= tuning.managers.pressManager.presserMultiplier;
  }
  return getBaseOilPerOlive(tuning) + bonusPerOlive;
}

// --- Shipping ---

export function getOliveShippingCapacity(crateLevel, tuning) {
  const bonus = (crateLevel || 0) * tuning.investments.shippingCrates.oliveBonusPerLevel;
  return tuning.market.shipping.olives.baseBatchSize + bonus;
}

export function getOliveOilShippingCapacity(crateLevel, tuning) {
  const bonus = (crateLevel || 0) * tuning.investments.shippingCrates.oilBonusPerLevel;
  return tuning.market.shipping.oliveOil.baseBatchSize + bonus;
}

// --- Quarry ---

export function getQuarryDurationSeconds(cartLevel, tuning) {
  const level = cartLevel || 0;
  const reduction = level * tuning.investments.pulleyCart.reductionPerLevel;
  return tuning.quarry.durationSeconds * (1 - reduction);
}

export function getQuarryOutput(pickLevel, tuning) {
  const bonus = (pickLevel || 0) * tuning.investments.sharpenedPicks.bonusPerLevel;
  return tuning.quarry.outputPerRun + bonus;
}

// --- Olive Press Scaling ---

export function getOlivesToPress(harvestedOlives, olivePressCount, tuning) {
  const olivesPerPress = tuning.press.olivesPerPress;
  const pressCount = olivePressCount || 1;
  const pressableOlives = getShippableCount(harvestedOlives);
  const availableMultiples = Math.floor(pressableOlives / olivesPerPress);
  const multiplesToRun = Math.min(availableMultiples, pressCount);
  return multiplesToRun * olivesPerPress;
}

// --- Harvest ---

export function getCurrentHarvestBatchSize(harvesterCount, harvestBasketLevel, baseBatchSize, tuning) {
  const basketBonus = (harvestBasketLevel || 0) * tuning.investments.harvestBaskets.bonusPerLevel;
  return Math.max(0, baseBatchSize + basketBonus + getHarvesterOlivesBonus(harvesterCount, tuning));
}

export function getHarvestStabilityLabel(poorPct) {
  if (poorPct === 0) return "Certain";
  if (poorPct <= 5) return "Engineered";
  if (poorPct < 15) return "Reliable";
  return "Unstable";
}

// --- Compound calc functions ---

export function calcGroveStats(state, tuning, foremanIsActive) {
  const expansionBonus = getGroveExpansionBonus(state.upgrades, tuning);
  const treeCapacity = tuning.grove.treeCapacity + expansionBonus;
  const cultivatorBonus = getCultivatorBonusPerSecond(state.cultivatorCount, tuning, foremanIsActive);
  const growthRate = tuning.grove.treeGrowthPerSec + cultivatorBonus;
  return {
    treeOlives: Math.floor(state.treeOlives),
    treeCapacity,
    growthRate,
  };
}

export function calcCultivatorStats(state, tuning, foremanIsActive) {
  const count = state.cultivatorCount;
  const hireCost = getCultivatorHireCost(count, tuning);
  const perCultivator = tuning.workers.cultivator.olivesPerSecondPerCultivator;
  const multiplier = foremanIsActive ? tuning.managers.foreman.growthMultiplier : 1;
  const currentBonus = count * perCultivator * multiplier;
  const nextBonus = perCultivator * multiplier;
  return {
    count,
    hireCost,
    currentBonus,
    nextBonus,
    managerActive: foremanIsActive,
  };
}

export function calcHarvesterStats(state, tuning, arboristIsActive, harvestOutcomeChances, baseBatchSize) {
  const count = state.harvesterCount;
  const hireCost = getHarvesterHireCost(count, tuning);
  const batchSize = getCurrentHarvestBatchSize(count, state.harvestBasketLevel, baseBatchSize, tuning);

  const preview = calculateHarvesterHirePreview(count, tuning);
  const olivesDelta = preview.olives.next - preview.olives.current;

  const effCfg = tuning.harvest.efficientBonus;
  const currentEffBonus = Math.floor(effCfg.flat + count * effCfg.perHarvester);
  const nextEffBonus = Math.floor(effCfg.flat + (count + 1) * effCfg.perHarvester);
  const effDelta = nextEffBonus - currentEffBonus;

  const poorPct = Math.round((harvestOutcomeChances.find(o => o.key === "poor")?.weight || 0) * 100);
  const efficientPct = Math.round((harvestOutcomeChances.find(o => o.key === "efficient")?.weight || 0) * 100);
  const interruptedPct = Math.round((harvestOutcomeChances.find(o => o.key === "interrupted_short")?.weight || 0) * 100);
  const stabilityLabel = getHarvestStabilityLabel(poorPct);

  return {
    count,
    hireCost,
    batchSize,
    olives: { current: preview.olives.current, next: preview.olives.next, delta: olivesDelta },
    eff: { current: currentEffBonus, next: nextEffBonus, delta: effDelta },
    harvest: { poorPct, efficientPct, interruptedPct, stabilityLabel },
    managerActive: arboristIsActive,
  };
}

export function calcPresserStats(state, tuning, pressManagerIsActive) {
  const count = state.presserCount;
  const hireCost = getPresserHireCost(count, tuning);
  const oilBonusPerPresser = tuning.workers.presser.oilPerOlivePerPresser;
  const presserMult = pressManagerIsActive ? tuning.managers.pressManager.presserMultiplier : 1;
  const maxOlivesPerAction = (state.olivePressCount || 1) * tuning.press.olivesPerPress;
  const currentOilBonus = maxOlivesPerAction * count * oilBonusPerPresser * presserMult;
  const nextOilBonus = maxOlivesPerAction * oilBonusPerPresser * presserMult;
  return {
    count,
    hireCost,
    currentOilBonus,
    nextOilBonus,
    managerActive: pressManagerIsActive,
  };
}

export function calcPressAction(state, tuning, pressManagerIsActive) {
  const olivesToPress = getOlivesToPress(state.harvestedOlives, state.olivePressCount, tuning);
  const oilPerOlive = getTotalOilPerOlive(state.presserCount, tuning, pressManagerIsActive);
  const oilOutput = olivesToPress * oilPerOlive;
  return { olivesToPress, oilPerOlive, oilOutput };
}

export function calcShippingStats(state, tuning) {
  const shippableOlives = getShippableCount(state.harvestedOlives);
  const maxShipOlives = Math.min(shippableOlives, getOliveShippingCapacity(state.shippingCrateLevel, tuning));
  const shippableOil = getShippableCount(state.oliveOilCount || 0);
  const maxShipOil = Math.min(shippableOil, getOliveOilShippingCapacity(state.shippingCrateLevel, tuning));
  return {
    olives: { shippable: shippableOlives, maxShip: maxShipOlives },
    oil: { shippable: shippableOil, maxShip: maxShipOil },
  };
}

export function calcManagersSummary(state, tuning, activeFlags) {
  const mgrs = [
    { id: "arborist", hired: !!state.arboristHired, active: !!activeFlags.arborist, salary: tuning.managers.arborist.salaryPerMin },
    { id: "foreman", hired: !!state.foremanHired, active: !!activeFlags.foreman, salary: tuning.managers.foreman.salaryPerMin },
    { id: "quarryManager", hired: !!state.quarryManagerHired, active: !!activeFlags.quarryManager, salary: tuning.managers.quarryManager.salaryPerMin },
    { id: "pressManager", hired: !!state.pressManagerHired, active: !!activeFlags.pressManager, salary: tuning.managers.pressManager.salaryPerMin },
  ];
  const anyHired = mgrs.some(m => m.hired);
  let totalActiveCost = 0;
  for (const m of mgrs) {
    if (m.active) totalActiveCost += m.salary;
  }
  return { anyHired, managers: mgrs, totalActiveCost };
}

export function calcQuarryStats(state, tuning) {
  return {
    output: getQuarryOutput(state.quarryPickLevel, tuning),
    durationSeconds: getQuarryDurationSeconds(state.quarryCartLevel, tuning),
  };
}
