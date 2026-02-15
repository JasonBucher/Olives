// Prototype Template JS
// Storage convention (rename STORAGE_PREFIX when you copy this template into a new prototype)
import { computeHarvestOutcomeChances } from './harvestWeights.js';
import { TUNING } from './tuning.js';
import { INVESTMENTS } from './investments.js';
import { initLogger, logPlayer, logDebug, logEvent, clearLog } from './logger.js';

const STORAGE_PREFIX = "treeGroves_";
const STORAGE_KEY = STORAGE_PREFIX + "gameState";

// --- Reset safety ---
// Prevents the "reset doesn't reset" bug where a still-running interval re-saves state.
let isResetting = false;
let mainLoopInterval = null;
let era2LoopInterval = null;

// --- Pause state ---
// Pauses simulation completely when tab loses focus
let isSimPaused = false;
let pausedAtMs = 0;
let allowBackgroundSim = false;

// --- Game State ---
const PERSISTED_STATE_KEYS = [
  "treeOlives",
  "harvestedOlives",
  "marketOlives",
  "marketOliveOil",
  "marketAutosellRateUpgrades",
  "marketLanesPurchased",
  "marketPriceUpgrades",
  "renownValue",
  "renownLifetime",
  "renownCapped",
  "cityInvitationAcknowledged",
  "florinsLifetimeEarned",
  "runStats",
  "era",
  "estateSnapshot",
  "oliveOilCount",
  "florinCount",
  "cultivatorCount",
  "harvesterCount",
  "presserCount",
  "arboristHired",
  "foremanHired",
  "pressManagerHired",
  "quarryManagerHired",
  "olivePressCount",
  "quarryPickLevel",
  "quarryCartLevel",
  "harvestBasketLevel",
  "autoShipOilUnlocked",
  "simElapsedSeconds",
  "stone",
  "upgrades",
  "meta",
];

function createDefaultRunStats(startTimestamp = Date.now()) {
  const start = Number.isFinite(Number(startTimestamp)) ? Number(startTimestamp) : Date.now();
  return {
    era1: {
      startTimestamp: start,
      endTimestamp: null,
      durationSeconds: 0,
      florins: {
        earnedTotal: 0,
        spentTotal: 0,
        netTotal: 0,
      },
      goods: {
        olivesSold: 0,
        oliveOilSold: 0,
        olivesPressed: 0,
      },
      resources: {
        stoneEarned: 0,
        stoneSpent: 0,
      },
      workers: {
        harvestersHired: 0,
        cultivatorsHired: 0,
        pressersHired: 0,
      },
      investments: {
        purchasedCount: 0,
        purchasedById: {},
      },
    },
  };
}

function normalizeRunStats(runStatsCandidate, { startTimestampFallback, legacy } = {}) {
  const fallbackStart = Number.isFinite(Number(startTimestampFallback))
    ? Number(startTimestampFallback)
    : Date.now();
  const defaults = createDefaultRunStats(fallbackStart);
  const candidateEra1 = runStatsCandidate?.era1 || {};
  const legacyStart = Number.isFinite(Number(legacy?.era1StartTimestamp))
    ? Number(legacy.era1StartTimestamp)
    : null;
  const legacyEnd = Number.isFinite(Number(legacy?.era1EndTimestamp))
    ? Number(legacy.era1EndTimestamp)
    : null;
  const startTimestamp = Number.isFinite(Number(candidateEra1.startTimestamp))
    ? Number(candidateEra1.startTimestamp)
    : (legacyStart ?? defaults.era1.startTimestamp);
  const endTimestamp = Number.isFinite(Number(candidateEra1.endTimestamp))
    ? Number(candidateEra1.endTimestamp)
    : legacyEnd;
  const earnedTotal = Number.isFinite(Number(candidateEra1.florins?.earnedTotal))
    ? Number(candidateEra1.florins.earnedTotal)
    : (Number.isFinite(Number(legacy?.era1TotalFlorinsEarned)) ? Number(legacy.era1TotalFlorinsEarned) : 0);
  const spentTotal = Number.isFinite(Number(candidateEra1.florins?.spentTotal))
    ? Number(candidateEra1.florins.spentTotal)
    : (Number.isFinite(Number(legacy?.era1TotalFlorinsSpent)) ? Number(legacy.era1TotalFlorinsSpent) : 0);
  const durationSeconds = Number.isFinite(Number(candidateEra1.durationSeconds))
    ? Number(candidateEra1.durationSeconds)
    : (Number.isFinite(Number(legacy?.era1DurationSeconds)) ? Number(legacy.era1DurationSeconds) : 0);
  const oliveOilSold = Number.isFinite(Number(candidateEra1.goods?.oliveOilSold))
    ? Number(candidateEra1.goods.oliveOilSold)
    : (Number.isFinite(Number(legacy?.era1TotalOilSold)) ? Number(legacy.era1TotalOilSold) : 0);

  const normalized = {
    era1: {
      startTimestamp: Math.max(0, startTimestamp),
      endTimestamp: endTimestamp == null ? null : Math.max(Math.max(0, startTimestamp), Number(endTimestamp)),
      durationSeconds: Math.max(0, durationSeconds),
      florins: {
        earnedTotal: Math.max(0, earnedTotal),
        spentTotal: Math.max(0, spentTotal),
        netTotal: 0,
      },
      goods: {
        olivesSold: Math.max(0, Number(candidateEra1.goods?.olivesSold) || 0),
        oliveOilSold: Math.max(0, oliveOilSold),
        olivesPressed: Math.max(0, Number(candidateEra1.goods?.olivesPressed) || 0),
      },
      resources: {
        stoneEarned: Math.max(0, Number(candidateEra1.resources?.stoneEarned) || 0),
        stoneSpent: Math.max(0, Number(candidateEra1.resources?.stoneSpent) || 0),
      },
      workers: {
        harvestersHired: Math.max(0, Number(candidateEra1.workers?.harvestersHired) || 0),
        cultivatorsHired: Math.max(0, Number(candidateEra1.workers?.cultivatorsHired) || 0),
        pressersHired: Math.max(0, Number(candidateEra1.workers?.pressersHired) || 0),
      },
      investments: {
        purchasedCount: Math.max(0, Number(candidateEra1.investments?.purchasedCount) || 0),
        purchasedById: {},
      },
    },
  };

  const rawPurchasedById = candidateEra1.investments?.purchasedById;
  if (rawPurchasedById && typeof rawPurchasedById === "object" && !Array.isArray(rawPurchasedById)) {
    Object.entries(rawPurchasedById).forEach(([id, value]) => {
      if (typeof id !== "string" || !id) return;
      const count = Math.max(0, Math.floor(Number(value) || 0));
      if (count > 0) {
        normalized.era1.investments.purchasedById[id] = count;
      }
    });
  }
  const purchasedByIdTotal = Object.values(normalized.era1.investments.purchasedById)
    .reduce((acc, value) => acc + (Number(value) || 0), 0);
  normalized.era1.investments.purchasedCount = Math.max(
    Number(normalized.era1.investments.purchasedCount) || 0,
    purchasedByIdTotal
  );

  normalized.era1.florins.netTotal =
    normalized.era1.florins.earnedTotal - normalized.era1.florins.spentTotal;

  return normalized;
}

function createDefaultState() {
  const nowMs = Date.now();
  return {
    // Grove mechanics
    treeOlives: 15,

    // Player inventory
    harvestedOlives: 0,
    marketOlives: 0,
    marketOliveOil: 0,
    marketAutosellRateUpgrades: 0,
    marketLanesPurchased: 0,
    marketPriceUpgrades: 0,
    renownValue: 0,
    renownLifetime: 0,
    renownCapped: false,
    cityInvitationAcknowledged: false,
    florinsLifetimeEarned: 0,
    runStats: createDefaultRunStats(nowMs),
    era: 1,
    estateSnapshot: null,
    oliveOilCount: 0,
    florinCount: 0,

    // Stone
    stone: 0,

    // Workers
    cultivatorCount: 0,
    harvesterCount: 0,
    presserCount: 0,
    arboristHired: false,
    foremanHired: false,
    pressManagerHired: false,
    quarryManagerHired: false,
    olivePressCount: 1,
    quarryPickLevel: 0,
    quarryCartLevel: 0,
    harvestBasketLevel: 0,
    autoShipOilUnlocked: false,
    simElapsedSeconds: 0,

    // Upgrades
    upgrades: {},

    // For future expansion
    meta: {
      createdAt: null,
      version: "treeGroves",
    },
  };
}

function pickPersistedState(parsed) {
  if (!parsed || typeof parsed !== "object") return {};
  return PERSISTED_STATE_KEYS.reduce((acc, key) => {
    if (key === "cultivatorCount" && !(key in parsed) && "farmHandCount" in parsed) {
      acc[key] = parsed.farmHandCount;
      return acc;
    }
    if (key in parsed) acc[key] = parsed[key];
    return acc;
  }, {});
}

function buildPersistedState(currentState) {
  return pickPersistedState(currentState);
}

let state = createDefaultState();
const renownTierConfig = (Array.isArray(TUNING.renownTiers) ? [...TUNING.renownTiers] : [])
  .filter((tier) => tier && typeof tier.id === "string" && typeof tier.name === "string" && Number.isFinite(Number(tier.minRenown)))
  .map((tier) => ({
    ...tier,
    minRenown: Number(tier.minRenown),
    maxRenown: tier.maxRenown == null ? null : Number(tier.maxRenown),
  }))
  .sort((a, b) => a.minRenown - b.minRenown);

// --- Harvest Config (upgrade-tweakable) ---
const harvestConfig = {
  batchSize: TUNING.harvest.baseBatchSize,
  outcomes: TUNING.harvest.outcomes,
};

// --- Cultivator Hire Cost ---
function getCultivatorHireCost() {
  const count = state.cultivatorCount;
  const baseCost = TUNING.workers.cultivator.baseCost;
  const threshold = TUNING.workers.cultivator.costScaleThreshold;
  
  if (count < threshold) {
    return baseCost + (count * TUNING.workers.cultivator.costScaleLow);
  } else {
    // Cost at threshold + additional cost for workers beyond threshold
    const costAtThreshold = baseCost + (threshold * TUNING.workers.cultivator.costScaleLow);
    const beyondThreshold = count - threshold;
    return costAtThreshold + (beyondThreshold * TUNING.workers.cultivator.costScaleHigh);
  }
}

// --- Cultivator Effects ---
function getCultivatorBonusPerSecond() {
  let bonus = state.cultivatorCount * TUNING.workers.cultivator.olivesPerSecondPerCultivator;
  
  if (state.foremanHired && foremanIsActive) {
    bonus *= TUNING.managers.foreman.growthMultiplier;
  }
  
  return bonus;
}

function getGroveExpansionBonus() {
  let bonus = 0;
  const expansions = TUNING.investments.groveExpansion;
  for (let i = 0; i < expansions.length; i++) {
    const upgradeId = `expand_grove_${expansions[i].idSuffix}`;
    if (state.upgrades[upgradeId]) {
      bonus += expansions[i].capacityBonus;
    }
  }
  return bonus;
}

function formatOlivesPerSecond(value) {
  const rounded = value < 1 ? value.toFixed(3) : value.toFixed(2);
  return rounded.replace(/\.?0+$/, "");
}

// --- Harvester Hire Cost ---
function getHarvesterHireCost() {
  return TUNING.workers.harvester.baseCost + (state.harvesterCount * TUNING.workers.harvester.costScale);
}

// --- Harvester Effects ---
function getHarvesterOlivesBonus() {
  // Simple linear bonus: each harvester provides +0.6 olives per harvest
  return state.harvesterCount * TUNING.workers.harvester.olivesPerHarvest;
}

function calculateHarvesterHirePreview() {
  const currentCount = state.harvesterCount;
  const nextCount = currentCount + 1;
  
  // Calculate olives bonus (simple linear scaling)
  const currentOlives = currentCount * TUNING.workers.harvester.olivesPerHarvest;
  const nextOlives = nextCount * TUNING.workers.harvester.olivesPerHarvest;
  
  return {
    olives: { current: currentOlives, next: nextOlives }
  };
}

// --- Presser Hire Cost ---
function getPresserHireCost() {
  return TUNING.workers.presser.baseCost + (state.presserCount * TUNING.workers.presser.costScale);
}

// --- Presser Effects ---
// Active state for Press Manager (computed each tick)
let pressManagerIsActive = false;

// Active state for Quarry Manager (computed each tick)
let quarryManagerIsActive = false;

// Active state for Foreman (computed each tick)
let foremanIsActive = false;

// --- Press Output Helpers ---
function getBaseOilPerOlive() {
  return TUNING.press.baseOilPerPress / TUNING.press.olivesPerPress;
}

function getTotalOilPerOlive() {
  let bonusPerOlive = state.presserCount * TUNING.workers.presser.oilPerOlivePerPresser;
  if (state.pressManagerHired && pressManagerIsActive) {
    bonusPerOlive *= TUNING.managers.pressManager.presserMultiplier;
  }
  return getBaseOilPerOlive() + bonusPerOlive;
}

function formatOilPerPress(value) {
  return value < 1 ? value.toFixed(3) : value.toFixed(2);
}

// --- Shipping Capacity Helpers ---
/**
 * Calculate olive shipping capacity including upgrade bonuses.
 */
function getOliveShippingCapacity() {
  let capacity = TUNING.market.shipping.olives.baseBatchSize;
  
  // Add bonuses from purchased upgrades
  const upgrades = TUNING.investments.shippingEfficiency.olives;
  for (let i = 0; i < upgrades.length; i++) {
    const upgradeId = `olive_ship_efficiency_${upgrades[i].idSuffix}`;
    if (state.upgrades[upgradeId]) {
      capacity += upgrades[i].capacityBonus;
    }
  }
  
  return capacity;
}

/**
 * Calculate olive oil shipping capacity including upgrade bonuses.
 */
function getOliveOilShippingCapacity() {
  let capacity = TUNING.market.shipping.oliveOil.baseBatchSize;

  // Add bonuses from general cart upgrades (shared with olives)
  const cartUpgrades = TUNING.investments.shippingEfficiency.olives;
  for (let i = 0; i < cartUpgrades.length; i++) {
    const upgradeId = `olive_ship_efficiency_${cartUpgrades[i].idSuffix}`;
    if (state.upgrades[upgradeId]) {
      capacity += cartUpgrades[i].capacityBonus;
    }
  }

  return capacity;
}

// --- Quarry Helpers ---
function getQuarryDurationSeconds() {
  const level = state.quarryCartLevel || 0;
  const reduction = level * TUNING.investments.pulleyCart.reductionPerLevel;
  return TUNING.quarry.durationSeconds * (1 - reduction);
}

// --- Quarry Output Helper ---
function getQuarryOutput() {
  const bonus = (state.quarryPickLevel || 0) * TUNING.investments.sharpenedPicks.bonusPerLevel;
  return TUNING.quarry.outputPerRun + bonus;
}

// --- Olive Press Scaling Helper ---
function getOlivesToPress() {
  const olivesPerPress = TUNING.press.olivesPerPress;
  const pressCount = state.olivePressCount || 1;
  const pressableOlives = getShippableCount(state.harvestedOlives);
  const availableMultiples = Math.floor(pressableOlives / olivesPerPress);
  const multiplesToRun = Math.min(availableMultiples, pressCount);
  return multiplesToRun * olivesPerPress;
}

// --- Harvest Job State (not persisted) ---
let isHarvesting = false;
let harvestJob = {
  startTimeMs: 0,
  durationMs: 0,
  attempted: 0,
  outcome: null,
};

// --- Ship Job State (not persisted) ---
let isShipping = false;
let shipJob = {
  startTimeMs: 0,
  durationMs: 0,
  amount: 0,
  timeOutcomeKey: null,
  incidentKey: null,
  lostCount: 0,
  stolenCount: 0,
};

// --- Press Job State (not persisted) ---
let isPressing = false;
let pressJob = {
  startTimeMs: 0,
  durationMs: 0,
  olivesConsumed: 0,
  oilPerOlive: 0,
};

// --- Olive Oil Ship Job State (not persisted) ---
let isShippingOliveOil = false;
let oliveOilShipJob = {
  startTimeMs: 0,
  durationMs: 0,
  amount: 0,
  timeOutcomeKey: null,
  incidentKey: null,
  lostCount: 0,
  stolenCount: 0,
};

// --- Quarry Job State (not persisted) ---
let isQuarrying = false;
let quarryJob = {
  startTimeMs: 0,
  durationMs: 0,
};

// --- Market Loop State (not persisted) ---
const MARKET_LOOP_MS = 1000;
let marketLoopInterval = null;
let marketLoopLastMs = 0;
let autosellProgress = 0;
let activeCityModifiers = [];

// --- Arborist Active State (computed each tick) ---
let arboristIsActive = false;

// --- DOM ---
const florinCountEl = document.getElementById("florin-count");
const treeOlivesEl = document.getElementById("tree-olives");
const treeCapacityEl = document.getElementById("tree-capacity");
const treeGrowthRateEl = document.getElementById("tree-growth-rate");
const marketOliveCountEl = document.getElementById("market-olive-count");
const marketOilCountEl = document.getElementById("market-oil-count");
const marketAutosellEl = document.getElementById("market-autosell");
const renownValueEl = document.getElementById("renown-value");
const renownTierNameEl = document.getElementById("renown-tier-name");
const renownProgressFillEl = document.getElementById("renown-progress-fill");
const renownProgressTextEl = document.getElementById("renown-progress-text");

// Log containers
const farmLogPlayerEl = document.getElementById("farmLogPlayer");
const farmLogDebugEl = document.getElementById("farmLogDebug");
const marketLogPlayerEl = document.getElementById("marketLogPlayer");
const marketLogDebugEl = document.getElementById("marketLogDebug");

// Log tab buttons
const farmLogTabPlayer = document.getElementById("farmLogTabPlayer");
const farmLogTabDebug = document.getElementById("farmLogTabDebug");
const marketLogTabPlayer = document.getElementById("marketLogTabPlayer");
const marketLogTabDebug = document.getElementById("marketLogTabDebug");

const harvestBtn = document.getElementById("harvest-btn");
const harvestProgress = document.getElementById("harvest-progress");
const harvestProgressBar = document.getElementById("harvest-progress-bar");
const harvestCountdown = document.getElementById("harvest-countdown");
const harvestPill = document.getElementById("harvest-pill");
const harvestAttemptingCount = document.getElementById("harvest-attempting-count");
const productionSection = document.getElementById("production-section");

const invOlivesQty = document.getElementById("inv-olives-qty");
const invOliveOilQty = document.getElementById("inv-olive-oil-qty");
const invTransitPill = document.getElementById("inv-olives-transit");
const invTransitCount = document.getElementById("inv-olives-transit-count");
const shipProgressBar = document.getElementById("ship-progress-bar");
const shipCountdown = document.getElementById("ship-countdown");
const shipProgressContainer = document.getElementById("ship-progress");
const shipOlivesBtn = document.getElementById("ship-olives-btn");

const invOliveOilTransit = document.getElementById("inv-olive-oil-transit");
const invOliveOilTransitCount = document.getElementById("inv-olive-oil-transit-count");
const shipOliveOilProgressBar = document.getElementById("ship-olive-oil-progress-bar");
const shipOliveOilCountdown = document.getElementById("ship-olive-oil-countdown");
const shipOliveOilProgressContainer = document.getElementById("ship-olive-oil-progress");
const shipOliveOilBtn = document.getElementById("ship-olive-oil-btn");

const olivePressCountEl = document.getElementById("olive-press-count");
const pressBtn = document.getElementById("press-btn");
const pressPill = document.getElementById("press-pill");
const pressPillCount = document.getElementById("press-pill-count");
const pressProgressContainer = document.getElementById("press-progress");
const pressProgressBar = document.getElementById("press-progress-bar");
const pressCountdown = document.getElementById("press-countdown");
const pressConsumesEl = document.getElementById("press-consumes");
const pressProducesEl = document.getElementById("press-produces");

const quarryBtn = document.getElementById("quarry-btn");
const quarryPill = document.getElementById("quarry-pill");
const quarryPillCount = document.getElementById("quarry-pill-count");
const quarryProgressContainer = document.getElementById("quarry-progress");
const quarryProgressBar = document.getElementById("quarry-progress-bar");
const quarryCountdown = document.getElementById("quarry-countdown");
const quarryNextEl = document.getElementById("quarry-next");
const harvestNextEl = document.getElementById("harvest-next");
const invStoneQty = document.getElementById("inv-stone-qty");

const cultivatorCountEl = document.getElementById("cultivator-count");
const hireCultivatorBtn = document.getElementById("hire-cultivator-btn");
const hireCultivatorCostEl = document.getElementById("hire-cultivator-cost");
const cultivatorImpactEl = document.getElementById("cultivator-impact");
const cultivatorBadgeManager = document.getElementById("cultivator-badge-manager");
const cultivatorBadgeStatus = document.getElementById("cultivator-badge-status");
const cultivatorBadgeExtra = document.getElementById("cultivator-badge-extra");
const cultivatorDelta = document.getElementById("cultivator-delta");

const harvesterCountEl = document.getElementById("harvester-count");
const hireHarvesterBtn = document.getElementById("hire-harvester-btn");
const hireHarvesterCostEl = document.getElementById("hire-harvester-cost");
const harvesterImpactEl = document.getElementById("harvester-impact");
const harvesterBadgeManager = document.getElementById("harvester-badge-manager");
const harvesterBadgeStatus = document.getElementById("harvester-badge-status");
const harvesterBadgeExtra = document.getElementById("harvester-badge-extra");
const harvesterDelta = document.getElementById("harvester-delta");

const presserCountEl = document.getElementById("presser-count");
const hirePresserBtn = document.getElementById("hire-presser-btn");
const hirePresserCostEl = document.getElementById("hire-presser-cost");
const presserImpactEl = document.getElementById("presser-impact");
const presserBadgeManager = document.getElementById("presser-badge-manager");
const presserBadgeStatus = document.getElementById("presser-badge-status");
const presserBadgeExtra = document.getElementById("presser-badge-extra");
const presserDelta = document.getElementById("presser-delta");

const arboristNameEl = document.getElementById("arborist-name");
const arboristSalaryEl = document.getElementById("arborist-salary");
const managersEmptyEl = document.getElementById("managers-empty");
const managersArboristWrap = document.getElementById("managers-arborist");
const managersPressMgrWrap = document.getElementById("managers-press-manager");
const pressManagerNameEl = document.getElementById("press-manager-name");
const pressManagerSalaryEl = document.getElementById("press-manager-salary");
const managersQuarryMgrWrap = document.getElementById("managers-quarry-manager");
const quarryManagerNameEl = document.getElementById("quarry-manager-name");
const quarryManagerSalaryEl = document.getElementById("quarry-manager-salary");
const managersForemanWrap = document.getElementById("managers-foreman");
const foremanNameEl = document.getElementById("foreman-name");
const foremanSalaryEl = document.getElementById("foreman-salary");
const managersTotalWrap = document.getElementById("managers-total");
const managersTotalCostEl = document.getElementById("managers-total-cost");

// Log UI
const clearLogBtn = document.getElementById("clear-log-btn");
const clearMarketLogBtn = document.getElementById("clear-market-log-btn");

// Sim timer
const simTimerEl = document.getElementById("sim-timer");

// Debug UI
const debugBtn = document.getElementById("debug-btn");
const debugBtnEra2 = document.getElementById("debug-btn-era2");
const debugModal = document.getElementById("debug-modal");
const debugCloseBtn = document.getElementById("debug-close-btn");
const debugResetBtn = document.getElementById("debug-reset-btn");
const debugAddFlorins1000Btn = document.getElementById("debug-add-florins-1000-btn");
const debugEra1Content = document.getElementById("debug-era1-content");
const debugAddOlivesBtn = document.getElementById("debug-add-olives-btn");
const debugAddFlorinsBtn = document.getElementById("debug-add-florins-btn");
const debugAddOilBtn = document.getElementById("debug-add-oil-btn");
const debugAddRenownBtn = document.getElementById("debug-add-renown-btn");
const debugHarvestChancesEl = document.getElementById("debug-harvest-chances");
const invitationModal = document.getElementById("invitation-modal");
const invitationUnderstoodBtn = document.getElementById("invitation-understood-btn");
const relocationReqLifetimeIcon = document.getElementById("relocation-req-lifetime-icon");
const relocationReqLifetimeText = document.getElementById("relocation-req-lifetime-text");
const relocationReqRenownIcon = document.getElementById("relocation-req-renown-icon");
const relocationReqRenownText = document.getElementById("relocation-req-renown-text");
const relocationReqCurrentIcon = document.getElementById("relocation-req-current-icon");
const moveToCityBtn = document.getElementById("move-to-city-btn");
const era2ResetBtn = document.getElementById("era2-reset-btn");
const eraOneRoot = document.getElementById("era1-root");
const eraTwoScreen = document.getElementById("era2-screen");
const era2FlorinCountEl = document.getElementById("era2-florin-count");
const era2EstateIncomeEl = document.getElementById("era2-estate-income");
const era2SummaryTimeEl = document.getElementById("era2-summary-time");
const era2RunOutcomeEstateIncomeEl = document.getElementById("era2-run-outcome-estate-income");
const era2SummaryFlorinsEarnedEl = document.getElementById("era2-summary-florins-earned");
const era2SummaryFlorinsSpentEl = document.getElementById("era2-summary-florins-spent");
const era2SummaryFlorinsNetEl = document.getElementById("era2-summary-florins-net");
const era2SummaryOlivesSoldEl = document.getElementById("era2-summary-olives-sold");
const era2SummaryOliveOilSoldEl = document.getElementById("era2-summary-olive-oil-sold");
const era2SummaryOlivesPressedEl = document.getElementById("era2-summary-olives-pressed");
const era2SummaryStoneEarnedEl = document.getElementById("era2-summary-stone-earned");
const era2SummaryStoneSpentEl = document.getElementById("era2-summary-stone-spent");
const era2SummaryHarvestersHiredEl = document.getElementById("era2-summary-harvesters-hired");
const era2SummaryCultivatorsHiredEl = document.getElementById("era2-summary-cultivators-hired");
const era2SummaryPressersHiredEl = document.getElementById("era2-summary-pressers-hired");
const era2SummaryInvestmentsTotalEl = document.getElementById("era2-summary-investments-total");
const era2SummaryInvestmentsTopEl = document.getElementById("era2-summary-investments-top");

const harvestActionUI = createInlineActionController({
  pillEl: harvestPill,
  countEl: harvestAttemptingCount,
  progressEl: harvestProgress,
  barEl: harvestProgressBar,
  countdownEl: harvestCountdown,
  keepLayout: true,
});

const shipActionUI = createInlineActionController({
  pillEl: invTransitPill,
  countEl: invTransitCount,
  progressEl: shipProgressContainer,
  barEl: shipProgressBar,
  countdownEl: shipCountdown,
  keepLayout: false,
});

const pressActionUI = createInlineActionController({
  pillEl: pressPill,
  countEl: pressPillCount,
  progressEl: pressProgressContainer,
  barEl: pressProgressBar,
  countdownEl: pressCountdown,
  keepLayout: false,
});

const oliveOilShipActionUI = createInlineActionController({
  pillEl: invOliveOilTransit,
  countEl: invOliveOilTransitCount,
  progressEl: shipOliveOilProgressContainer,
  barEl: shipOliveOilProgressBar,
  countdownEl: shipOliveOilCountdown,
  keepLayout: false,
});

const quarryActionUI = createInlineActionController({
  pillEl: quarryPill,
  countEl: quarryPillCount,
  progressEl: quarryProgressContainer,
  barEl: quarryProgressBar,
  countdownEl: quarryCountdown,
  keepLayout: false,
});

// --- Logging ---
// --- Logging (wrappers for new logger) ---
function logLine(message, color = null) {
  logPlayer({ channel: 'farm', text: message, color });
}

function marketLogLine(message) {
  logPlayer({ channel: 'market', text: message });
}


// --- Inline Action UI ---
function createInlineActionController({ pillEl, countEl, progressEl, barEl, countdownEl, keepLayout }) {
  const fadeClass = "inline-fade-out";
  const invisibleClass = "is-invisible";

  function setCount(value) {
    if (!countEl || value === undefined || value === null) return;
    countEl.textContent = value;
  }

  function showPill() {
    if (keepLayout) {
      pillEl.classList.remove(invisibleClass);
      return;
    }
    pillEl.hidden = false;
    pillEl.classList.remove(fadeClass);
  }

  function hidePill() {
    if (keepLayout) {
      pillEl.classList.add(invisibleClass);
      return;
    }
    pillEl.classList.add(fadeClass);
  }

  function showProgress() {
    progressEl.classList.add("active");
    if (countdownEl) countdownEl.style.display = "flex";
  }

  function hideProgress() {
    progressEl.classList.remove("active");
    if (countdownEl) countdownEl.style.display = "none";
  }

  function setProgress(percent) {
    if (!barEl || percent === undefined || percent === null) return;
    barEl.style.width = percent + "%";
  }

  function setCountdown(text) {
    if (!countdownEl || text === undefined || text === null) return;
    countdownEl.textContent = text;
  }

  function start({ count, percent = 0 } = {}) {
    setCount(count);
    showPill();
    showProgress();
    setProgress(percent);
  }

  function update({ count, percent, countdownText } = {}) {
    setCount(count);
    setProgress(percent);
    setCountdown(countdownText);
  }

  function setIdle({ resetBar = true } = {}) {
    hideProgress();
    if (resetBar) setProgress(0);

    if (keepLayout) {
      pillEl.classList.add(invisibleClass);
      return;
    }

    pillEl.hidden = true;
    pillEl.classList.remove(fadeClass);
  }

  function end() {
    hideProgress();
    hidePill();

    window.setTimeout(() => {
      if (!keepLayout) {
        pillEl.hidden = true;
        pillEl.classList.remove(fadeClass);
      }
      setProgress(0);
    }, 160);
  }

  return { start, update, setIdle, end };
}

// --- Storage ---
function logRenownLoadValues() {
  const text = `Renown loaded: value=${state.renownValue}, lifetime=${state.renownLifetime}, capped=${state.renownCapped}`;
  if (farmLogDebugEl || marketLogDebugEl) {
    logDebug({ channel: farmLogDebugEl ? "farm" : "market", text });
    return;
  }
  console.debug(text);
}

function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const defaults = createDefaultState();
  if (!raw) {
    // Fresh start
    state = defaults;
    state.meta.createdAt = new Date().toISOString();
    saveGame(); // create key immediately so it's easy to see in DevTools
    logRenownLoadValues();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const persisted = pickPersistedState(parsed);
    // Shallow merge so missing fields get defaults
    state = { ...defaults, ...persisted, meta: { ...defaults.meta, ...(persisted.meta || {}) } };
    state.renownValue = Number.isFinite(Number(state.renownValue)) ? Number(state.renownValue) : defaults.renownValue;
    state.renownLifetime = Number.isFinite(Number(state.renownLifetime)) ? Number(state.renownLifetime) : defaults.renownLifetime;
    state.renownCapped = typeof state.renownCapped === "boolean" ? state.renownCapped : defaults.renownCapped;
    state.cityInvitationAcknowledged = typeof state.cityInvitationAcknowledged === "boolean"
      ? state.cityInvitationAcknowledged
      : defaults.cityInvitationAcknowledged;
    state.florinsLifetimeEarned = Number.isFinite(Number(state.florinsLifetimeEarned))
      ? Number(state.florinsLifetimeEarned)
      : Math.max(0, Number(state.florinCount) || 0);
    const createdAtMs = Number.isFinite(Date.parse(state.meta?.createdAt || ""))
      ? Date.parse(state.meta.createdAt)
      : null;
    state.runStats = normalizeRunStats(state.runStats, {
      startTimestampFallback: createdAtMs ?? Date.now(),
      legacy: {
        era1StartTimestamp: parsed?.era1StartTimestamp,
        era1EndTimestamp: parsed?.era1EndTimestamp,
        era1DurationSeconds: parsed?.era1DurationSeconds,
        era1TotalFlorinsEarned: parsed?.era1TotalFlorinsEarned ?? state.florinsLifetimeEarned,
        era1TotalFlorinsSpent: parsed?.era1TotalFlorinsSpent,
        era1TotalOilSold: parsed?.era1TotalOilSold,
      },
    });
    state.era = Number.isFinite(Number(state.era))
      ? Math.max(1, Math.floor(Number(state.era)))
      : defaults.era;
    state.estateSnapshot = (state.estateSnapshot && typeof state.estateSnapshot === "object")
      ? state.estateSnapshot
      : defaults.estateSnapshot;
    if (Number(state.era) >= 2 && state.runStats.era1.endTimestamp == null) {
      state.runStats.era1.endTimestamp = Date.now();
    }
    if (state.runStats.era1.endTimestamp != null && state.runStats.era1.durationSeconds <= 0) {
      const computedSeconds = Math.max(0, Math.floor((state.runStats.era1.endTimestamp - state.runStats.era1.startTimestamp) / 1000));
      state.runStats.era1.durationSeconds = computedSeconds;
    }
    if (state.runStats.era1.florins) {
      state.runStats.era1.florins.netTotal =
        (Number(state.runStats.era1.florins.earnedTotal) || 0) -
        (Number(state.runStats.era1.florins.spentTotal) || 0);
    }

    if (!state.meta.createdAt) {
      state.meta.createdAt = new Date().toISOString();
    }
  } catch (e) {
    console.warn("Failed to parse saved game state. Starting fresh.", e);
    state = defaults;
    state.meta.createdAt = new Date().toISOString();
    saveGame();
  }
  logRenownLoadValues();
  maybeShowInvitationModal();
}

function saveGame() {
  if (isResetting) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedState(state)));
}

function resetGame() {
  if (!confirm("Reset this prototype? All progress for this prototype will be lost.")) return;

  isResetting = true;
  if (mainLoopInterval) clearInterval(mainLoopInterval);
  if (era2LoopInterval) clearInterval(era2LoopInterval);
  stopMarketLoop();

  localStorage.removeItem(STORAGE_KEY);

  // Cache-bust reload (useful on GitHub Pages)
  window.location.href = window.location.pathname + "?t=" + Date.now();
}

function getRunStatsEra1() {
  if (!state.runStats || typeof state.runStats !== "object") {
    state.runStats = createDefaultRunStats(Date.now());
  }
  if (!state.runStats.era1 || typeof state.runStats.era1 !== "object") {
    state.runStats = createDefaultRunStats(Date.now());
  }
  return state.runStats.era1;
}

function updateRunStatsFlorinNetTotal() {
  const era1 = getRunStatsEra1();
  const earned = Number(era1.florins?.earnedTotal) || 0;
  const spent = Number(era1.florins?.spentTotal) || 0;
  era1.florins.netTotal = earned - spent;
}

function isEra1TrackingActive() {
  const era1 = getRunStatsEra1();
  return Number(state.era) === 1 && era1.endTimestamp == null;
}

function addFlorinsEarned(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (!isEra1TrackingActive()) return;
  const era1 = getRunStatsEra1();
  era1.florins.earnedTotal = (Number(era1.florins.earnedTotal) || 0) + amount;
  updateRunStatsFlorinNetTotal();
}

function addFlorinsSpent(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (!isEra1TrackingActive()) return;
  const era1 = getRunStatsEra1();
  era1.florins.spentTotal = (Number(era1.florins.spentTotal) || 0) + amount;
  updateRunStatsFlorinNetTotal();
}

function addOlivesSold(units) {
  if (!Number.isFinite(units) || units <= 0) return;
  if (!isEra1TrackingActive()) return;
  const era1 = getRunStatsEra1();
  era1.goods.olivesSold = (Number(era1.goods.olivesSold) || 0) + units;
}

function addOliveOilSold(units) {
  if (!Number.isFinite(units) || units <= 0) return;
  if (!isEra1TrackingActive()) return;
  const era1 = getRunStatsEra1();
  era1.goods.oliveOilSold = (Number(era1.goods.oliveOilSold) || 0) + units;
}

function addOlivesPressed(units) {
  if (!Number.isFinite(units) || units <= 0) return;
  if (!isEra1TrackingActive()) return;
  const era1 = getRunStatsEra1();
  era1.goods.olivesPressed = (Number(era1.goods.olivesPressed) || 0) + units;
}

function addStoneEarned(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (!isEra1TrackingActive()) return;
  const era1 = getRunStatsEra1();
  era1.resources.stoneEarned = (Number(era1.resources.stoneEarned) || 0) + amount;
}

function addStoneSpent(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (!isEra1TrackingActive()) return;
  const era1 = getRunStatsEra1();
  era1.resources.stoneSpent = (Number(era1.resources.stoneSpent) || 0) + amount;
}

function addWorkerHire(workerType) {
  if (!isEra1TrackingActive()) return;
  const era1 = getRunStatsEra1();
  if (workerType === "harvestersHired") {
    era1.workers.harvestersHired = (Number(era1.workers.harvestersHired) || 0) + 1;
    return;
  }
  if (workerType === "cultivatorsHired") {
    era1.workers.cultivatorsHired = (Number(era1.workers.cultivatorsHired) || 0) + 1;
    return;
  }
  if (workerType === "pressersHired") {
    era1.workers.pressersHired = (Number(era1.workers.pressersHired) || 0) + 1;
  }
}

function addInvestmentPurchased(investmentId) {
  if (!isEra1TrackingActive()) return;
  if (typeof investmentId !== "string" || !investmentId) return;
  const era1 = getRunStatsEra1();
  era1.investments.purchasedCount = (Number(era1.investments.purchasedCount) || 0) + 1;
  if (!era1.investments.purchasedById || typeof era1.investments.purchasedById !== "object") {
    era1.investments.purchasedById = {};
  }
  era1.investments.purchasedById[investmentId] =
    (Number(era1.investments.purchasedById[investmentId]) || 0) + 1;
}

function finalizeEra1RunStats() {
  const era1 = getRunStatsEra1();
  if (era1.endTimestamp == null) {
    era1.endTimestamp = Date.now();
  }
  const wallDuration = Math.max(0, Math.floor((era1.endTimestamp - era1.startTimestamp) / 1000));
  const simDuration = Math.max(0, Math.floor(Number(state.simElapsedSeconds) || 0));
  era1.durationSeconds = Math.max(wallDuration, simDuration);

  // Stamp values from state as ground truth — incremental tracking may be
  // incomplete for saves that predate the runStats system.
  const lifetimeEarned = Number(state.florinsLifetimeEarned) || 0;
  era1.florins.earnedTotal = Math.max(Number(era1.florins.earnedTotal) || 0, lifetimeEarned);
  // Spent = everything earned minus what's left in the bank (relocation cost already deducted)
  const derivedSpent = Math.max(0, lifetimeEarned - (Number(state.florinCount) || 0));
  era1.florins.spentTotal = Math.max(Number(era1.florins.spentTotal) || 0, derivedSpent);
  updateRunStatsFlorinNetTotal();

  era1.workers.harvestersHired = Math.max(Number(era1.workers.harvestersHired) || 0, Number(state.harvesterCount) || 0);
  era1.workers.cultivatorsHired = Math.max(Number(era1.workers.cultivatorsHired) || 0, Number(state.cultivatorCount) || 0);
  era1.workers.pressersHired = Math.max(Number(era1.workers.pressersHired) || 0, Number(state.presserCount) || 0);
}

function addFlorins(amount, { trackLifetime = true } = {}) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  state.florinCount += amount;
  if (trackLifetime) {
    state.florinsLifetimeEarned = (Number(state.florinsLifetimeEarned) || 0) + amount;
  }
  addFlorinsEarned(amount);
  return amount;
}

function spendFlorins(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if ((Number(state.florinCount) || 0) < amount) return false;
  state.florinCount -= amount;
  addFlorinsSpent(amount);
  return true;
}

function formatRunDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatSummaryFlorins(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSummaryCount(value, fractionDigits = 0) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return safe.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

function getEra1DurationSecondsForSummary() {
  const era1 = getRunStatsEra1();
  if (Number(era1.durationSeconds) > 0) return Number(era1.durationSeconds);
  const start = Number(era1.startTimestamp) || 0;
  if (start <= 0) return 0;
  const end = Number.isFinite(Number(era1.endTimestamp))
    ? Number(era1.endTimestamp)
    : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
}

function getInvestmentDisplayName(investmentId) {
  const found = INVESTMENTS.find((investment) => investment.id === investmentId);
  return found?.title || investmentId;
}

function getTopPurchasedInvestments(limit = 3) {
  const era1 = getRunStatsEra1();
  const entries = Object.entries(era1.investments?.purchasedById || {})
    .map(([id, count]) => ({ id, count: Math.max(0, Number(count) || 0) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.id.localeCompare(b.id);
    });
  return entries.slice(0, limit);
}

// --- Tree Growth ---
function growTrees(dt) {
  const baseGrowth = TUNING.grove.treeGrowthPerSec;
  const growth = (baseGrowth + getCultivatorBonusPerSecond()) * dt;
  const currentCapacity = TUNING.grove.treeCapacity + getGroveExpansionBonus();
  state.treeOlives = Math.min(state.treeOlives + growth, currentCapacity);
}

// --- Inventory Helpers (Fractional Internal, Integer Display/Shipping) ---
/**
 * Get display count for inventory (always integer).
 * @param {number} actualValue - The actual float inventory value
 * @returns {number} Integer count for display
 */
function getDisplayCount(actualValue) {
  return Math.floor(actualValue);
}

/**
 * Get maximum shippable/consumable count (always integer).
 * @param {number} actualValue - The actual float inventory value
 * @returns {number} Integer count available for shipping/consumption
 */
function getShippableCount(actualValue) {
  return Math.floor(actualValue);
}

/**
 * Check if we can consume a given integer amount.
 * @param {number} actualValue - The actual float inventory value
 * @param {number} intAmount - Integer amount to consume
 * @returns {boolean} True if floor(actualValue) >= intAmount
 */
function canConsume(actualValue, intAmount) {
  return getShippableCount(actualValue) >= intAmount;
}

/**
 * Consume an integer amount from float inventory.
 * Subtracts exactly intAmount from actualValue and guards against float precision issues.
 * @param {number} actualValue - The actual float inventory value
 * @param {number} intAmount - Integer amount to consume
 * @returns {number} New inventory value (clamped to 0 if within epsilon)
 */
function consumeInventory(actualValue, intAmount) {
  const newValue = actualValue - intAmount;
  // Guard against float precision creating tiny negatives
  const EPSILON = 1e-9;
  return newValue < EPSILON ? 0 : newValue;
}

function getRenownTierState() {
  const renownValue = Number.isFinite(Number(state.renownValue)) ? Number(state.renownValue) : 0;
  if (!renownTierConfig.length) {
    return {
      renownValue,
      tierId: null,
      tierName: "Unranked",
      demandBonus: 0,
      progressPct: 0,
      progressText: "0 / 0",
    };
  }

  let activeTier = renownTierConfig.find((tier) => {
    if (renownValue < tier.minRenown) return false;
    if (tier.maxRenown == null || !Number.isFinite(tier.maxRenown)) return true;
    return renownValue <= tier.maxRenown;
  });

  if (!activeTier) {
    activeTier = renownValue < renownTierConfig[0].minRenown
      ? renownTierConfig[0]
      : renownTierConfig[renownTierConfig.length - 1];
  }

  const lastTier = renownTierConfig[renownTierConfig.length - 1];
  const atEndOfLastTier = Number.isFinite(lastTier.maxRenown) && renownValue >= lastTier.maxRenown;
  if (state.renownCapped || atEndOfLastTier) {
    return {
      renownValue,
      tierId: activeTier.id,
      tierName: "Countryside Limit",
      demandBonus: Number(activeTier.demandBonus) || 0,
      progressPct: 100,
      progressText: "MAX",
    };
  }

  const min = activeTier.minRenown;
  const max = Number.isFinite(activeTier.maxRenown) ? activeTier.maxRenown : null;
  if (max == null || max <= min) {
    return {
      renownValue,
      tierId: activeTier.id,
      tierName: activeTier.name,
      demandBonus: Number(activeTier.demandBonus) || 0,
      progressPct: 100,
      progressText: "MAX",
    };
  }

  const clamped = Math.min(Math.max(renownValue, min), max);
  const range = max - min;
  const inTier = clamped - min;
  const progressPct = range > 0 ? (inTier / range) * 100 : 0;

  return {
    renownValue,
    tierId: activeTier.id,
    tierName: activeTier.name,
    demandBonus: Number(activeTier.demandBonus) || 0,
    progressPct,
    progressText: `${Math.floor(inTier)} / ${Math.floor(range)}`,
  };
}

function getRenownCapMax() {
  if (!renownTierConfig.length) return null;
  const lastTier = renownTierConfig[renownTierConfig.length - 1];
  return Number.isFinite(lastTier.maxRenown) ? Number(lastTier.maxRenown) : null;
}

function logRenownCapReached(capValue) {
  const text = `Renown capped at ${capValue} (Countryside Limit).`;
  if (marketLogDebugEl || farmLogDebugEl) {
    logDebug({ channel: marketLogDebugEl ? "market" : "farm", text });
    return;
  }
  console.debug(text);
}

function openInvitationModal() {
  if (!invitationModal) return;
  invitationModal.classList.add("active");
  invitationModal.setAttribute("aria-hidden", "false");
}

function closeInvitationModal() {
  if (!invitationModal) return;
  invitationModal.classList.remove("active");
  invitationModal.setAttribute("aria-hidden", "true");
}

function acknowledgeInvitationModal() {
  if (state.cityInvitationAcknowledged) {
    closeInvitationModal();
    return;
  }
  state.cityInvitationAcknowledged = true;
  saveGame();
  closeInvitationModal();
}

function maybeShowInvitationModal() {
  if (!state.renownCapped) return;
  if (state.cityInvitationAcknowledged) return;
  openInvitationModal();
}

function setRenownCapped(capValue) {
  const wasCapped = !!state.renownCapped;
  state.renownValue = capValue;
  state.renownCapped = true;
  if (!wasCapped) {
    logRenownCapReached(capValue);
    maybeShowInvitationModal();
  }
}

function applyRenownGainFromSale(unitsSold) {
  if (unitsSold <= 0) return 0;
  const renownPerUnitSold = Number(TUNING.renown?.perUnitSold);
  if (!Number.isFinite(renownPerUnitSold) || renownPerUnitSold <= 0) return 0;
  return applyRenownGain(unitsSold * renownPerUnitSold);
}

function applyRenownGain(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const capMax = getRenownCapMax();
  const currentRenown = Number(state.renownValue) || 0;
  if (state.renownCapped) return 0;

  if (capMax != null && currentRenown >= capMax) {
    if (!state.renownCapped) {
      setRenownCapped(capMax);
    }
    return 0;
  }

  const allowed = capMax == null ? amount : Math.min(amount, Math.max(0, capMax - currentRenown));
  if (allowed <= 0) {
    if (capMax != null && !state.renownCapped) {
      setRenownCapped(capMax);
    }
    return 0;
  }

  state.renownLifetime = (Number(state.renownLifetime) || 0) + allowed;
  state.renownValue = currentRenown + allowed;

  if (capMax != null && state.renownValue >= capMax) {
    setRenownCapped(capMax);
  }
  return allowed;
}

function updateRenownUI() {
  if (!renownValueEl || !renownTierNameEl || !renownProgressFillEl || !renownProgressTextEl) return;
  const renownState = getRenownTierState();
  renownValueEl.textContent = String(Math.floor(renownState.renownValue));
  renownTierNameEl.textContent = renownState.tierName;
  renownProgressFillEl.style.width = `${renownState.progressPct.toFixed(2)}%`;
  renownProgressTextEl.textContent = renownState.progressText;
}

function hasRelocationLifetimeRequirement() {
  return (Number(state.florinsLifetimeEarned) || 0) >= TUNING.relocation.lifetimeFlorinsRequired;
}

function hasRelocationPaymentRequirement() {
  return (Number(state.florinCount) || 0) >= TUNING.relocation.florinCost;
}

function setRequirementIcon(el, isMet) {
  if (!el) return;
  el.textContent = isMet ? "✓" : "✗";
  el.classList.toggle("is-met", isMet);
}

function updateRelocationUI() {
  const lifetimeMet = hasRelocationLifetimeRequirement();
  const paymentMet = hasRelocationPaymentRequirement();
  const lifetimeEarned = Math.max(0, Math.floor(Number(state.florinsLifetimeEarned) || 0));
  const renownMet = !!state.renownCapped;
  setRequirementIcon(relocationReqLifetimeIcon, lifetimeMet);
  setRequirementIcon(relocationReqRenownIcon, renownMet);
  setRequirementIcon(relocationReqCurrentIcon, paymentMet);
  if (relocationReqLifetimeText) {
    const req = TUNING.relocation.lifetimeFlorinsRequired;
    relocationReqLifetimeText.textContent = `Earn ${req.toLocaleString()} lifetime Florins ${lifetimeEarned.toLocaleString()}/${req.toLocaleString()}`;
  }
  if (relocationReqRenownText) {
    const currentRenown = Math.floor(Number(state.renownValue) || 0);
    const capMax = getRenownCapMax() || 399;
    relocationReqRenownText.textContent = `Reach maximum Renown (${currentRenown}/${capMax})`;
  }
  if (moveToCityBtn) {
    moveToCityBtn.disabled = !(lifetimeMet && paymentMet && state.renownCapped) || Number(state.era) >= 2;
  }
}

function updateEraVisibility() {
  const inEra2 = Number(state.era) >= 2;
  if (eraOneRoot) {
    eraOneRoot.classList.toggle("is-hidden", inEra2);
  }
  if (eraTwoScreen) {
    eraTwoScreen.classList.toggle("is-hidden", !inEra2);
  }
}

function computeEstateIncomeRate(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return 0;
  const treeCapacity = Number(snapshot.treeCapacity) || 0;
  const olivePressCount = Number(snapshot.olivePressCount) || 0;
  const harvestBasketLevel = Number(snapshot.harvestBasketLevel) || 0;
  const harvestUpgradeCount = Array.isArray(snapshot.harvestUpgrades) ? snapshot.harvestUpgrades.length : 0;

  const ei = TUNING.era2.estateIncome;
  const ratePerSecond =
    (treeCapacity * ei.treeCapacityMultiplier) +
    (olivePressCount * ei.olivePressMultiplier) +
    (harvestBasketLevel * ei.harvestBasketMultiplier) +
    (harvestUpgradeCount * ei.harvestUpgradeMultiplier);

  return Math.max(0, ratePerSecond);
}

function getEstateIncomeRate() {
  return computeEstateIncomeRate(state.estateSnapshot);
}

function updateEra2UI() {
  if (era2FlorinCountEl) {
    era2FlorinCountEl.textContent = state.florinCount.toFixed(2);
  }
  const ratePerMinute = getEstateIncomeRate() * 60;
  if (era2EstateIncomeEl) {
    era2EstateIncomeEl.textContent = `+${ratePerMinute.toFixed(2)} florins/min`;
  }
  if (era2RunOutcomeEstateIncomeEl) {
    era2RunOutcomeEstateIncomeEl.textContent = `+${ratePerMinute.toFixed(2)} florins/min`;
  }

  const era1 = getRunStatsEra1();
  const earned = Number(era1.florins.earnedTotal) || 0;
  const spent = Number(era1.florins.spentTotal) || 0;
  const net = Number(era1.florins.netTotal) || (earned - spent);
  const timeSeconds = getEra1DurationSecondsForSummary();
  const olivesSold = Number(era1.goods.olivesSold) || 0;
  const oliveOilSold = Number(era1.goods.oliveOilSold) || 0;
  const olivesPressed = Number(era1.goods.olivesPressed) || 0;
  const stoneEarned = Number(era1.resources.stoneEarned) || 0;
  const stoneSpent = Number(era1.resources.stoneSpent) || 0;
  const harvestersHired = Number(era1.workers.harvestersHired) || 0;
  const cultivatorsHired = Number(era1.workers.cultivatorsHired) || 0;
  const pressersHired = Number(era1.workers.pressersHired) || 0;
  const investmentsTotal = Number(era1.investments.purchasedCount) || 0;

  if (era2SummaryTimeEl) era2SummaryTimeEl.textContent = formatRunDuration(timeSeconds);
  if (era2SummaryFlorinsEarnedEl) era2SummaryFlorinsEarnedEl.textContent = formatSummaryFlorins(earned);
  if (era2SummaryFlorinsSpentEl) era2SummaryFlorinsSpentEl.textContent = formatSummaryFlorins(spent);
  if (era2SummaryFlorinsNetEl) era2SummaryFlorinsNetEl.textContent = formatSummaryFlorins(net);
  if (era2SummaryOlivesSoldEl) era2SummaryOlivesSoldEl.textContent = formatSummaryCount(olivesSold, 0);
  if (era2SummaryOliveOilSoldEl) era2SummaryOliveOilSoldEl.textContent = formatSummaryCount(oliveOilSold, 0);
  if (era2SummaryOlivesPressedEl) era2SummaryOlivesPressedEl.textContent = formatSummaryCount(olivesPressed, 0);
  if (era2SummaryStoneEarnedEl) era2SummaryStoneEarnedEl.textContent = formatSummaryCount(stoneEarned, 0);
  if (era2SummaryStoneSpentEl) era2SummaryStoneSpentEl.textContent = formatSummaryCount(stoneSpent, 0);
  if (era2SummaryHarvestersHiredEl) era2SummaryHarvestersHiredEl.textContent = formatSummaryCount(harvestersHired, 0);
  if (era2SummaryCultivatorsHiredEl) era2SummaryCultivatorsHiredEl.textContent = formatSummaryCount(cultivatorsHired, 0);
  if (era2SummaryPressersHiredEl) era2SummaryPressersHiredEl.textContent = formatSummaryCount(pressersHired, 0);
  if (era2SummaryInvestmentsTotalEl) era2SummaryInvestmentsTotalEl.textContent = formatSummaryCount(investmentsTotal, 0);
  if (era2SummaryInvestmentsTopEl) {
    const topEntries = getTopPurchasedInvestments(3);
    if (!topEntries.length) {
      era2SummaryInvestmentsTopEl.textContent = "No investments tracked yet.";
    } else {
      era2SummaryInvestmentsTopEl.innerHTML = topEntries
        .map((entry) => `${getInvestmentDisplayName(entry.id)} x${formatSummaryCount(entry.count, 0)}`)
        .join("<br />");
    }
  }
}

function buildEstateSnapshot() {
  const currentTreeCapacity = TUNING.grove.treeCapacity + getGroveExpansionBonus();
  const harvestUpgradeKeys = Object.keys(state.upgrades || {}).filter((key) => (
    key === "selective_picking" ||
    key === "ladders_nets" ||
    key.startsWith("expand_grove_")
  ));

  return {
    capturedAt: new Date().toISOString(),
    treeCapacity: currentTreeCapacity,
    treeOlives: Number(state.treeOlives) || 0,
    olivePressCount: Number(state.olivePressCount) || 0,
    harvestBasketLevel: Number(state.harvestBasketLevel) || 0,
    harvestUpgrades: harvestUpgradeKeys,
  };
}

function moveToCity() {
  if (Number(state.era) >= 2) return;
  const lifetimeMet = hasRelocationLifetimeRequirement();
  const paymentMet = hasRelocationPaymentRequirement();
  if (!lifetimeMet || !paymentMet) return;

  if (!spendFlorins(TUNING.relocation.florinCost)) return;
  finalizeEra1RunStats();
  state.estateSnapshot = buildEstateSnapshot();
  state.era = 2;
  saveGame();

  if (mainLoopInterval) {
    clearInterval(mainLoopInterval);
    mainLoopInterval = null;
  }
  stopMarketLoop();
  startEra2Loop();

  updateEraVisibility();
  updateUI();
}

// --- UI ---
function updateUI() {
  updateEraVisibility();
  updateEra2UI();
  florinCountEl.textContent = state.florinCount.toFixed(2);
  treeOlivesEl.textContent = Math.floor(state.treeOlives);
  const currentTreeCapacity = TUNING.grove.treeCapacity + getGroveExpansionBonus();
  treeCapacityEl.textContent = currentTreeCapacity;
  
  // Display growth rate (olives/sec)
  const growthRate = TUNING.grove.treeGrowthPerSec + getCultivatorBonusPerSecond();
  treeGrowthRateEl.textContent = `(${growthRate.toFixed(2)}/s)`;
  
  // Inventory displays always show integers (floor of actual float values)
  invOlivesQty.textContent = getDisplayCount(state.harvestedOlives);
  invOliveOilQty.textContent = getDisplayCount(state.oliveOilCount || 0);
  marketOliveCountEl.textContent = getDisplayCount(state.marketOlives);
  marketOilCountEl.textContent = getDisplayCount(state.marketOliveOil || 0);
  updateMarketAutosellUI();
  updateRenownUI();
  updateRelocationUI();
  
  // Update ship button state based on inventory (only whole goods can be shipped)
  if (!isShipping) {
    const shippableOlives = getShippableCount(state.harvestedOlives);
    shipOlivesBtn.disabled = shippableOlives === 0;
    const maxShip = Math.min(shippableOlives, getOliveShippingCapacity());
    shipOlivesBtn.textContent = `Ship (up to ${maxShip})`;
  }

  // Update oil ship button state based on inventory (only whole goods can be shipped)
  if (!isShippingOliveOil) {
    const shippableOil = getShippableCount(state.oliveOilCount || 0);
    shipOliveOilBtn.disabled = shippableOil === 0;
    const maxShipOil = Math.min(shippableOil, getOliveOilShippingCapacity());
    shipOliveOilBtn.textContent = `Ship (up to ${maxShipOil})`;
  }

  // Update olive press count display
  olivePressCountEl.textContent = "x" + (state.olivePressCount || 1);

  // Update press button state based on inventory (only whole goods can be pressed)
  const olivesToPress = getOlivesToPress();
  if (!isPressing) {
    pressBtn.disabled = olivesToPress < TUNING.press.olivesPerPress;
    pressBtn.textContent = `Press (${olivesToPress})`;
  }

  // Update press preview (deterministic output per press)
  const oilPerOlive = getTotalOilPerOlive();
  if (pressConsumesEl) {
    pressConsumesEl.textContent = `Consumes: ${olivesToPress} Olives`;
  }
  if (pressProducesEl) {
    pressProducesEl.textContent = `Produces: ${(olivesToPress * oilPerOlive).toFixed(2)} Olive Oil`;
  }

  // Update stone inventory display and quarry button state
  invStoneQty.textContent = getDisplayCount(state.stone);
  if (!isQuarrying) {
    quarryBtn.disabled = false;
  }
  quarryNextEl.textContent = `Next: +${getQuarryOutput()} Stone \u2022 ${parseFloat(getQuarryDurationSeconds().toFixed(2))}s`;

  // Update harvest button state and pill visibility
  if (!isHarvesting) {
    harvestBtn.disabled = false;
    harvestActionUI.setIdle({ resetBar: false });
  }
  harvestNextEl.textContent = `Next: +${Math.floor(getCurrentHarvestBatchSize())} Olives \u2022 ${TUNING.harvest.durationSeconds}s`;

  // Update cultivator UI
  cultivatorCountEl.textContent = `x${state.cultivatorCount}`;
  const cultivatorCost = getCultivatorHireCost();
  hireCultivatorCostEl.textContent = cultivatorCost;
  hireCultivatorBtn.disabled = state.florinCount < cultivatorCost;
  
  const perCultivator = TUNING.workers.cultivator.olivesPerSecondPerCultivator;
  const cultivatorMultiplier = (state.foremanHired && foremanIsActive)
    ? TUNING.managers.foreman.growthMultiplier
    : 1;
  const currentBonus = state.cultivatorCount * perCultivator * cultivatorMultiplier;
  const nextBonus = perCultivator * cultivatorMultiplier;
  
  cultivatorImpactEl.textContent = `+${formatOlivesPerSecond(currentBonus)} olives / s`;
  cultivatorDelta.textContent = `Next: +${formatOlivesPerSecond(nextBonus)} olives / s`;
  
  // Update cultivator badges
  if (foremanIsActive) {
    cultivatorBadgeManager.textContent = "Mgr";
    cultivatorBadgeManager.style.visibility = "visible";
  } else {
    cultivatorBadgeManager.textContent = "";
    cultivatorBadgeManager.style.visibility = "hidden";
  }
  cultivatorBadgeStatus.textContent = "";
  cultivatorBadgeStatus.style.visibility = "hidden";
  cultivatorBadgeExtra.textContent = "";
  cultivatorBadgeExtra.style.visibility = "hidden";

  // Update harvester UI
  harvesterCountEl.textContent = `x${state.harvesterCount}`;
  const harvesterCost = getHarvesterHireCost();
  hireHarvesterCostEl.textContent = harvesterCost;
  hireHarvesterBtn.disabled = state.florinCount < harvesterCost;
  
  // Update harvester stats and preview
  const preview = calculateHarvesterHirePreview();
  
  // Top row: Current stats
  if (state.harvesterCount > 0) {
    const currentBonus = preview.olives.current;
    harvesterImpactEl.textContent = `Harvest +${currentBonus.toFixed(1)} olives`;
  } else {
    harvesterImpactEl.textContent = "—";
  }
  
  // Bottom row: Next hire delta (olives bonus increase)
  const olivesDelta = preview.olives.next - preview.olives.current;
  harvesterDelta.textContent = `Next: +${olivesDelta.toFixed(1)} olives per harvest`;

  
  // Update badges
  // Badge slot 1: Manager coverage
  if (arboristIsActive) {
    harvesterBadgeManager.textContent = "Mgr";
    harvesterBadgeManager.style.visibility = "visible";
  } else {
    harvesterBadgeManager.textContent = "";
    harvesterBadgeManager.style.visibility = "hidden";
  }
  
  // Badge slot 2: Status modifier (for future use - Auto/Idle/etc)
  harvesterBadgeStatus.textContent = "";
  harvesterBadgeStatus.style.visibility = "hidden";
  
  // Badge slot 3: Extra modifier (for future use)
  harvesterBadgeExtra.textContent = "";
  harvesterBadgeExtra.style.visibility = "hidden";

  // Update presser UI
  presserCountEl.textContent = `x${state.presserCount}`;
  const presserCost = getPresserHireCost();
  hirePresserCostEl.textContent = presserCost;
  hirePresserBtn.disabled = state.florinCount < presserCost;
  
  // Update presser stats and preview (conversion bonus)
  const oilBonusPerPresser = TUNING.workers.presser.oilPerOlivePerPresser;
  const presserMult = (state.pressManagerHired && pressManagerIsActive)
    ? TUNING.managers.pressManager.presserMultiplier
    : 1;
  const maxOlivesPerAction = (state.olivePressCount || 1) * TUNING.press.olivesPerPress;
  const currentOilBonus = maxOlivesPerAction * state.presserCount * oilBonusPerPresser * presserMult;
  const nextOilBonus = maxOlivesPerAction * oilBonusPerPresser * presserMult;
  
  // Top row: Current bonus per press
  if (state.presserCount > 0) {
    presserImpactEl.textContent = `+${formatOilPerPress(currentOilBonus)} oil / press`;
  } else {
    presserImpactEl.textContent = "—";
  }
  
  // Bottom row: Next hire delta
  presserDelta.textContent = `Next: +${formatOilPerPress(nextOilBonus)} oil / press`;
  
  // Update presser badges
  // Badge slot 1: Press Manager coverage
  if (pressManagerIsActive) {
    presserBadgeManager.textContent = "Mgr";
    presserBadgeManager.style.visibility = "visible";
  } else {
    presserBadgeManager.textContent = "";
    presserBadgeManager.style.visibility = "hidden";
  }
  
  // Badge slot 2: Status modifier (for future use)
  presserBadgeStatus.textContent = "";
  presserBadgeStatus.style.visibility = "hidden";
  
  // Badge slot 3: Extra modifier (for future use)
  presserBadgeExtra.textContent = "";
  presserBadgeExtra.style.visibility = "hidden";

  // Toggle Managers section
  const anyManagerHired = state.arboristHired || state.foremanHired || state.quarryManagerHired || state.pressManagerHired;
  managersEmptyEl.hidden = anyManagerHired;
  
  if (state.arboristHired) {
    managersArboristWrap.hidden = false;
    // Toggle active/inactive styling on manager name
    if (arboristIsActive) {
      arboristNameEl.classList.add("mgr-name--active");
      arboristNameEl.classList.remove("mgr-name--inactive");
    } else {
      arboristNameEl.classList.add("mgr-name--inactive");
      arboristNameEl.classList.remove("mgr-name--active");
    }
  } else {
    managersArboristWrap.hidden = true;
  }
  
  if (state.foremanHired) {
    managersForemanWrap.hidden = false;
    // Toggle active/inactive styling on manager name
    if (foremanIsActive) {
      foremanNameEl.classList.add("mgr-name--active");
      foremanNameEl.classList.remove("mgr-name--inactive");
    } else {
      foremanNameEl.classList.add("mgr-name--inactive");
      foremanNameEl.classList.remove("mgr-name--active");
    }
  } else {
    managersForemanWrap.hidden = true;
  }
  
  if (state.quarryManagerHired) {
    managersQuarryMgrWrap.hidden = false;
    if (quarryManagerIsActive) {
      quarryManagerNameEl.classList.add("mgr-name--active");
      quarryManagerNameEl.classList.remove("mgr-name--inactive");
    } else {
      quarryManagerNameEl.classList.add("mgr-name--inactive");
      quarryManagerNameEl.classList.remove("mgr-name--active");
    }
  } else {
    managersQuarryMgrWrap.hidden = true;
  }

  if (state.pressManagerHired) {
    managersPressMgrWrap.hidden = false;
    // Toggle active/inactive styling on manager name
    if (pressManagerIsActive) {
      pressManagerNameEl.classList.add("mgr-name--active");
      pressManagerNameEl.classList.remove("mgr-name--inactive");
    } else {
      pressManagerNameEl.classList.add("mgr-name--inactive");
      pressManagerNameEl.classList.remove("mgr-name--active");
    }
  } else {
    managersPressMgrWrap.hidden = true;
  }
  
  // Update total active manager cost
  if (anyManagerHired) {
    let totalCost = 0;
    if (arboristIsActive) {
      totalCost += TUNING.managers.arborist.salaryPerMin;
    }
    if (foremanIsActive) {
      totalCost += TUNING.managers.foreman.salaryPerMin;
    }
    if (quarryManagerIsActive) {
      totalCost += TUNING.managers.quarryManager.salaryPerMin;
    }
    if (pressManagerIsActive) {
      totalCost += TUNING.managers.pressManager.salaryPerMin;
    }
    
    if (totalCost > 0) {
      managersTotalWrap.hidden = false;
      managersTotalCostEl.textContent = "-" + totalCost.toFixed(2) + " fl/min";
    } else {
      managersTotalWrap.hidden = true;
    }
  } else {
    managersTotalWrap.hidden = true;
  }
  
  // Update investment button states (state-aware previews)
  updateInvestmentButtons();
}

// --- Debug: Render Current Harvest Outcome Chances ---
function updateDebugHarvestChances() {
  if (!debugHarvestChancesEl) return;
  
  const chances = getCurrentHarvestOutcomeChances();
  
  // Render as compact rows
  debugHarvestChancesEl.innerHTML = chances.map(outcome => {
    const percent = (outcome.weight * 100).toFixed(1);
    const raw = outcome.weight.toFixed(3);
    return `
      <div class="debug-chance-row">
        <span class="debug-chance-label">${outcome.key}</span>
        <span class="debug-chance-value">
          ${percent}%
          <span class="debug-chance-raw">(${raw})</span>
        </span>
      </div>
    `;
  }).join('');
}

// --- Weighted Random Helper ---
function rollWeighted(outcomesArray) {
  const totalWeight = outcomesArray.reduce((sum, o) => sum + o.weight, 0);
  let roll = Math.random() * totalWeight;
  
  for (const outcome of outcomesArray) {
    roll -= outcome.weight;
    if (roll <= 0) return outcome;
  }
  
  return outcomesArray[outcomesArray.length - 1];
}

// --- Debug Helper: Current Harvest Outcome Chances ---
/**
 * Get the current normalized harvest outcome chances used by the game.
 * This is the single source of truth for probabilities.
 * @returns {Array} Normalized outcomes with weight property representing probabilities (0..1)
 */
function getCurrentHarvestOutcomeChances() {
  return computeHarvestOutcomeChances({
    outcomes: harvestConfig.outcomes,
    harvesterCount: state.harvesterCount,
    arboristIsActive: arboristIsActive,
    upgrades: state.upgrades,
    tuning: TUNING.harvest,
  });
}

// --- Harvest System ---
function getCurrentHarvestBatchSize() {
  const basketBonus = (state.harvestBasketLevel || 0) * TUNING.investments.harvestBaskets.bonusPerLevel;
  return Math.max(0, harvestConfig.batchSize + basketBonus + getHarvesterOlivesBonus());
}

function startHarvest(opts = {}) {
  if (isHarvesting) return;
  if (state.treeOlives < 1) {
    logLine("No olives to harvest");
    return;
  }
  // Determine batch (harvesters increase batch size, use float for logic)
  const attempted = Math.min(state.treeOlives, getCurrentHarvestBatchSize());
  if (attempted < 1) {
    logLine("No olives to harvest");
    return;
  }
  // Floor attempted for outcome calculations and display
  const attemptedInt = Math.floor(attempted);
  if (attemptedInt < 1) {
    logLine("No olives to harvest");
    return;
  }
  // Use normalized chances from single source of truth
  const adjustedOutcomes = getCurrentHarvestOutcomeChances();
  
  // Log the probabilities used for this harvest (debug visibility)
  const chancesLog = adjustedOutcomes
    .map(o => `${o.key}=${o.weight.toFixed(3)}`)
    .join(' ');
  logDebug({ channel: 'farm', text: `Chances at harvest: ${chancesLog}` });
  
  // Select outcome with normalized chances (weights now represent probabilities 0..1)
  const outcome = rollWeighted(adjustedOutcomes);
  
  // Use fixed duration from tuning (outcome duration no longer used)
  const effectiveDurationMs = TUNING.harvest.durationSeconds * 1000;
  
  // Start job
  isHarvesting = true;
  harvestJob = {
    startTimeMs: Date.now(),
    durationMs: effectiveDurationMs,
    attempted: attemptedInt,
    outcome,
  };
  
  // Update UI
  harvestBtn.disabled = true;
  harvestActionUI.start({ count: attemptedInt, percent: 0 });
  harvestAttemptingCount.textContent = attemptedInt;
  // Show harvest pill with attempting count
  harvestPill.classList.remove("inline-fade-out");
  
  if (opts.source === "auto") {
    logLine("Arborist ordered harvest (batch ready).");
  } else {
    logLine(`Starting harvest (H: ${state.harvesterCount}): attempting ${attemptedInt} olives`);
  }
}

function completeHarvest() {
  const { attempted, outcome, durationMs } = harvestJob;
  
  // Calculate base results from outcome
  const baseCollected = attempted * outcome.collectedPct;
  const lost = Math.floor(attempted * outcome.lostPct);
  const remaining = attempted - Math.floor(baseCollected) - lost;
  
  // No separate harvester bonus: batch size already includes harvester effect
  const totalCollected = baseCollected;
  
  // Apply changes
  state.treeOlives -= (Math.floor(baseCollected) + lost);
  state.harvestedOlives += totalCollected;
  
  // Log outcome
  const outcomeLabel = outcome.key.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());
  const durationSec = (durationMs / 1000).toFixed(2);
  
  // Determine color based on outcome
  let logColor = null;
  if (outcome.key === 'poor') logColor = 'red';
  else if (outcome.key === 'efficient') logColor = 'green';
  else if (outcome.key.startsWith('interrupted')) logColor = 'orange';
  
  // Format collection message (no harvester bonus shown)
  let collectedMsg = totalCollected.toFixed(1);
  
  if (remaining > 0) {
    logLine(`Harvest (${outcomeLabel}, ${durationSec}s): attempted ${attempted}, collected ${collectedMsg}, lost ${lost} (${remaining} left on trees)`, logColor);
  } else {
    logLine(`Harvest (${outcomeLabel}, ${durationSec}s): attempted ${attempted}, collected ${collectedMsg}, lost ${lost}`, logColor);
  }
  
  // Reset state
  isHarvesting = false;
  
  // Use helper to fade out pill and progress without layout shift
  harvestActionUI.end();
  
  // Re-enable harvest button after fade
  setTimeout(() => {
    harvestBtn.disabled = false;
  }, 160);
  
  saveGame();
  updateUI();
}

function updateHarvestProgress() {
  if (!isHarvesting) return;
  
  const now = Date.now();
  const elapsed = now - harvestJob.startTimeMs;
  const progress = Math.min(1, elapsed / harvestJob.durationMs);
  const remaining = Math.max(0, (harvestJob.durationMs - elapsed) / 1000);
  
  harvestActionUI.update({
    percent: progress * 100,
    countdownText: remaining.toFixed(2) + "s"
  });
  
  if (elapsed >= harvestJob.durationMs) {
    completeHarvest();
  }
}

// --- Shipping System ---
function setShipUIIdle() {
  shipActionUI.setIdle();
  const shippableOlives = getShippableCount(state.harvestedOlives);
  shipOlivesBtn.disabled = shippableOlives === 0 || isShipping;
}

function setShipUIActive(percent, countdownText) {
  shipActionUI.update({ percent, countdownText });
  shipOlivesBtn.disabled = true;
}

function setShipUIComplete() {
  // Reset after very brief delay (don't set to 100% to avoid flicker)
  setTimeout(() => {
    shipActionUI.end();
  }, 60);
}

function startShipping() {
  if (isShipping) return;
  
  // Only whole goods can be shipped
  const shippableOlives = getShippableCount(state.harvestedOlives);
  if (shippableOlives < 1) {
    logLine("No harvested olives to ship");
    return;
  }
  
  // Determine amount to ship (integer only, up to capacity)
  const amount = Math.min(shippableOlives, getOliveShippingCapacity());
  
  // Deduct integer amount from float inventory (preserves remainder)
  state.harvestedOlives = consumeInventory(state.harvestedOlives, amount);
  
  // Roll time outcome and incident outcome
  const timeOutcome = rollWeighted(TUNING.market.shipping.sharedTimeOutcomes);
  const incidentOutcome = rollWeighted(TUNING.market.shipping.sharedIncidentOutcomes);
  
  // Calculate losses
  let lostCount = Math.floor(amount * incidentOutcome.lostPct);
  let stolenCount = Math.floor(amount * incidentOutcome.stolenPct);
  
  // Ensure total losses don't exceed amount
  if (lostCount + stolenCount > amount) {
    const total = lostCount + stolenCount;
    lostCount = Math.floor(amount * (lostCount / total));
    stolenCount = amount - lostCount;
  }
  
  // Set up ship job
  shipJob = {
    startTimeMs: Date.now(),
    durationMs: timeOutcome.durationMs,
    amount,
    timeOutcomeKey: timeOutcome.key,
    incidentKey: incidentOutcome.key,
    lostCount,
    stolenCount,
  };
  
  isShipping = true;
  
  // Update inline UI
  shipActionUI.start({ count: amount, percent: 0 });
  shipOlivesBtn.disabled = true;
  
  logLine(`Loaded ${amount} olives onto cart for market`);
  saveGame();
  updateUI();
}

function completeShipping() {
  // Calculate how many arrive
  const arrived = shipJob.amount - shipJob.lostCount - shipJob.stolenCount;
  
  // Add to market inventory
  state.marketOlives += arrived;
  
  // Log to market log
  const timeKey = shipJob.timeOutcomeKey.toUpperCase();
  const incidentKey = shipJob.incidentKey.toUpperCase();
  marketLogLine(
    `Shipment arrived (${timeKey}, ${incidentKey}): sent ${shipJob.amount}, arrived ${arrived}, lost ${shipJob.lostCount}, stolen ${shipJob.stolenCount}.`
  );
  
  // Reset shipping state
  isShipping = false;
  
  // Update UI based on outcome
  setShipUIComplete();
  
  saveGame();
  updateUI();
}

function updateShipProgress() {
  if (!isShipping) return;
  
  const now = Date.now();
  const elapsed = now - shipJob.startTimeMs;
  const progress = Math.min(1, elapsed / shipJob.durationMs);
  const remaining = Math.max(0, (shipJob.durationMs - elapsed) / 1000);
  
  // Update progress bar and countdown
  const progressPct = Math.floor(progress * 100);
  setShipUIActive(progressPct, remaining.toFixed(2) + "s");
  
  if (elapsed >= shipJob.durationMs) {
    completeShipping();
  }
}

// --- Olive Press ---
function startPressing() {
  if (isPressing) return;

  const olivesToPress = getOlivesToPress();

  if (olivesToPress < TUNING.press.olivesPerPress) {
    logLine("Not enough olives to press");
    return;
  }
  const oilPerOlive = getTotalOilPerOlive();
  
  // Deduct integer amount from float inventory (preserves remainder)
  state.harvestedOlives = consumeInventory(state.harvestedOlives, olivesToPress);
  addOlivesPressed(olivesToPress);
  
  // Set up press job
  pressJob = {
    startTimeMs: Date.now(),
    durationMs: TUNING.production.olivePress.baseDurationMs,
    olivesConsumed: olivesToPress,
    oilPerOlive: oilPerOlive,
  };
  
  isPressing = true;
  
  // Update inline UI
  pressActionUI.start({ count: olivesToPress, percent: 0 });
  pressBtn.disabled = true;
  
  saveGame();
  updateUI();
}

function completePressing() {
  const producedOil = pressJob.olivesConsumed * pressJob.oilPerOlive;
  state.oliveOilCount += producedOil;
  
  isPressing = false;
  pressActionUI.end();
  
  const playerText = `Pressed ${pressJob.olivesConsumed} olives → +${producedOil.toFixed(2)} olive oil`;
  const debugText = `Pressed ${pressJob.olivesConsumed} olives: oilPerOlive=${pressJob.oilPerOlive.toFixed(4)}, produced=${producedOil.toFixed(4)}`;
  
  // Log to both tabs
  logEvent({
    channel: 'farm',
    playerText: playerText,
    debugText: debugText,
  });
  
  saveGame();
  updateUI();
}

function updatePressProgress() {
  if (!isPressing) return;
  
  const now = Date.now();
  const elapsed = now - pressJob.startTimeMs;
  const progress = Math.min(1, elapsed / pressJob.durationMs);
  const remaining = Math.max(0, (pressJob.durationMs - elapsed) / 1000);
  
  // Update progress bar and countdown
  const progressPct = Math.floor(progress * 100);
  pressActionUI.update({ percent: progressPct, countdownText: remaining.toFixed(2) + "s" });
  
  if (elapsed >= pressJob.durationMs) {
    completePressing();
  }
}

// --- Olive Oil Shipping System ---
function startShippingOliveOil() {
  if (isShippingOliveOil) return;
  
  // Only whole goods can be shipped
  const shippableOil = getShippableCount(state.oliveOilCount || 0);
  if (shippableOil < 1) {
    logLine("No olive oil to ship");
    return;
  }
  
  // Determine amount to ship (integer only, up to capacity)
  const amount = Math.min(shippableOil, getOliveOilShippingCapacity());
  
  // Deduct integer amount from float inventory (preserves remainder)
  state.oliveOilCount = consumeInventory(state.oliveOilCount || 0, amount);
  
  // Roll time outcome and incident outcome
  const timeOutcome = rollWeighted(TUNING.market.shipping.sharedTimeOutcomes);
  const incidentOutcome = rollWeighted(TUNING.market.shipping.sharedIncidentOutcomes);
  
  // Calculate losses
  let lostCount = Math.floor(amount * incidentOutcome.lostPct);
  let stolenCount = Math.floor(amount * incidentOutcome.stolenPct);
  
  // Ensure total losses don't exceed amount
  if (lostCount + stolenCount > amount) {
    const total = lostCount + stolenCount;
    lostCount = Math.floor(amount * (lostCount / total));
    stolenCount = amount - lostCount;
  }
  
  // Set up olive oil ship job
  oliveOilShipJob = {
    startTimeMs: Date.now(),
    durationMs: timeOutcome.durationMs,
    amount,
    timeOutcomeKey: timeOutcome.key,
    incidentKey: incidentOutcome.key,
    lostCount,
    stolenCount,
  };
  
  isShippingOliveOil = true;
  
  // Update inline UI
  oliveOilShipActionUI.start({ count: amount, percent: 0 });
  shipOliveOilBtn.disabled = true;
  
  logLine(`Loaded ${amount} olive oil onto cart for market`);
  saveGame();
  updateUI();
}

function completeShippingOliveOil() {
  // Calculate how many arrive
  const arrived = oliveOilShipJob.amount - oliveOilShipJob.lostCount - oliveOilShipJob.stolenCount;
  
  // Add to market oil inventory
  state.marketOliveOil = (state.marketOliveOil || 0) + arrived;
  
  // Log to market log
  const timeKey = oliveOilShipJob.timeOutcomeKey.toUpperCase();
  const incidentKey = oliveOilShipJob.incidentKey.toUpperCase();
  marketLogLine(
    `Olive oil shipment arrived (${timeKey}, ${incidentKey}): sent ${oliveOilShipJob.amount}, arrived ${arrived}, lost ${oliveOilShipJob.lostCount}, stolen ${oliveOilShipJob.stolenCount}.`
  );
  
  // Reset shipping state
  isShippingOliveOil = false;
  
  // Update UI
  oliveOilShipActionUI.end();
  
  saveGame();
  updateUI();
}

function updateOliveOilShipProgress() {
  if (!isShippingOliveOil) return;
  
  const now = Date.now();
  const elapsed = now - oliveOilShipJob.startTimeMs;
  const progress = Math.min(1, elapsed / oliveOilShipJob.durationMs);
  const remaining = Math.max(0, (oliveOilShipJob.durationMs - elapsed) / 1000);
  
  // Update progress bar and countdown
  const progressPct = Math.floor(progress * 100);
  oliveOilShipActionUI.update({ percent: progressPct, countdownText: remaining.toFixed(2) + "s" });
  
  if (elapsed >= oliveOilShipJob.durationMs) {
    completeShippingOliveOil();
  }
}

// --- Quarry System ---
function startQuarry() {
  if (isQuarrying) return;

  const durationMs = getQuarryDurationSeconds() * 1000;

  isQuarrying = true;
  quarryJob = {
    startTimeMs: Date.now(),
    durationMs,
  };

  quarryBtn.disabled = true;
  quarryActionUI.start({ count: getQuarryOutput(), percent: 0 });

  logLine("Quarrying stone...");
}

function completeQuarry() {
  const output = getQuarryOutput();
  state.stone += output;
  addStoneEarned(output);
  // Clamp tiny floating negatives
  if (state.stone < 0) state.stone = 0;

  isQuarrying = false;
  quarryActionUI.end();

  const playerText = `Quarried stone → +${output} Stone`;
  const debugText = `Quarried stone: output=${output}, totalStone=${state.stone.toFixed(4)}`;

  logEvent({
    channel: 'farm',
    playerText,
    debugText,
  });

  saveGame();
  updateUI();
}

function updateQuarryProgress() {
  if (!isQuarrying) return;

  const now = Date.now();
  const elapsed = now - quarryJob.startTimeMs;
  const progress = Math.min(1, elapsed / quarryJob.durationMs);
  const remaining = Math.max(0, (quarryJob.durationMs - elapsed) / 1000);

  const progressPct = Math.floor(progress * 100);
  quarryActionUI.update({ percent: progressPct, countdownText: remaining.toFixed(2) + "s" });

  if (elapsed >= quarryJob.durationMs) {
    completeQuarry();
  }
}

// --- Market System ---
function formatRatePerSecond(value) {
  return value.toFixed(2);
}

function formatFlorins(value) {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatPercent(value) {
  const abs = Math.abs(value);
  const rounded = Math.abs(abs - Math.round(abs)) < 0.01 ? abs.toFixed(0) : abs.toFixed(1);
  const normalized = rounded.replace(/\.0$/, "");
  return value < 0 ? `-${normalized}` : normalized;
}

function getMarketAutosellRateUpgrades() {
  const count = Number(state.marketAutosellRateUpgrades) || 0;
  return Math.min(Math.max(0, count), TUNING.market.autosell.maxRateUpgrades);
}

function getMarketLanesPurchased() {
  const count = Number(state.marketLanesPurchased) || 0;
  return Math.min(Math.max(0, count), TUNING.market.lanes.maxAdditionalLanes);
}

function getMarketAutosellLanes() {
  return TUNING.market.lanes.baseLanes + getMarketLanesPurchased();
}

function getMarketPriceUpgrades() {
  const count = Number(state.marketPriceUpgrades) || 0;
  return Math.min(Math.max(0, count), TUNING.market.price.maxUpgrades);
}

function getMarketPermanentPriceMultiplier() {
  const base = TUNING.market.price.baseMultiplier;
  const upgrade = TUNING.market.price.upgradeMultiplier;
  return base + (getMarketPriceUpgrades() * upgrade);
}

function getMarketEffectivePriceMultiplier(eventMultiplier = 1) {
  return getMarketPermanentPriceMultiplier() * (eventMultiplier ?? 1);
}

function getCityDemandRatePerSecond(modifiers = getActiveMarketModifiers()) {
  const cityBaseRate = Number(TUNING.city?.baseDemandRate) || 0;
  const renownDemandBonus = Number(getRenownTierState().demandBonus) || 0;
  const upgradeRate = TUNING.market.autosell.rateUpgradeAmount * getMarketAutosellRateUpgrades();
  const lanes = getMarketAutosellLanes();
  const eventMult = modifiers?.autosellRateMultiplier ?? 1;
  const baseDemandRate = Math.max(0, cityBaseRate + renownDemandBonus + upgradeRate);
  return Math.max(0, baseDemandRate * lanes * eventMult);
}

function getMarketInventoryCounts() {
  const olives = getShippableCount(state.marketOlives);
  const oil = getShippableCount(state.marketOliveOil || 0);
  return { olives, oil, total: olives + oil };
}

function splitMarketSaleUnits(totalUnits, olivesAvailable, oilAvailable) {
  if (totalUnits <= 0) return { olives: 0, oil: 0 };
  if (olivesAvailable <= 0) return { olives: 0, oil: Math.min(oilAvailable, totalUnits) };
  if (oilAvailable <= 0) return { olives: Math.min(olivesAvailable, totalUnits), oil: 0 };

  const totalAvailable = olivesAvailable + oilAvailable;
  let oilUnits = Math.floor((totalUnits * oilAvailable) / totalAvailable);
  let oliveUnits = totalUnits - oilUnits;

  if (oliveUnits > olivesAvailable) {
    oliveUnits = olivesAvailable;
    oilUnits = Math.min(oilAvailable, totalUnits - oliveUnits);
  }
  if (oilUnits > oilAvailable) {
    oilUnits = oilAvailable;
    oliveUnits = Math.min(olivesAvailable, totalUnits - oilUnits);
  }

  return { olives: oliveUnits, oil: oilUnits };
}

function applyMarketSale({ olives, oil }, priceMultiplier = 1) {
  let earned = 0;
  const unitsSold = Math.max(0, olives) + Math.max(0, oil);

  if (olives > 0) {
    state.marketOlives = consumeInventory(state.marketOlives, olives);
    earned += olives * TUNING.market.prices.olivesFlorins;
  }

  if (oil > 0) {
    state.marketOliveOil = consumeInventory(state.marketOliveOil || 0, oil);
    earned += oil * TUNING.market.prices.oliveOilFlorins;
  }

  earned *= getMarketEffectivePriceMultiplier(priceMultiplier);
  if (earned > 0) {
    addFlorins(earned, { trackLifetime: true });
  }
  addOlivesSold(Math.max(0, olives));
  addOliveOilSold(Math.max(0, oil));
  applyRenownGainFromSale(unitsSold);

  return earned;
}

function randomIntInRange(min, max) {
  const lower = Math.floor(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  return lower + Math.floor(Math.random() * (upper - lower + 1));
}

function getCityEventPoolForCurrentTier() {
  const tierId = getRenownTierState().tierId;
  const poolsByTier = TUNING.city?.eventsByTier || {};
  const pool = poolsByTier[tierId];
  if (!Array.isArray(pool)) return [];
  return pool
    .map((entry) => ({ id: entry?.id, weight: Number(entry?.weight) || 0 }))
    .filter((entry) => typeof entry.id === "string" && entry.weight > 0);
}

function getCityEventDefinition(eventId) {
  return TUNING.city?.events?.[eventId] || null;
}

function getActiveMarketModifiers() {
  const demandMultiplier = activeCityModifiers
    .filter((modifier) => modifier?.type === "demandMultiplier")
    .reduce((acc, modifier) => acc * (Number(modifier.value) || 1), 1);

  return {
    autosellPaused: false,
    autosellRateMultiplier: demandMultiplier > 0 ? demandMultiplier : 1,
    priceMultiplier: 1,
    uiStatus: null,
    uiSuffix: null,
  };
}

function createCityEventSaleLog(eventName, soldOil, earned, requested) {
  const playerText = `${eventName}: bought ${soldOil} oil for ${formatFlorins(earned)} florins.`;
  const debugText = `${eventName}: requested=${requested}, soldOil=${soldOil}, earned=${earned.toFixed(2)} fl`;
  return { playerText, debugText };
}

function runCityInstantSaleEvent(eventDef) {
  const minOil = Math.max(0, Number(eventDef.minOil) || 0);
  const maxOil = Math.max(minOil, Number(eventDef.maxOil) || minOil);
  const requested = randomIntInRange(minOil, maxOil);

  const availableOil = getShippableCount(state.marketOliveOil || 0);
  const soldOil = Math.min(availableOil, requested);
  if (soldOil <= 0) {
    logEvent({
      channel: "market",
      playerText: `${eventDef.name}: no olive oil available to purchase.`,
      debugText: `${eventDef.name}: requested=${requested}, availableOil=${availableOil}, soldOil=0`,
    });
    return;
  }

  const earned = applyMarketSale({ olives: 0, oil: soldOil }, 1);
  const renownBonus = Math.max(0, Number(eventDef.renownBonus) || 0);
  const renownApplied = applyRenownGain(renownBonus);
  const saleLog = createCityEventSaleLog(eventDef.name, soldOil, earned, requested);
  logEvent({
    channel: "market",
    playerText: saleLog.playerText,
    debugText: `${saleLog.debugText}, renownBonus=${renownBonus.toFixed(2)}, renownApplied=${renownApplied.toFixed(2)}`,
  });
}

function addCityTimedDemandModifier(eventDef) {
  const demandMultiplier = Number(eventDef.demandMultiplier) || 1;
  const durationSeconds = Math.max(0, Number(eventDef.durationSeconds) || 0);
  if (durationSeconds <= 0 || demandMultiplier <= 0 || demandMultiplier === 1) {
    return;
  }

  activeCityModifiers.push({
    eventId: eventDef.id,
    eventName: eventDef.name,
    type: "demandMultiplier",
    value: demandMultiplier,
    remainingSeconds: durationSeconds,
    durationSeconds,
  });

  const pct = ((demandMultiplier - 1) * 100);
  const sign = pct >= 0 ? "+" : "";
  logEvent({
    channel: "market",
    playerText: `${eventDef.name}: city demand ${pct >= 0 ? "increased" : "decreased"} for ${durationSeconds}s.`,
    debugText: `${eventDef.name}: demandMultiplier=${demandMultiplier.toFixed(2)} (${sign}${formatPercent(pct)}%), duration=${durationSeconds}s`,
  });
}

function tickCityModifiers(dt) {
  for (let i = activeCityModifiers.length - 1; i >= 0; i -= 1) {
    const modifier = activeCityModifiers[i];
    modifier.remainingSeconds -= dt;
    if (modifier.remainingSeconds > 0) continue;

    activeCityModifiers.splice(i, 1);
    logEvent({
      channel: "market",
      playerText: `${modifier.eventName} ended.`,
      debugText: `${modifier.eventName} ended: duration=${modifier.durationSeconds}s, type=${modifier.type}, value=${Number(modifier.value).toFixed(2)}`,
    });
  }
}

function runCityEvent(eventDef) {
  if (!eventDef || typeof eventDef !== "object") return;
  if (eventDef.type === "instantSale") {
    runCityInstantSaleEvent(eventDef);
    return;
  }
  if (eventDef.type === "timedDemandModifier") {
    addCityTimedDemandModifier(eventDef);
  }
}

function tryTriggerCityEvent(dt) {
  const chancePerSecond = Math.max(0, Number(TUNING.city?.eventChancePerSecond) || 0);
  if (chancePerSecond <= 0) return;

  const triggerChance = 1 - Math.exp(-chancePerSecond * dt);
  if (Math.random() >= triggerChance) return;

  const pool = getCityEventPoolForCurrentTier();
  if (!pool.length) return;

  const selected = rollWeighted(pool);
  const eventDef = getCityEventDefinition(selected.id);
  if (!eventDef) return;

  runCityEvent(eventDef);
}

function updateMarketAutosellUI() {
  if (!marketAutosellEl) return;

  const modifiers = getActiveMarketModifiers();
  const lanes = getMarketAutosellLanes();
  const laneLabel = lanes === 1 ? "lane" : "lanes";

  if (modifiers.autosellPaused) {
    marketAutosellEl.textContent = `Auto-selling: Paused (${lanes} ${laneLabel})`;
    marketAutosellEl.classList.add("is-paused");
    return;
  }

  const effectiveRate = getCityDemandRatePerSecond(modifiers);

  const priceBonuses = [];
  const permanentBonusPct = (getMarketPermanentPriceMultiplier() - 1) * 100;
  if (Math.abs(permanentBonusPct) > 0.01) {
    const sign = permanentBonusPct >= 0 ? "+" : "";
    priceBonuses.push(`${sign}${formatPercent(permanentBonusPct)}%`);
  }
  const eventBonusPct = ((modifiers.priceMultiplier ?? 1) - 1) * 100;
  if (Math.abs(eventBonusPct) > 0.01) {
    const sign = eventBonusPct >= 0 ? "+" : "";
    priceBonuses.push(`${sign}${formatPercent(eventBonusPct)}%`);
  }

  let text = `Auto-selling: ${formatRatePerSecond(effectiveRate)} / s (${lanes} ${laneLabel}`;
  if (priceBonuses.length > 0) {
    text += `, ${priceBonuses.join(" ")}`;
  }
  text += `)`;

  marketAutosellEl.textContent = text;
  marketAutosellEl.classList.remove("is-paused");
}

function runAutosellTick(dt) {
  const modifiers = getActiveMarketModifiers();
  if (modifiers.autosellPaused) return;

  const effectiveRate = getCityDemandRatePerSecond(modifiers);
  if (effectiveRate <= 0) return;

  const { olives, oil, total } = getMarketInventoryCounts();
  if (total <= 0) {
    autosellProgress = 0;
    return;
  }

  autosellProgress += effectiveRate * dt;
  const unitsToSell = Math.min(total, Math.floor(autosellProgress));
  if (unitsToSell <= 0) return;

  // Randomly allocate each unit to an available good
  let olivesRemaining = olives;
  let oilRemaining = oil;
  const allocation = { olives: 0, oil: 0 };
  for (let i = 0; i < unitsToSell; i++) {
    const available = [];
    if (olivesRemaining > 0) available.push("olives");
    if (oilRemaining > 0) available.push("oil");
    if (available.length === 0) break;
    const pick = available[Math.floor(Math.random() * available.length)];
    if (pick === "olives") { allocation.olives++; olivesRemaining--; }
    else { allocation.oil++; oilRemaining--; }
  }

  const earned = applyMarketSale(allocation, modifiers.priceMultiplier);
  autosellProgress -= unitsToSell;

  // Log auto-sell details
  const priceMult = getMarketEffectivePriceMultiplier(modifiers.priceMultiplier);
  const parts = [];
  if (allocation.olives > 0) {
    const unitPrice = TUNING.market.prices.olivesFlorins * priceMult;
    parts.push(`${allocation.olives} olives @ ${unitPrice.toFixed(2)} fl`);
  }
  if (allocation.oil > 0) {
    const unitPrice = TUNING.market.prices.oliveOilFlorins * priceMult;
    parts.push(`${allocation.oil} oil @ ${unitPrice.toFixed(2)} fl`);
  }
  const playerText = `Sold ${parts.join(", ")} = ${earned.toFixed(2)} fl`;
  const debugText = `Auto-sell: ${parts.join(", ")} | total ${earned.toFixed(2)} fl | priceMult ×${priceMult.toFixed(2)}`;
  logEvent({ channel: "market", playerText, debugText });

  saveGame();
}

function startMarketLoop() {
  if (Number(state.era) >= 2) return;
  if (marketLoopInterval) return;

  marketLoopLastMs = Date.now();
  marketLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = (now - marketLoopLastMs) / 1000;
    marketLoopLastMs = now;
    tickCityModifiers(dt);
    tryTriggerCityEvent(dt);
    runAutosellTick(dt);
  }, MARKET_LOOP_MS);
}

function stopMarketLoop() {
  if (!marketLoopInterval) return;
  clearInterval(marketLoopInterval);
  marketLoopInterval = null;
}

// --- Investment System ---
function buyInvestment(id) {
  const investment = INVESTMENTS.find(i => i.id === id);
  if (!investment) return false;
  const florinsBefore = Number(state.florinCount) || 0;
  const stoneBefore = Number(state.stone) || 0;
  const success = investment.purchase(state, TUNING);
  if (success) {
    const florinsAfter = Number(state.florinCount) || 0;
    const spent = Math.max(0, florinsBefore - florinsAfter);
    if (spent > 0) {
      addFlorinsSpent(spent);
    }
    const stoneAfter = Number(state.stone) || 0;
    const stoneSpent = Math.max(0, stoneBefore - stoneAfter);
    if (stoneSpent > 0) {
      addStoneSpent(stoneSpent);
    }
    addInvestmentPurchased(investment.id);
    saveGame();
    updateUI();
    logLine(`Purchased: ${investment.title}`);
    if (investment.id === "market_trade_deals") {
      const bonusPct = TUNING.market.price.upgradeMultiplier * 100;
      marketLogLine(`Secured better trade deals \u2192 +${formatPercent(bonusPct)}% prices`);
    }
  }
  return success;
}

function initInvestments() {
  const container = document.getElementById("investments-container");
  if (!container) return;
  
  container.innerHTML = "";
  
  // Sort investments by: group (managers first), then cost, then tie-breakers
  const sortedInvestments = [...INVESTMENTS].sort((a, b) => {
    // Group ranking: manager=0, upgrade=1
    const groupRank = { manager: 0, upgrade: 1 };
    const rankA = groupRank[a.group] ?? 999;
    const rankB = groupRank[b.group] ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    
    // Cost comparison
    const costA = a.cost(TUNING, state);
    const costB = b.cost(TUNING, state);
    if (costA !== costB) return costA - costB;
    
    // Optional sortOrder
    const sortOrderA = a.sortOrder ?? 0;
    const sortOrderB = b.sortOrder ?? 0;
    if (sortOrderA !== sortOrderB) return sortOrderA - sortOrderB;
    
    // Title alphabetical
    const titleCmp = a.title.localeCompare(b.title);
    if (titleCmp !== 0) return titleCmp;
    
    // ID alphabetical (final tie-breaker)
    return a.id.localeCompare(b.id);
  });
  
  sortedInvestments.forEach(investment => {
    const btn = document.createElement("button");
    btn.className = "inv";
    btn.type = "button";
    btn.id = `inv-${investment.id}`;
    
    // Top section: title and cost
    const top = document.createElement("div");
    top.className = "inv__top";
    
    const title = document.createElement("div");
    title.className = "inv__title";
    title.textContent = investment.title;
    
    const cost = document.createElement("div");
    cost.className = "inv__cost";
    if (investment.costText) {
      cost.textContent = investment.costText(TUNING, state);
    } else {
      const costValue = investment.cost(TUNING, state);
      cost.textContent = `${costValue} florins`;
    }
    
    top.appendChild(title);
    top.appendChild(cost);
    
    // Effects section
    const effects = document.createElement("div");
    effects.className = "inv__effects";
    
    const effectLines = investment.effectLines(state, TUNING);
    effectLines.forEach((line, idx) => {
      const effectEl = document.createElement("div");
      effectEl.className = "inv__effect";
      
      // Mark "Requires:" lines as muted
      if (line.startsWith("Requires:") || line.startsWith("Ongoing:")) {
        effectEl.classList.add("inv__effect--muted");
      }
      
      effectEl.textContent = line;
      effects.appendChild(effectEl);
    });
    
    btn.appendChild(top);
    btn.appendChild(effects);
    
    // Click handler
    btn.addEventListener("click", (e) => {
      // Prevent multiple rapid clicks
      if (btn.disabled) return;
      buyInvestment(investment.id);
    });
    
    container.appendChild(btn);
  });
}

function isInvestmentOwned(investment) {
  if (investment.id === "arborist") return state.arboristHired;
  if (investment.id === "foreman") return state.foremanHired;
  if (investment.id === "pressManager") return state.pressManagerHired;
  if (investment.id === "quarryManager") return state.quarryManagerHired;
  if (investment.id === "market_autosell_rate") {
    return getMarketAutosellRateUpgrades() >= TUNING.market.autosell.maxRateUpgrades;
  }
  if (investment.id === "market_autosell_lane") {
    return getMarketLanesPurchased() >= TUNING.market.lanes.maxAdditionalLanes;
  }
  if (investment.id === "market_trade_deals") {
    return getMarketPriceUpgrades() >= TUNING.market.price.maxUpgrades;
  }
  if (investment.id === "pulley_cart") {
    return (state.quarryCartLevel || 0) >= TUNING.investments.pulleyCart.maxLevel;
  }
  if (investment.id === "sharpened_picks") {
    return (state.quarryPickLevel || 0) >= TUNING.investments.sharpenedPicks.maxLevel;
  }
  if (investment.id === "harvest_baskets") {
    return (state.harvestBasketLevel || 0) >= TUNING.investments.harvestBaskets.maxLevel;
  }
  if (investment.id === "build_olive_press") {
    return (state.olivePressCount || 1) - 1 >= TUNING.investments.olivePressExpansion.maxAdditionalPresses;
  }
  if (investment.id === "auto_ship_oil") {
    return !!state.autoShipOilUnlocked;
  }
  return !!state.upgrades[investment.id];
}

/**
 * Compute sort bucket for an investment:
 *   0 = purchasable now (prerequisites met + affordable)
 *   1 = locked (prerequisites not met)
 *   2 = unaffordable (prerequisites met but can't afford)
 */
function getInvestmentSortBucket(investment) {
  return investment.canPurchase(state, TUNING) ? 0 : 1;
}

function updateInvestmentButtons() {
  const container = document.getElementById("investments-container");

  // Build sortable list of visible (non-owned) investments with their buttons
  const sortable = [];

  INVESTMENTS.forEach(investment => {
    const btn = document.getElementById(`inv-${investment.id}`);
    if (!btn) return;

    if (isInvestmentOwned(investment)) {
      btn.style.display = "none";
      return;
    }

    // Show and update disabled state
    btn.style.display = "";
    btn.disabled = !investment.canPurchase(state, TUNING);

    // Update cost text for dynamic costs (only if changed)
    const costEl = btn.querySelector(".inv__cost");
    if (costEl) {
      const newCostText = investment.costText
        ? investment.costText(TUNING, state)
        : `${investment.cost(TUNING, state)} florins`;
      if (costEl.textContent !== newCostText) {
        costEl.textContent = newCostText;
      }
    }

    // Update effect lines for state-aware previews (only if changed)
    const effectsEl = btn.querySelector(".inv__effects");
    if (effectsEl) {
      const effectLines = investment.effectLines(state, TUNING);
      const newHTML = effectLines.map(line => {
        const muted = line.startsWith("Requires:") || line.startsWith("Ongoing:");
        const cls = muted ? "inv__effect inv__effect--muted" : "inv__effect";
        return `<div class="${cls}">${line}</div>`;
      }).join("");
      if (effectsEl.innerHTML !== newHTML) {
        effectsEl.innerHTML = newHTML;
      }
    }

    sortable.push({ investment, btn });
  });

  // Sort: purchasable first, then by cost within each group
  sortable.sort((a, b) => {
    const bucketA = getInvestmentSortBucket(a.investment);
    const bucketB = getInvestmentSortBucket(b.investment);
    if (bucketA !== bucketB) return bucketA - bucketB;

    const costA = a.investment.cost(TUNING, state);
    const costB = b.investment.cost(TUNING, state);
    if (costA !== costB) return costA - costB;

    return a.investment.id.localeCompare(b.investment.id);
  });

  // Re-order DOM only if the visible order actually changed
  const desiredOrder = sortable.map(({ btn }) => btn);
  const currentVisible = Array.from(container.children).filter(el => el.style.display !== "none");
  let needsReorder = desiredOrder.length !== currentVisible.length;
  if (!needsReorder) {
    for (let i = 0; i < desiredOrder.length; i++) {
      if (currentVisible[i] !== desiredOrder[i]) { needsReorder = true; break; }
    }
  }
  if (needsReorder) {
    desiredOrder.forEach(btn => container.appendChild(btn));
  }
}

// --- Pause/Resume Logic ---
function pauseSim() {
  if (isSimPaused) return;
  isSimPaused = true;
  pausedAtMs = Date.now();
  
  // Stop the main loop
  if (mainLoopInterval) {
    clearInterval(mainLoopInterval);
    mainLoopInterval = null;
  }
  if (era2LoopInterval) {
    clearInterval(era2LoopInterval);
    era2LoopInterval = null;
  }
  stopMarketLoop();
}

function resumeSim() {
  if (!isSimPaused) return;
  
  const pauseDuration = Date.now() - pausedAtMs;
  
  // Shift active job timers forward by pause duration
  // so they don't "catch up" for time spent paused
  if (isHarvesting && harvestJob.startTimeMs) {
    harvestJob.startTimeMs += pauseDuration;
  }
  
  if (isShipping && shipJob.startTimeMs) {
    shipJob.startTimeMs += pauseDuration;
  }

  if (isQuarrying && quarryJob.startTimeMs) {
    quarryJob.startTimeMs += pauseDuration;
  }

  isSimPaused = false;
  pausedAtMs = 0;
  
  // Restart the loop
  if (Number(state.era) >= 2) {
    startEra2Loop();
  } else {
    startLoop();
    startMarketLoop();
  }
}

function startEra2Loop() {
  if (Number(state.era) < 2) return;
  if (era2LoopInterval) return;

  const tickMs = 1000;
  let last = Date.now();
  era2LoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;

    const estateIncomeRate = getEstateIncomeRate();
    if (estateIncomeRate > 0) {
      const income = estateIncomeRate * dt;
      addFlorins(income, { trackLifetime: true });
    }

    updateUI();
    saveGame();
  }, tickMs);
}

// --- Main Loop ---
function startLoop() {
  if (Number(state.era) >= 2) return;
  // Prevent multiple intervals
  if (mainLoopInterval) return;
  
  const tickMs = 200;

  let last = Date.now();
  mainLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;

    // Sim timer
    state.simElapsedSeconds = (state.simElapsedSeconds || 0) + dt;
    if (simTimerEl) simTimerEl.textContent = formatRunDuration(state.simElapsedSeconds);

    // Arborist salary drain
    if (state.arboristHired) {
      const salaryPerSec = TUNING.managers.arborist.salaryPerMin / 60;
      const costThisTick = salaryPerSec * dt;
      if (state.florinCount >= costThisTick) {
        spendFlorins(costThisTick);
        arboristIsActive = true;
      } else {
        arboristIsActive = false;
      }
    } else {
      arboristIsActive = false;
    }

    // Press Manager salary drain
    if (state.pressManagerHired) {
      const salaryPerSec = TUNING.managers.pressManager.salaryPerMin / 60;
      const costThisTick = salaryPerSec * dt;
      if (state.florinCount >= costThisTick) {
        spendFlorins(costThisTick);
        pressManagerIsActive = true;
      } else {
        pressManagerIsActive = false;
      }
    } else {
      pressManagerIsActive = false;
    }

    // Quarry Manager salary drain
    if (state.quarryManagerHired) {
      const salaryPerSec = TUNING.managers.quarryManager.salaryPerMin / 60;
      const costThisTick = salaryPerSec * dt;
      if (state.florinCount >= costThisTick) {
        spendFlorins(costThisTick);
        quarryManagerIsActive = true;
      } else {
        quarryManagerIsActive = false;
      }
    } else {
      quarryManagerIsActive = false;
    }

    // Foreman salary drain
    if (state.foremanHired) {
      const salaryPerSec = TUNING.managers.foreman.salaryPerMin / 60;
      const costThisTick = salaryPerSec * dt;
      if (state.florinCount >= costThisTick) {
        spendFlorins(costThisTick);
        foremanIsActive = true;
      } else {
        foremanIsActive = false;
      }
    } else {
      foremanIsActive = false;
    }

    // Trees grow olives automatically
    growTrees(dt);
    
    // Auto-harvest if Arborist is active and trees have enough for a full batch
    if (state.arboristHired && arboristIsActive && !isHarvesting && state.treeOlives >= getCurrentHarvestBatchSize()) {
      startHarvest({ source: "auto" });
    }
    
    // Update harvest progress
    updateHarvestProgress();
    
    // Update ship progress
    updateShipProgress();
    
    // Update press progress
    updatePressProgress();
    
    // Update olive oil ship progress
    updateOliveOilShipProgress();

    // Update quarry progress
    updateQuarryProgress();

    // Auto-quarry if Quarry Manager is active
    if (state.quarryManagerHired && quarryManagerIsActive && !isQuarrying) {
      startQuarry();
    }

    // Auto-press when Press Manager is active
    if (pressManagerIsActive && !isPressing && getOlivesToPress() >= TUNING.press.olivesPerPress) {
      startPressing();
    }

    // Auto-ship oil if upgrade purchased and Press Manager is active
    if (state.autoShipOilUnlocked && pressManagerIsActive && !isShippingOliveOil && getShippableCount(state.oliveOilCount || 0) >= getOliveOilShippingCapacity()) {
      startShippingOliveOil();
    }

    // UI refresh
    updateUI();

    // Auto-save every tick
    saveGame();
  }, tickMs);
}

// --- Debug Modal ---
function openDebug() {
  const inEra2 = Number(state.era) >= 2;
  if (debugEra1Content) {
    debugEra1Content.classList.toggle("is-hidden", inEra2);
  }
  if (!inEra2) {
    // Capture current harvest chances as snapshot
    updateDebugHarvestChances();
  }
  
  debugModal.classList.add("active");
  debugModal.setAttribute("aria-hidden", "false");
}
function closeDebug() {
  debugModal.classList.remove("active");
  debugModal.setAttribute("aria-hidden", "true");
}

// --- Wire Events ---
harvestBtn.addEventListener("click", startHarvest);
shipOlivesBtn.addEventListener("click", startShipping);
shipOliveOilBtn.addEventListener("click", startShippingOliveOil);
pressBtn.addEventListener("click", startPressing);

quarryBtn.addEventListener("click", startQuarry);

hireCultivatorBtn.addEventListener("click", () => {
  const cost = getCultivatorHireCost();
  if (state.florinCount < cost) return;
  if (!spendFlorins(cost)) return;
  state.cultivatorCount += 1;
  addWorkerHire("cultivatorsHired");
  saveGame();
  updateUI();
  logLine(`Hired Cultivator (#${state.cultivatorCount}) for ${cost} florins.`);
});

hireHarvesterBtn.addEventListener("click", () => {
  const cost = getHarvesterHireCost();
  if (state.florinCount < cost) return;
  if (!spendFlorins(cost)) return;
  state.harvesterCount += 1;
  addWorkerHire("harvestersHired");
  saveGame();
  updateUI();
  logLine(`Hired Harvester (#${state.harvesterCount}) for ${cost} florins.`);
});

hirePresserBtn.addEventListener("click", () => {
  const cost = getPresserHireCost();
  if (state.florinCount < cost) return;
  if (!spendFlorins(cost)) return;
  state.presserCount += 1;
  addWorkerHire("pressersHired");
  saveGame();
  updateUI();
  logLine(`Hired Presser (#${state.presserCount}) for ${cost} florins.`);
});

clearLogBtn.addEventListener("click", () => {
  clearLog('farm', 'player');
  clearLog('farm', 'debug');
});

clearMarketLogBtn.addEventListener("click", () => {
  clearLog('market', 'player');
  clearLog('market', 'debug');
});

if (debugBtn) {
  debugBtn.addEventListener("click", openDebug);
}
if (debugBtnEra2) {
  debugBtnEra2.addEventListener("click", openDebug);
}
debugCloseBtn.addEventListener("click", closeDebug);
debugResetBtn.addEventListener("click", resetGame);
if (era2ResetBtn) {
  era2ResetBtn.addEventListener("click", resetGame);
}
invitationUnderstoodBtn.addEventListener("click", acknowledgeInvitationModal);
moveToCityBtn.addEventListener("click", moveToCity);

debugAddOlivesBtn.addEventListener("click", () => {
  state.harvestedOlives += 100;
  saveGame();
  updateUI();
  logLine("Debug: +100 harvested olives");
});

debugAddFlorinsBtn.addEventListener("click", () => {
  addFlorins(100, { trackLifetime: true });
  saveGame();
  updateUI();
  logLine("Debug: +100 florins");
});

debugAddFlorins1000Btn.addEventListener("click", () => {
  addFlorins(1000, { trackLifetime: true });
  saveGame();
  updateUI();
  logLine("Debug: +1000 florins");
});

debugAddOilBtn.addEventListener("click", () => {
  state.oliveOilCount += 100;
  saveGame();
  logLine("Debug: +100 olive oil");
});

const debugAddStoneBtn = document.getElementById("debug-add-stone-btn");
debugAddStoneBtn.addEventListener("click", () => {
  state.stone += 100;
  addStoneEarned(100);
  saveGame();
  updateUI();
  logLine("Debug: +100 stone");
});

debugAddRenownBtn.addEventListener("click", () => {
  const requested = 50;
  const gained = applyRenownGain(requested);
  saveGame();
  updateUI();
  logLine(`Debug: +${gained.toFixed(2)} renown`);
});

// Close modal on outside click
debugModal.addEventListener("click", (e) => {
  if (e.target === debugModal) closeDebug();
});

// --- Visibility/Focus Event Listeners ---
document.addEventListener("visibilitychange", () => {
  if (allowBackgroundSim) return;
  if (document.hidden) {
    pauseSim();
  } else {
    resumeSim();
  }
});

window.addEventListener("blur", () => {
  if (allowBackgroundSim) return;
  pauseSim();
});

window.addEventListener("focus", () => {
  if (allowBackgroundSim) return;
  if (document.hidden) return;
  resumeSim();
});

// --- Background Sim Toggle ---
const bgSimToggleBtn = document.getElementById("bg-sim-toggle");
if (bgSimToggleBtn) {
  bgSimToggleBtn.addEventListener("click", () => {
    allowBackgroundSim = !allowBackgroundSim;
    bgSimToggleBtn.textContent = allowBackgroundSim ? "BG: On" : "BG: Off";
    if (allowBackgroundSim && isSimPaused) {
      resumeSim();
    }
  });
}

// --- Init ---
// Initialize logger
initLogger({
  farmPlayerEl: farmLogPlayerEl,
  farmDebugEl: farmLogDebugEl,
  marketPlayerEl: marketLogPlayerEl,
  marketDebugEl: marketLogDebugEl,
});

// Set up log tab switching
function setupLogTabs(playerBtn, debugBtn, playerContainer, debugContainer) {
  playerBtn.addEventListener('click', () => {
    playerBtn.classList.add('is-active');
    debugBtn.classList.remove('is-active');
    playerContainer.classList.remove('is-hidden');
    debugContainer.classList.add('is-hidden');
  });
  
  debugBtn.addEventListener('click', () => {
    debugBtn.classList.add('is-active');
    playerBtn.classList.remove('is-active');
    debugContainer.classList.remove('is-hidden');
    playerContainer.classList.add('is-hidden');
  });
}

setupLogTabs(farmLogTabPlayer, farmLogTabDebug, farmLogPlayerEl, farmLogDebugEl);
setupLogTabs(marketLogTabPlayer, marketLogTabDebug, marketLogPlayerEl, marketLogDebugEl);

loadGame();
initInvestments();
updateUI();
setShipUIIdle();

// Set arborist salary from TUNING (display as negative cost)
const arboristSalary = TUNING.managers.arborist.salaryPerMin;
arboristSalaryEl.textContent = "-" + arboristSalary.toFixed(2) + " fl/min";

// Set foreman salary from TUNING (display as negative cost)
const foremanSalary = TUNING.managers.foreman.salaryPerMin;
foremanSalaryEl.textContent = "-" + foremanSalary.toFixed(2) + " fl/min";

// Set quarry manager salary from TUNING (display as negative cost)
const quarryManagerSalary = TUNING.managers.quarryManager.salaryPerMin;
quarryManagerSalaryEl.textContent = "-" + quarryManagerSalary.toFixed(2) + " fl/min";

// Set press manager salary from TUNING (display as negative cost)
const pressManagerSalary = TUNING.managers.pressManager.salaryPerMin;
pressManagerSalaryEl.textContent = "-" + pressManagerSalary.toFixed(2) + " fl/min";

if (Number(state.era) < 2) {
  startLoop();
  startMarketLoop();
  logLine("Tree Groves prototype loaded. Trees grow olives automatically.");
} else {
  startEra2Loop();
}
