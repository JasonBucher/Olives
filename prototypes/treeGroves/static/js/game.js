// Prototype Template JS
// Storage convention (rename STORAGE_PREFIX when you copy this template into a new prototype)
import { computeHarvestOutcomeChances } from './harvestWeights.js';
import { TUNING } from './tuning.js';
import { INVESTMENTS } from './investments.js';
import * as Calc from './gameCalc.js';
import { initLogger, logPlayer, logDebug, logEvent, clearLog } from './logger.js';
import SessionLog from './sessionLog.js';
import { initAnalyzerView } from './views/analyzerView.js';

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
let simMs = 0;

function publishSimMs() {
  globalThis.__tgSimMs = simMs;
}

function setSimMs(nextValue) {
  const nextMs = Number(nextValue);
  simMs = Number.isFinite(nextMs) && nextMs >= 0 ? nextMs : 0;
  publishSimMs();
}

function advanceSimMs(dtMs) {
  const delta = Number(dtMs);
  if (!Number.isFinite(delta) || delta <= 0) return;
  simMs += delta;
  publishSimMs();
}

setSimMs(0);

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
  "shippingCrateLevel",
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
    shippingCrateLevel: 0,
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
    if (key in parsed) acc[key] = parsed[key];
    return acc;
  }, {});
}

function buildPersistedState(currentState) {
  return pickPersistedState(currentState);
}

let state = createDefaultState();
let activeView = "game";
SessionLog.initSession({
  version: state.meta?.version || "unknown",
  build: "unknown",
  tuning: TUNING,
});
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
  return Calc.getCultivatorHireCost(state.cultivatorCount, TUNING);
}

// --- Cultivator Effects ---
function getCultivatorBonusPerSecond() {
  return Calc.getCultivatorBonusPerSecond(state.cultivatorCount, TUNING, state.foremanHired && foremanIsActive);
}

function getGroveExpansionBonus() {
  return Calc.getGroveExpansionBonus(state.upgrades, TUNING);
}

// --- Harvester Hire Cost ---
function getHarvesterHireCost() {
  return Calc.getHarvesterHireCost(state.harvesterCount, TUNING);
}

// --- Harvester Effects ---
function getHarvesterOlivesBonus() {
  return Calc.getHarvesterOlivesBonus(state.harvesterCount, TUNING);
}

function calculateHarvesterHirePreview() {
  return Calc.calculateHarvesterHirePreview(state.harvesterCount, TUNING);
}

// --- Presser Hire Cost ---
function getPresserHireCost() {
  return Calc.getPresserHireCost(state.presserCount, TUNING);
}

// --- Presser Effects ---
// Active state for managers (computed each tick)
let pressManagerIsActive = false;
let quarryManagerIsActive = false;
let foremanIsActive = false;

// --- Press Output Helpers ---
function getBaseOilPerOlive() {
  return Calc.getBaseOilPerOlive(TUNING);
}

function getTotalOilPerOlive() {
  return Calc.getTotalOilPerOlive(state.presserCount, TUNING, state.pressManagerHired && pressManagerIsActive);
}

// --- Shipping Capacity Helpers ---
function getOliveShippingCapacity() {
  return Calc.getOliveShippingCapacity(state.shippingCrateLevel, TUNING);
}

function getOliveOilShippingCapacity() {
  return Calc.getOliveOilShippingCapacity(state.shippingCrateLevel, TUNING);
}

// --- Quarry Helpers ---
function getQuarryDurationSeconds() {
  return Calc.getQuarryDurationSeconds(state.quarryCartLevel, TUNING);
}

// --- Quarry Output Helper ---
function getQuarryOutput() {
  return Calc.getQuarryOutput(state.quarryPickLevel, TUNING);
}

// --- Olive Press Scaling Helper ---
function getOlivesToPress() {
  return Calc.getOlivesToPress(state.harvestedOlives, state.olivePressCount, TUNING);
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

// Manager registry: maps tuning key to state hired key and active flag setter
const MANAGER_REGISTRY = [
  { tuningKey: "arborist", hiredKey: "arboristHired", salaryElId: "arborist-salary", setActive(v) { arboristIsActive = v; } },
  { tuningKey: "pressManager", hiredKey: "pressManagerHired", salaryElId: "press-manager-salary", setActive(v) { pressManagerIsActive = v; } },
  { tuningKey: "quarryManager", hiredKey: "quarryManagerHired", salaryElId: "quarry-manager-salary", setActive(v) { quarryManagerIsActive = v; } },
  { tuningKey: "foreman", hiredKey: "foremanHired", salaryElId: "foreman-salary", setActive(v) { foremanIsActive = v; } },
];

function tickManagers(dt) {
  for (const mgr of MANAGER_REGISTRY) {
    const decision = Calc.computeManagerTickDecision(
      !!state[mgr.hiredKey],
      TUNING.managers[mgr.tuningKey].salaryPerMin,
      state.florinCount,
      dt
    );
    if (decision.active) {
      spendFlorins(decision.cost);
    }
    mgr.setActive(decision.active);
  }
}

// --- DOM ---
const florinCountEl = document.getElementById("florin-count");
const treeOlivesEl = document.getElementById("tree-olives");
const treeCapacityEl = document.getElementById("tree-capacity");
const treeGrowthRateEl = document.getElementById("tree-growth-rate");
const marketOliveCountEl = document.getElementById("market-olive-count");
const marketOilCountEl = document.getElementById("market-oil-count");
const marketAutosellEl = document.getElementById("market-autosell");
const marketFloatAnchorEl = document.getElementById("market-float-anchor");
const marketDemandIndicatorEl = document.getElementById("market-demand-indicator");
const marketPriceIndicatorEl = document.getElementById("market-price-indicator");
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
const managersEmptyEl = document.getElementById("managers-empty");
const managersArboristWrap = document.getElementById("managers-arborist");
const managersPressMgrWrap = document.getElementById("managers-press-manager");
const pressManagerNameEl = document.getElementById("press-manager-name");
const managersQuarryMgrWrap = document.getElementById("managers-quarry-manager");
const quarryManagerNameEl = document.getElementById("quarry-manager-name");
const managersForemanWrap = document.getElementById("managers-foreman");
const foremanNameEl = document.getElementById("foreman-name");
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
const analyzerBtn = document.getElementById("analyzer-btn");
const analyzerBtnEra2 = document.getElementById("analyzer-btn-era2");
const analyzerBackBtn = document.getElementById("analyzer-back-btn");
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
const analyzerScreen = document.getElementById("analyzer-screen");
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
const era2SessionLogDownloadBtn = document.getElementById("era2-session-log-download-btn");
const era2SessionLogLinesEl = document.getElementById("era2-session-log-lines");
const era2SessionLogSizeEl = document.getElementById("era2-session-log-size");
const era2SessionLogSessionIdEl = document.getElementById("era2-session-log-session-id");
const analyzerView = initAnalyzerView({
  getLiveSnapshotPayload: () => ({
    florins: Number((state.florinCount || 0).toFixed(4)),
    stone: Number((state.stone || 0).toFixed(4)),
    era: Number(state.era) || 1,
  }),
});

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

function recordTelemetry(type, payload = {}) {
  SessionLog.record(type, payload);
}

let lastSnapshotSimMs = 0;
const SNAPSHOT_INTERVAL_MS = 30000;

function recordStateSnapshot() {
  recordTelemetry("state_snapshot", {
    florins: Number(state.florinCount) || 0,
    stone: Number(state.stone) || 0,
    harvestedOlives: Number(state.harvestedOlives) || 0,
    oliveOil: Number(state.oliveOilCount) || 0,
    marketOlives: Number(state.marketOlives) || 0,
    marketOliveOil: Number(state.marketOliveOil) || 0,
    treeOlives: Number(state.treeOlives) || 0,
  });
}

function showMarketFloat(text, variant) {
  if (!marketFloatAnchorEl) return;
  requestAnimationFrame(() => {
    const el = document.createElement('span');
    el.classList.add('market-float', variant);
    el.textContent = text;
    const activeFloats = marketFloatAnchorEl.querySelectorAll('.market-float').length;
    if (activeFloats > 0) {
      el.style.top = `${-12 - activeFloats * 18}px`;
    }
    marketFloatAnchorEl.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  });
}

// --- Inline Action UI ---
function createInlineActionController({ pillEl, countEl, progressEl, barEl, countdownEl, keepLayout }) {
  const fadeClass = "inline-fade-out";
  const invisibleClass = "is-invisible";
  let endTimerId = null;

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
    // Cancel any pending end() cleanup so it doesn't hide the pill we're about to show
    if (endTimerId != null) {
      clearTimeout(endTimerId);
      endTimerId = null;
    }
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

    endTimerId = window.setTimeout(() => {
      endTimerId = null;
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
    setSimMs((Number(state.simElapsedSeconds) || 0) * 1000);
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
    setSimMs((Number(state.simElapsedSeconds) || 0) * 1000);
  } catch (e) {
    console.warn("Failed to parse saved game state. Starting fresh.", e);
    state = defaults;
    state.meta.createdAt = new Date().toISOString();
    setSimMs((Number(state.simElapsedSeconds) || 0) * 1000);
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
  // Keep analyzer live mode in sync with a full game reset.
  try {
    localStorage.removeItem("tg_session_log_v1");
    sessionStorage.removeItem("tg_session_log_session_id_v1");
  } catch (error) {
    console.warn("Failed to clear session telemetry log during reset.", error);
  }

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

function formatApproxBytes(value) {
  const bytes = Math.max(0, Math.floor(Number(value) || 0));
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function downloadSessionLog() {
  const text = SessionLog.getText();
  const stats = SessionLog.getStats();
  const safeSessionId = String(stats.sessionId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `treegroves-session-${safeSessionId}-${timestamp}.ndjson`;
  const blob = new Blob([text], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  recordTelemetry("action_complete", {
    action: "download_session_log",
    lineCount: stats.lineCount || 0,
    approxBytes: stats.approxBytes || 0,
  });
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
function getDisplayCount(actualValue) {
  return Calc.getDisplayCount(actualValue);
}

function getShippableCount(actualValue) {
  return Calc.getShippableCount(actualValue);
}

function consumeInventory(actualValue, intAmount) {
  return Calc.consumeInventory(actualValue, intAmount);
}

function getRenownTierState() {
  return Calc.getRenownTierState(state.renownValue, state.renownCapped, renownTierConfig);
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

  const tierBefore = getRenownTierState().tierId;

  state.renownLifetime = (Number(state.renownLifetime) || 0) + allowed;
  state.renownValue = currentRenown + allowed;

  if (capMax != null && state.renownValue >= capMax) {
    setRenownCapped(capMax);
  }

  const tierAfter = getRenownTierState().tierId;
  if (tierBefore !== tierAfter && tierAfter) {
    const tierName = getRenownTierState().tierName;
    showMarketFloat(`${tierName} Tier reached!`, "surge");
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
  const isAnalyzerOpen = activeView === "analyzer";
  if (analyzerScreen) {
    analyzerScreen.classList.toggle("is-hidden", !isAnalyzerOpen);
  }
  if (isAnalyzerOpen) {
    if (eraOneRoot) eraOneRoot.classList.add("is-hidden");
    if (eraTwoScreen) eraTwoScreen.classList.add("is-hidden");
    return;
  }

  const inEra2 = Number(state.era) >= 2;
  if (eraOneRoot) {
    eraOneRoot.classList.toggle("is-hidden", inEra2);
  }
  if (eraTwoScreen) {
    eraTwoScreen.classList.toggle("is-hidden", !inEra2);
  }
}

function openAnalyzer() {
  activeView = "analyzer";
  updateEraVisibility();
  analyzerView.notifyVisible();
  syncSimulationPauseState();
}

function closeAnalyzer() {
  activeView = "game";
  updateUI();
  syncSimulationPauseState();
}

function computeEstateIncomeRate(snapshot) {
  return Calc.computeEstateIncomeRate(snapshot, TUNING);
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

  const sessionLogStats = SessionLog.getStats();
  if (era2SessionLogLinesEl) {
    era2SessionLogLinesEl.textContent = formatSummaryCount(sessionLogStats.lineCount || 0, 0);
  }
  if (era2SessionLogSizeEl) {
    era2SessionLogSizeEl.textContent = formatApproxBytes(sessionLogStats.approxBytes || 0);
  }
  if (era2SessionLogSessionIdEl) {
    era2SessionLogSessionIdEl.textContent = sessionLogStats.sessionId || "unknown";
  }
}

function buildEstateSnapshot() {
  const currentTreeCapacity = TUNING.grove.treeCapacity + getGroveExpansionBonus();
  const harvestUpgradeKeys = Object.keys(state.upgrades || {}).filter((key) => (
    key === "improved_harvesting" ||
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
  recordTelemetry("currency_delta", {
    currency: "florins",
    delta: Number((-TUNING.relocation.florinCost).toFixed(4)),
    reason: "move_to_city",
  });
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
  recordTelemetry("action_complete", {
    action: "move_to_city",
    estateIncomePerSecond: Number(getEstateIncomeRate().toFixed(6)),
  });
}

// --- UI ---
function updateUI() {
  updateEraVisibility();
  updateEra2UI();

  const activeFlags = {
    arborist: arboristIsActive,
    foreman: state.foremanHired && foremanIsActive,
    quarryManager: quarryManagerIsActive,
    pressManager: state.pressManagerHired && pressManagerIsActive,
  };

  // --- Grove & inventory ---
  const grove = Calc.calcGroveStats(state, TUNING, activeFlags.foreman);
  florinCountEl.textContent = state.florinCount.toFixed(2);
  treeOlivesEl.textContent = grove.treeOlives;
  treeCapacityEl.textContent = grove.treeCapacity;
  treeGrowthRateEl.textContent = `(${grove.growthRate.toFixed(2)}/s)`;

  invOlivesQty.textContent = Calc.getDisplayCount(state.harvestedOlives);
  invOliveOilQty.textContent = Calc.getDisplayCount(state.oliveOilCount || 0);
  marketOliveCountEl.textContent = Calc.getDisplayCount(state.marketOlives);
  marketOilCountEl.textContent = Calc.getDisplayCount(state.marketOliveOil || 0);
  updateMarketAutosellUI();
  updateRenownUI();
  updateRelocationUI();

  // --- Shipping buttons ---
  const ship = Calc.calcShippingStats(state, TUNING);
  if (!isShipping) {
    shipOlivesBtn.disabled = ship.olives.shippable === 0;
    shipOlivesBtn.textContent = `Ship (up to ${ship.olives.maxShip})`;
  }
  if (!isShippingOliveOil) {
    shipOliveOilBtn.disabled = ship.oil.shippable === 0;
    shipOliveOilBtn.textContent = `Ship (up to ${ship.oil.maxShip})`;
  }

  // --- Press ---
  olivePressCountEl.textContent = "x" + (state.olivePressCount || 1);
  const press = Calc.calcPressAction(state, TUNING, activeFlags.pressManager);
  if (!isPressing) {
    pressBtn.disabled = press.olivesToPress < TUNING.press.olivesPerPress;
    pressBtn.textContent = `Press (${press.olivesToPress})`;
  }
  if (pressConsumesEl) {
    pressConsumesEl.textContent = `Consumes: ${press.olivesToPress} Olives`;
  }
  if (pressProducesEl) {
    pressProducesEl.textContent = `Produces: ${press.oilOutput.toFixed(2)} Olive Oil`;
  }

  // --- Stone & quarry ---
  invStoneQty.textContent = Calc.getDisplayCount(state.stone);
  if (!isQuarrying) {
    quarryBtn.disabled = false;
  }
  const quarry = Calc.calcQuarryStats(state, TUNING);
  quarryNextEl.textContent = `Next: +${quarry.output} Stone \u2022 ${parseFloat(quarry.durationSeconds.toFixed(2))}s`;

  // --- Harvest ---
  if (!isHarvesting) {
    harvestBtn.disabled = false;
    harvestActionUI.setIdle({ resetBar: false });
  }
  const chances = getCurrentHarvestOutcomeChances();
  const hStats = Calc.calcHarvesterStats(state, TUNING, arboristIsActive, chances, harvestConfig.batchSize);
  harvestNextEl.textContent = `Next: +${Math.floor(hStats.batchSize)} olives \u2022 ${TUNING.harvest.durationSeconds}s  |  Stability: ${hStats.harvest.stabilityLabel} (${hStats.harvest.poorPct}% \u26A0 / ${hStats.harvest.efficientPct}% \u2728 / ${hStats.harvest.interruptedPct}% \u26D4)`;

  // --- Cultivator UI ---
  const cult = Calc.calcCultivatorStats(state, TUNING, activeFlags.foreman);
  cultivatorCountEl.textContent = `x${cult.count}`;
  hireCultivatorCostEl.textContent = cult.hireCost;
  hireCultivatorBtn.disabled = state.florinCount < cult.hireCost;
  cultivatorImpactEl.textContent = `+${Calc.formatOlivesPerSecond(cult.currentBonus)} olives / s`;
  cultivatorDelta.textContent = `Next: +${Calc.formatOlivesPerSecond(cult.nextBonus)} olives / s`;
  renderBadge(cultivatorBadgeManager, cult.managerActive);
  cultivatorBadgeStatus.textContent = "";
  cultivatorBadgeStatus.style.visibility = "hidden";
  cultivatorBadgeExtra.textContent = "";
  cultivatorBadgeExtra.style.visibility = "hidden";

  // --- Harvester UI ---
  harvesterCountEl.textContent = `x${hStats.count}`;
  hireHarvesterCostEl.textContent = hStats.hireCost;
  hireHarvesterBtn.disabled = state.florinCount < hStats.hireCost;
  if (hStats.count > 0) {
    harvesterImpactEl.textContent = `Harvest +${hStats.olives.current.toFixed(1)} olives, \u2728 +${hStats.eff.current} bonus`;
  } else {
    harvesterImpactEl.textContent = "\u2014";
  }
  const effPart = hStats.eff.delta > 0 ? `, \u2728 +${hStats.eff.delta} bonus` : '';
  harvesterDelta.textContent = `Next: +${hStats.olives.delta.toFixed(1)} olives per harvest${effPart}`;
  renderBadge(harvesterBadgeManager, hStats.managerActive);
  harvesterBadgeStatus.textContent = "";
  harvesterBadgeStatus.style.visibility = "hidden";
  harvesterBadgeExtra.textContent = "";
  harvesterBadgeExtra.style.visibility = "hidden";

  // --- Presser UI ---
  const pStats = Calc.calcPresserStats(state, TUNING, activeFlags.pressManager);
  presserCountEl.textContent = `x${pStats.count}`;
  hirePresserCostEl.textContent = pStats.hireCost;
  hirePresserBtn.disabled = state.florinCount < pStats.hireCost;
  if (pStats.count > 0) {
    presserImpactEl.textContent = `+${Calc.formatOilPerPress(pStats.currentOilBonus)} oil / press`;
  } else {
    presserImpactEl.textContent = "\u2014";
  }
  presserDelta.textContent = `Next: +${Calc.formatOilPerPress(pStats.nextOilBonus)} oil / press`;
  renderBadge(presserBadgeManager, pStats.managerActive);
  presserBadgeStatus.textContent = "";
  presserBadgeStatus.style.visibility = "hidden";
  presserBadgeExtra.textContent = "";
  presserBadgeExtra.style.visibility = "hidden";

  // --- Managers section ---
  const mgrSummary = Calc.calcManagersSummary(state, TUNING, {
    arborist: arboristIsActive,
    foreman: foremanIsActive,
    quarryManager: quarryManagerIsActive,
    pressManager: pressManagerIsActive,
  });
  managersEmptyEl.hidden = mgrSummary.anyHired;

  const mgrUI = {
    arborist: { wrap: managersArboristWrap, nameEl: arboristNameEl },
    foreman: { wrap: managersForemanWrap, nameEl: foremanNameEl },
    quarryManager: { wrap: managersQuarryMgrWrap, nameEl: quarryManagerNameEl },
    pressManager: { wrap: managersPressMgrWrap, nameEl: pressManagerNameEl },
  };
  for (const mgr of mgrSummary.managers) {
    const ui = mgrUI[mgr.id];
    if (mgr.hired) {
      ui.wrap.hidden = false;
      ui.nameEl.classList.toggle("mgr-name--active", mgr.active);
      ui.nameEl.classList.toggle("mgr-name--inactive", !mgr.active);
    } else {
      ui.wrap.hidden = true;
    }
  }

  if (mgrSummary.anyHired && mgrSummary.totalActiveCost > 0) {
    managersTotalWrap.hidden = false;
    managersTotalCostEl.textContent = "-" + mgrSummary.totalActiveCost.toFixed(2) + " fl/min";
  } else {
    managersTotalWrap.hidden = true;
  }

  // Update investment button states (state-aware previews)
  updateInvestmentButtons();
}

// --- Badge rendering helper ---
function renderBadge(badgeEl, isActive) {
  if (isActive) {
    badgeEl.textContent = "Mgr";
    badgeEl.style.visibility = "visible";
  } else {
    badgeEl.textContent = "";
    badgeEl.style.visibility = "hidden";
  }
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
function rollWeighted(outcomesArray, { detailed = false } = {}) {
  const totalWeight = outcomesArray.reduce((sum, o) => sum + o.weight, 0);
  const roll = Math.random() * totalWeight;
  let remaining = roll;
  
  for (const outcome of outcomesArray) {
    remaining -= outcome.weight;
    if (remaining <= 0) {
      if (detailed) {
        return { outcome, roll, totalWeight };
      }
      return outcome;
    }
  }

  const fallback = outcomesArray[outcomesArray.length - 1];
  if (detailed) {
    return { outcome: fallback, roll, totalWeight };
  }
  return fallback;
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

function getHarvestStabilityLabel(poorPct) {
  return Calc.getHarvestStabilityLabel(poorPct);
}

// --- Harvest System ---
function getCurrentHarvestBatchSize() {
  return Calc.getCurrentHarvestBatchSize(state.harvesterCount, state.harvestBasketLevel, harvestConfig.batchSize, TUNING);
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
  const rollResult = rollWeighted(adjustedOutcomes, { detailed: true });
  const outcome = rollResult.outcome;
  recordTelemetry("roll_result", {
    action: "harvest",
    roll: Number((rollResult.roll || 0).toFixed(6)),
    totalWeight: Number((rollResult.totalWeight || 0).toFixed(6)),
    weights: adjustedOutcomes.map((entry) => ({
      key: entry.key,
      weight: Number((entry.weight || 0).toFixed(6)),
    })),
  });
  
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

  recordTelemetry("action_start", {
    action: "harvest",
    source: opts.source === "auto" ? "auto" : "manual",
    attempted: attemptedInt,
    durationMs: effectiveDurationMs,
    harvesterCount: state.harvesterCount,
  });
}

function completeHarvest() {
  const { attempted, outcome, durationMs } = harvestJob;
  const treeOlivesBefore = state.treeOlives;
  
  // Calculate base results from outcome
  const baseCollected = attempted * outcome.collectedPct;
  const lost = Math.floor(attempted * outcome.lostPct);

  // Efficient bonus: flat base + per-harvester scaling, unconditional
  let efficientBonus = 0;
  if (outcome.key === "efficient") {
    const cfg = TUNING.harvest.efficientBonus;
    efficientBonus = Math.floor(cfg.flat + state.harvesterCount * cfg.perHarvester);
  }

  const totalCollected = baseCollected + efficientBonus;
  const remaining = Math.max(0, attempted - Math.floor(baseCollected) - lost);

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
  
  // Format collection message
  const baseMsg = `Harvest (${outcomeLabel}, ${durationSec}s): collected ${Math.floor(baseCollected)}`;
  const bonusPart = efficientBonus > 0 ? ` + ${efficientBonus} bonus` : '';
  const lostPart = lost > 0 ? `, lost ${lost}` : '';
  logLine(`${baseMsg}${bonusPart}${lostPart}`, logColor);

  const collectedInt = Math.floor(totalCollected);
  const completionEventType = outcome.key.startsWith("interrupted") ? "action_interrupted" : "action_complete";
  recordTelemetry(completionEventType, {
    action: "harvest",
    attempted,
    outcome: outcome.key,
    durationMs,
    collected: collectedInt,
    efficientBonus,
    lost,
    treeOlivesBefore: Math.floor(treeOlivesBefore),
    treeOlivesAfter: Math.floor(state.treeOlives),
  });
  recordTelemetry("resource_delta", {
    resource: "tree_olives",
    delta: -1 * (Math.floor(baseCollected) + lost),
    reason: "harvest_complete",
    outcome: outcome.key,
  });
  recordTelemetry("resource_delta", {
    resource: "harvested_olives",
    delta: Number(totalCollected.toFixed(4)),
    reason: "harvest_complete",
    outcome: outcome.key,
  });
  
  // Floating outcome text for notable results (deferred to next frame to avoid jank)
  if (outcome.key === 'efficient' || outcome.key === 'poor' || outcome.key === 'interrupted_short') {
    const floatKey = outcome.key === 'interrupted_short' ? 'interrupted' : outcome.key;
    const floatText = floatKey === 'efficient'
      ? `+${Math.floor(totalCollected)} olives ✨ (${efficientBonus} bonus)`
      : floatKey === 'interrupted'
      ? `Interrupted ⛔ (+${Math.floor(totalCollected)})`
      : `+${Math.floor(totalCollected)} olives ⚠`;
    requestAnimationFrame(() => {
      const floatEl = document.createElement('span');
      floatEl.classList.add('harvest-float', floatKey);
      floatEl.textContent = floatText;
      const middle = harvestBtn.closest('.inventory-row').querySelector('.inv-middle');
      middle.appendChild(floatEl);
      setTimeout(() => floatEl.remove(), 2500);
    });
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
  const timeRoll = rollWeighted(TUNING.market.shipping.sharedTimeOutcomes, { detailed: true });
  const incidentRoll = rollWeighted(TUNING.market.shipping.sharedIncidentOutcomes, { detailed: true });
  const timeOutcome = timeRoll.outcome;
  const incidentOutcome = incidentRoll.outcome;
  recordTelemetry("roll_result", {
    action: "ship_olives",
    rollKind: "time",
    roll: Number((timeRoll.roll || 0).toFixed(6)),
    totalWeight: Number((timeRoll.totalWeight || 0).toFixed(6)),
    selected: timeOutcome.key,
    weights: TUNING.market.shipping.sharedTimeOutcomes.map((entry) => ({
      key: entry.key,
      weight: Number((entry.weight || 0).toFixed(6)),
    })),
  });
  recordTelemetry("roll_result", {
    action: "ship_olives",
    rollKind: "incident",
    roll: Number((incidentRoll.roll || 0).toFixed(6)),
    totalWeight: Number((incidentRoll.totalWeight || 0).toFixed(6)),
    selected: incidentOutcome.key,
    weights: TUNING.market.shipping.sharedIncidentOutcomes.map((entry) => ({
      key: entry.key,
      weight: Number((entry.weight || 0).toFixed(6)),
    })),
  });
  
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
  recordTelemetry("action_start", {
    action: "ship_olives",
    item: "olives",
    amount,
    durationMs: timeOutcome.durationMs,
    timeOutcome: timeOutcome.key,
    incidentOutcome: incidentOutcome.key,
    lostCount,
    stolenCount,
  });
  recordTelemetry("resource_delta", {
    resource: "harvested_olives",
    delta: -amount,
    reason: "ship_olives_start",
  });
  saveGame();
  updateUI();
}

function completeShipping() {
  // Calculate how many arrive
  const arrived = shipJob.amount - shipJob.lostCount - shipJob.stolenCount;
  
  // Add to market inventory
  state.marketOlives += arrived;

  if (arrived > 0) {
    showMarketFloat(`+${arrived} olives arrived`, "arrival");
  }

  // Log to market log
  const timeKey = shipJob.timeOutcomeKey.toUpperCase();
  const incidentKey = shipJob.incidentKey.toUpperCase();
  marketLogLine(
    `Shipment arrived (${timeKey}, ${incidentKey}): sent ${shipJob.amount}, arrived ${arrived}, lost ${shipJob.lostCount}, stolen ${shipJob.stolenCount}.`
  );
  recordTelemetry("action_complete", {
    action: "ship_olives",
    item: "olives",
    sent: shipJob.amount,
    arrived,
    lostCount: shipJob.lostCount,
    stolenCount: shipJob.stolenCount,
    timeOutcome: shipJob.timeOutcomeKey,
    incidentOutcome: shipJob.incidentKey,
  });
  recordTelemetry("resource_delta", {
    resource: "market_olives",
    delta: arrived,
    reason: "ship_olives_complete",
  });

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
    durationMs: TUNING.press.baseDurationMs,
    olivesConsumed: olivesToPress,
    oilPerOlive: oilPerOlive,
  };
  
  isPressing = true;
  
  // Update inline UI
  pressActionUI.start({ count: olivesToPress, percent: 0 });
  pressBtn.disabled = true;
  recordTelemetry("action_start", {
    action: "press",
    olivesConsumed: olivesToPress,
    oilPerOlive: Number(oilPerOlive.toFixed(6)),
    durationMs: pressJob.durationMs,
  });
  recordTelemetry("resource_delta", {
    resource: "harvested_olives",
    delta: -olivesToPress,
    reason: "press_start",
  });
  
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
  recordTelemetry("action_complete", {
    action: "press",
    olivesConsumed: pressJob.olivesConsumed,
    producedOil: Number(producedOil.toFixed(4)),
    oilPerOlive: Number(pressJob.oilPerOlive.toFixed(6)),
    durationMs: pressJob.durationMs,
    outcome: "success",
  });
  recordTelemetry("resource_delta", {
    resource: "olive_oil",
    delta: Number(producedOil.toFixed(4)),
    reason: "press_complete",
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
  const timeRoll = rollWeighted(TUNING.market.shipping.sharedTimeOutcomes, { detailed: true });
  const incidentRoll = rollWeighted(TUNING.market.shipping.sharedIncidentOutcomes, { detailed: true });
  const timeOutcome = timeRoll.outcome;
  const incidentOutcome = incidentRoll.outcome;
  recordTelemetry("roll_result", {
    action: "ship_olive_oil",
    rollKind: "time",
    roll: Number((timeRoll.roll || 0).toFixed(6)),
    totalWeight: Number((timeRoll.totalWeight || 0).toFixed(6)),
    selected: timeOutcome.key,
    weights: TUNING.market.shipping.sharedTimeOutcomes.map((entry) => ({
      key: entry.key,
      weight: Number((entry.weight || 0).toFixed(6)),
    })),
  });
  recordTelemetry("roll_result", {
    action: "ship_olive_oil",
    rollKind: "incident",
    roll: Number((incidentRoll.roll || 0).toFixed(6)),
    totalWeight: Number((incidentRoll.totalWeight || 0).toFixed(6)),
    selected: incidentOutcome.key,
    weights: TUNING.market.shipping.sharedIncidentOutcomes.map((entry) => ({
      key: entry.key,
      weight: Number((entry.weight || 0).toFixed(6)),
    })),
  });
  
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
  recordTelemetry("action_start", {
    action: "ship_olive_oil",
    item: "olive_oil",
    amount,
    durationMs: timeOutcome.durationMs,
    timeOutcome: timeOutcome.key,
    incidentOutcome: incidentOutcome.key,
    lostCount,
    stolenCount,
  });
  recordTelemetry("resource_delta", {
    resource: "olive_oil",
    delta: -amount,
    reason: "ship_olive_oil_start",
  });
  saveGame();
  updateUI();
}

function tryPremiumBuyerOnArrival(arrived) {
  if (arrived <= 0) return { triggered: false };
  const premiumCfg = TUNING.market?.shipping?.premiumBuyer;
  if (!premiumCfg) return { triggered: false };

  const tierId = getRenownTierState().tierId;
  const chance = Number(premiumCfg.chanceByTier?.[tierId]) || 0;
  if (chance <= 0 || Math.random() >= chance) return { triggered: false };

  const priceMult = Number(premiumCfg.priceMult) || 2;
  const effectiveMult = getMarketEffectivePriceMultiplier(priceMult);
  const earned = arrived * TUNING.market.prices.oliveOilFlorins * effectiveMult;

  addFlorins(earned, { trackLifetime: true });
  addOliveOilSold(arrived);
  applyRenownGainFromSale(arrived);

  showMarketFloat(`Courier waiting! ${arrived} oil \u2192 ${formatFlorins(earned)} fl`, "premium");
  logEvent({
    channel: "market",
    playerText: `Premium buyer: purchased ${arrived} oil for ${formatFlorins(earned)} florins!`,
    debugText: `Premium buyer: arrived=${arrived}, priceMult=\u00d7${effectiveMult.toFixed(2)}, earned=${earned.toFixed(2)} fl`,
  });
  recordTelemetry("action_complete", {
    action: "premium_buyer",
    item: "olive_oil",
    arrived,
    earned: Number(earned.toFixed(4)),
    effectivePriceMultiplier: Number(effectiveMult.toFixed(4)),
  });
  recordTelemetry("currency_delta", {
    currency: "florins",
    delta: Number(earned.toFixed(4)),
    reason: "premium_buyer",
  });

  return { triggered: true, earned };
}

function completeShippingOliveOil() {
  // Calculate how many arrive
  const arrived = oliveOilShipJob.amount - oliveOilShipJob.lostCount - oliveOilShipJob.stolenCount;

  // Try premium buyer before adding to market inventory
  const premium = tryPremiumBuyerOnArrival(arrived);

  if (!premium.triggered) {
    // Add to market oil inventory
    state.marketOliveOil = (state.marketOliveOil || 0) + arrived;

    if (arrived > 0) {
      showMarketFloat(`+${arrived} oil arrived`, "arrival");
    }
  }

  // Log to market log
  const timeKey = oliveOilShipJob.timeOutcomeKey.toUpperCase();
  const incidentKey = oliveOilShipJob.incidentKey.toUpperCase();
  marketLogLine(
    `Olive oil shipment arrived (${timeKey}, ${incidentKey}): sent ${oliveOilShipJob.amount}, arrived ${arrived}, lost ${oliveOilShipJob.lostCount}, stolen ${oliveOilShipJob.stolenCount}.`
  );
  recordTelemetry("action_complete", {
    action: "ship_olive_oil",
    item: "olive_oil",
    sent: oliveOilShipJob.amount,
    arrived,
    lostCount: oliveOilShipJob.lostCount,
    stolenCount: oliveOilShipJob.stolenCount,
    timeOutcome: oliveOilShipJob.timeOutcomeKey,
    incidentOutcome: oliveOilShipJob.incidentKey,
    premiumBuyerTriggered: !!premium.triggered,
  });
  if (!premium.triggered) {
    recordTelemetry("resource_delta", {
      resource: "market_olive_oil",
      delta: arrived,
      reason: "ship_olive_oil_complete",
    });
  }

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
  recordTelemetry("action_start", {
    action: "quarry",
    durationMs,
    expectedStone: getQuarryOutput(),
  });
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
  recordTelemetry("action_complete", {
    action: "quarry",
    output,
    totalStone: Number(state.stone.toFixed(4)),
    durationMs: quarryJob.durationMs,
  });
  recordTelemetry("resource_delta", {
    resource: "stone",
    delta: output,
    reason: "quarry_complete",
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
  return Calc.getMarketPermanentPriceMultiplier(getMarketPriceUpgrades(), TUNING);
}

function getMarketEffectivePriceMultiplier(eventMultiplier = 1) {
  return Calc.getMarketEffectivePriceMultiplier(getMarketPriceUpgrades(), TUNING, eventMultiplier);
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
  return Calc.splitMarketSaleUnits(totalUnits, olivesAvailable, oilAvailable);
}

function applyMarketSale({ olives, oil }, priceMultiplier = 1) {
  let earned = 0;
  const unitsSold = Math.max(0, olives) + Math.max(0, oil);

  if (olives > 0) {
    state.marketOlives = consumeInventory(state.marketOlives, olives);
    earned += olives * TUNING.market.prices.olivesFlorins;
    recordTelemetry("resource_delta", {
      resource: "market_olives",
      delta: Number((-olives).toFixed(4)),
      reason: "market_sale",
    });
  }

  if (oil > 0) {
    state.marketOliveOil = consumeInventory(state.marketOliveOil || 0, oil);
    earned += oil * TUNING.market.prices.oliveOilFlorins;
    recordTelemetry("resource_delta", {
      resource: "market_olive_oil",
      delta: Number((-oil).toFixed(4)),
      reason: "market_sale",
    });
  }

  earned *= getMarketEffectivePriceMultiplier(priceMultiplier);
  if (earned > 0) {
    addFlorins(earned, { trackLifetime: true });
    recordTelemetry("currency_delta", {
      currency: "florins",
      delta: Number(earned.toFixed(4)),
      reason: "market_sale",
    });
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

  const priceMultiplier = activeCityModifiers
    .filter((modifier) => modifier?.type === "priceMultiplier")
    .reduce((acc, modifier) => acc * (Number(modifier.value) || 1), 1);

  return {
    autosellPaused: false,
    autosellRateMultiplier: demandMultiplier > 0 ? demandMultiplier : 1,
    priceMultiplier: priceMultiplier > 0 ? priceMultiplier : 1,
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

  showMarketFloat(`${eventDef.name}: ${soldOil} oil \u2192 ${formatFlorins(earned)} fl`, "sale");

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

  // Refresh timer if same event is already active (don't stack duplicates)
  const existing = activeCityModifiers.find((m) => m.eventId === eventDef.id);
  if (existing) {
    existing.remainingSeconds = durationSeconds;
  } else {
    activeCityModifiers.push({
      eventId: eventDef.id,
      eventName: eventDef.name,
      type: "demandMultiplier",
      value: demandMultiplier,
      remainingSeconds: durationSeconds,
      durationSeconds,
    });
  }

  const pct = ((demandMultiplier - 1) * 100);
  const sign = pct >= 0 ? "+" : "";
  const demandVariant = demandMultiplier >= 1 ? "surge" : "slow";
  const demandLabel = demandMultiplier >= 1
    ? `Demand surging \u00d7${demandMultiplier.toFixed(1)} (${durationSeconds}s)`
    : `Demand slowed \u00d7${demandMultiplier.toFixed(1)} (${durationSeconds}s)`;
  showMarketFloat(demandLabel, demandVariant);

  logEvent({
    channel: "market",
    playerText: `${eventDef.name}: city demand ${pct >= 0 ? "increased" : "decreased"} for ${durationSeconds}s.`,
    debugText: `${eventDef.name}: demandMultiplier=${demandMultiplier.toFixed(2)} (${sign}${formatPercent(pct)}%), duration=${durationSeconds}s`,
  });
}

function addCityTimedPriceModifier(eventDef) {
  const priceMultiplier = Number(eventDef.priceMultiplier) || 1;
  const durationSeconds = Math.max(0, Number(eventDef.durationSeconds) || 0);
  if (durationSeconds <= 0 || priceMultiplier <= 0 || priceMultiplier === 1) {
    return;
  }

  // Refresh timer if same event is already active (don't stack duplicates)
  const existing = activeCityModifiers.find((m) => m.eventId === eventDef.id);
  if (existing) {
    existing.remainingSeconds = durationSeconds;
  } else {
    activeCityModifiers.push({
      eventId: eventDef.id,
      eventName: eventDef.name,
      type: "priceMultiplier",
      value: priceMultiplier,
      remainingSeconds: durationSeconds,
      durationSeconds,
    });
  }

  showMarketFloat(`${eventDef.name}! \u00d7${priceMultiplier.toFixed(1)} prices (${durationSeconds}s)`, "surge");

  logEvent({
    channel: "market",
    playerText: `${eventDef.name}: prices increased \u00d7${priceMultiplier.toFixed(1)} for ${durationSeconds}s.`,
    debugText: `${eventDef.name}: priceMultiplier=${priceMultiplier.toFixed(2)}, duration=${durationSeconds}s`,
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
    return;
  }
  if (eventDef.type === "timedPriceModifier") {
    addCityTimedPriceModifier(eventDef);
    return;
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

  // Update demand/price modifier indicators
  const demandMult = modifiers.autosellRateMultiplier ?? 1;
  if (marketDemandIndicatorEl) {
    if (Math.abs(demandMult - 1) > 0.05) {
      const isUp = demandMult > 1;
      marketDemandIndicatorEl.textContent = `${isUp ? "\u25b2" : "\u25bc"} \u00d7${demandMult.toFixed(1)}`;
      marketDemandIndicatorEl.className = `market-modifier-pill ${isUp ? "demand-up" : "demand-down"}`;
      marketDemandIndicatorEl.hidden = false;
    } else {
      marketDemandIndicatorEl.hidden = true;
    }
  }

  const priceMult = modifiers.priceMultiplier ?? 1;
  if (marketPriceIndicatorEl) {
    if (Math.abs(priceMult - 1) > 0.01) {
      marketPriceIndicatorEl.textContent = `\u25b2 \u00d7${priceMult.toFixed(1)} price`;
      marketPriceIndicatorEl.className = "market-modifier-pill price-up";
      marketPriceIndicatorEl.hidden = false;
    } else {
      marketPriceIndicatorEl.hidden = true;
    }
  }
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
    recordTelemetry("purchase_investment", {
      id: investment.id,
      title: investment.title,
      group: investment.group || "unknown",
      florinsSpent: Number(spent.toFixed(4)),
      stoneSpent: Number(stoneSpent.toFixed(4)),
    });
    if (spent > 0) {
      recordTelemetry("currency_delta", {
        currency: "florins",
        delta: Number((-spent).toFixed(4)),
        reason: "purchase_investment",
        investmentId: investment.id,
      });
    }
    if (stoneSpent > 0) {
      recordTelemetry("resource_delta", {
        resource: "stone",
        delta: Number((-stoneSpent).toFixed(4)),
        reason: "purchase_investment",
        investmentId: investment.id,
      });
    }
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
  return investment.isOwned(state, TUNING);
}

/**
 * Compute sort bucket for an investment:
 *   0 = purchasable now
 *   1 = not purchasable (locked or unaffordable)
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

function shouldPauseSimulation() {
  if (allowBackgroundSim) return false;
  const isHidden = typeof document !== "undefined" ? !!document.hidden : false;
  const hasFocus = typeof document !== "undefined" && typeof document.hasFocus === "function"
    ? document.hasFocus()
    : !isHidden;
  const isAnalyzerOpen = activeView === "analyzer";
  return isHidden || !hasFocus || isAnalyzerOpen;
}

function syncSimulationPauseState() {
  if (shouldPauseSimulation()) {
    pauseSim();
  } else {
    resumeSim();
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
    state.simElapsedSeconds = (state.simElapsedSeconds || 0) + dt;
    advanceSimMs(dt * 1000);

    // Periodic state snapshot for analyzer drift correction
    if (simMs - lastSnapshotSimMs >= SNAPSHOT_INTERVAL_MS) {
      lastSnapshotSimMs = simMs;
      recordStateSnapshot();
    }

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
    advanceSimMs(dt * 1000);
    if (simTimerEl) simTimerEl.textContent = formatRunDuration(state.simElapsedSeconds);

    // Periodic state snapshot for analyzer drift correction
    if (simMs - lastSnapshotSimMs >= SNAPSHOT_INTERVAL_MS) {
      lastSnapshotSimMs = simMs;
      recordStateSnapshot();
    }

    // Manager salary drain (registry-driven)
    tickManagers(dt);

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
  recordTelemetry("hire_worker", {
    workerType: "cultivator",
    count: state.cultivatorCount,
    cost,
  });
  recordTelemetry("currency_delta", {
    currency: "florins",
    delta: Number((-cost).toFixed(4)),
    reason: "hire_worker",
    workerType: "cultivator",
  });
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
  recordTelemetry("hire_worker", {
    workerType: "harvester",
    count: state.harvesterCount,
    cost,
  });
  recordTelemetry("currency_delta", {
    currency: "florins",
    delta: Number((-cost).toFixed(4)),
    reason: "hire_worker",
    workerType: "harvester",
  });
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
  recordTelemetry("hire_worker", {
    workerType: "presser",
    count: state.presserCount,
    cost,
  });
  recordTelemetry("currency_delta", {
    currency: "florins",
    delta: Number((-cost).toFixed(4)),
    reason: "hire_worker",
    workerType: "presser",
  });
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
if (analyzerBtn) {
  analyzerBtn.addEventListener("click", openAnalyzer);
}
if (analyzerBtnEra2) {
  analyzerBtnEra2.addEventListener("click", openAnalyzer);
}
if (analyzerBackBtn) {
  analyzerBackBtn.addEventListener("click", closeAnalyzer);
}
debugCloseBtn.addEventListener("click", closeDebug);
debugResetBtn.addEventListener("click", resetGame);
if (era2ResetBtn) {
  era2ResetBtn.addEventListener("click", resetGame);
}
if (era2SessionLogDownloadBtn) {
  era2SessionLogDownloadBtn.addEventListener("click", downloadSessionLog);
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
  syncSimulationPauseState();
});

window.addEventListener("blur", () => {
  syncSimulationPauseState();
});

window.addEventListener("focus", () => {
  syncSimulationPauseState();
});

// --- Background Sim Toggle ---
const bgSimToggleBtn = document.getElementById("bg-sim-toggle");
if (bgSimToggleBtn) {
  bgSimToggleBtn.addEventListener("click", () => {
    allowBackgroundSim = !allowBackgroundSim;
    bgSimToggleBtn.textContent = allowBackgroundSim ? "BG: On" : "BG: Off";
    syncSimulationPauseState();
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
lastSnapshotSimMs = simMs;
recordStateSnapshot();
initInvestments();
updateUI();
setShipUIIdle();

// Set manager salary displays from TUNING
for (const mgr of MANAGER_REGISTRY) {
  const el = document.getElementById(mgr.salaryElId);
  if (el) {
    const salary = TUNING.managers[mgr.tuningKey].salaryPerMin;
    el.textContent = "-" + salary.toFixed(2) + " fl/min";
  }
}

if (Number(state.era) < 2) {
  startLoop();
  startMarketLoop();
  logLine("Tree Groves prototype loaded. Trees grow olives automatically.");
} else {
  startEra2Loop();
}
syncSimulationPauseState();
