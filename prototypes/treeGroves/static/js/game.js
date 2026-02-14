// Prototype Template JS
// Storage convention (rename STORAGE_PREFIX when you copy this template into a new prototype)
import { computeHarvestOutcomeChances } from './harvestWeights.js';
import { TUNING } from './tuning.js';
import { INVESTMENTS } from './investments.js';
import { initLogger, logPlayer, logDebug, logEvent, clearLog } from './logger.js';
import { getMarketEvents, MARKET_EVENT_SETTINGS } from './marketEvents.js';

const STORAGE_PREFIX = "treeGroves_";
const STORAGE_KEY = STORAGE_PREFIX + "gameState";

// --- Reset safety ---
// Prevents the "reset doesn't reset" bug where a still-running interval re-saves state.
let isResetting = false;
let mainLoopInterval = null;

// --- Pause state ---
// Pauses simulation completely when tab loses focus
let isSimPaused = false;
let pausedAtMs = 0;

// --- Game State ---
const PERSISTED_STATE_KEYS = [
  "treeOlives",
  "harvestedOlives",
  "marketOlives",
  "marketOliveOil",
  "marketAutosellRateUpgrades",
  "marketLanesPurchased",
  "marketPriceUpgrades",
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
  "autoPressUnlocked",
  "autoShipOilUnlocked",
  "stone",
  "upgrades",
  "meta",
];

function createDefaultState() {
  return {
    // Grove mechanics
    treeOlives: TUNING.grove.treeCapacity,
    treeCapacity: TUNING.grove.treeCapacity,
    treeGrowthPerSec: TUNING.grove.treeGrowthPerSec,

    // Player inventory
    harvestedOlives: 0,
    marketOlives: 0,
    marketOliveOil: 0,
    marketAutosellRateUpgrades: 0,
    marketLanesPurchased: 0,
    marketPriceUpgrades: 0,
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
    autoPressUnlocked: false,
    autoShipOilUnlocked: false,

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

// --- Harvest Config (upgrade-tweakable) ---
const harvestConfig = {
  batchSize: TUNING.harvest.baseBatchSize,
  outcomes: TUNING.harvest.outcomes,
};

// --- Baseline Harvest Duration Helper ---
/**
 * Get baseline harvest duration from "normal" outcome.
 * Used for computing speed reductions in UI displays.
 * @returns {number} Duration in milliseconds
 */
function getBaselineHarvestDurationMs() {
  const normalOutcome = harvestConfig.outcomes.find(o => o.key === 'normal');
  // Fallback to 4500 only if "normal" outcome missing (should not happen in practice)
  return normalOutcome ? normalOutcome.durationMs : 4500;
}

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
  const bonusPerOlive = state.presserCount * TUNING.workers.presser.oilPerOlivePerPresser;
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
let marketEventAcc = 0;
let activeMarketEvent = null;
const marketEventCooldowns = {};

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

// Debug UI
const debugBtn = document.getElementById("debug-btn");
const debugModal = document.getElementById("debug-modal");
const debugCloseBtn = document.getElementById("debug-close-btn");
const debugResetBtn = document.getElementById("debug-reset-btn");
const debugAddOlivesBtn = document.getElementById("debug-add-olives-btn");
const debugAddFlorinsBtn = document.getElementById("debug-add-florins-btn");
const debugAddOilBtn = document.getElementById("debug-add-oil-btn");
const debugHarvestChancesEl = document.getElementById("debug-harvest-chances");

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
function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const defaults = createDefaultState();
  if (!raw) {
    // Fresh start
    state = defaults;
    state.meta.createdAt = new Date().toISOString();
    saveGame(); // create key immediately so it's easy to see in DevTools
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const persisted = pickPersistedState(parsed);
    // Shallow merge so missing fields get defaults
    state = { ...defaults, ...persisted, meta: { ...defaults.meta, ...(persisted.meta || {}) } };

    if (!state.meta.createdAt) {
      state.meta.createdAt = new Date().toISOString();
    }
  } catch (e) {
    console.warn("Failed to parse saved game state. Starting fresh.", e);
    state = defaults;
    state.meta.createdAt = new Date().toISOString();
    saveGame();
  }
}

function saveGame() {
  if (isResetting) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedState(state)));
}

function resetGame() {
  if (!confirm("Reset this prototype? All progress for this prototype will be lost.")) return;

  isResetting = true;
  if (mainLoopInterval) clearInterval(mainLoopInterval);
  stopMarketLoop();

  localStorage.removeItem(STORAGE_KEY);

  // Cache-bust reload (useful on GitHub Pages)
  window.location.href = window.location.pathname + "?t=" + Date.now();
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

// --- UI ---
function updateUI() {
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
  const maxOlivesPerAction = (state.olivePressCount || 1) * TUNING.press.olivesPerPress;
  const currentOilBonus = maxOlivesPerAction * state.presserCount * oilBonusPerPresser;
  const nextOilBonus = maxOlivesPerAction * oilBonusPerPresser;
  
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
  // Harvest attempt amount = base batch size (scaled by grove capacity) + harvester bonus
  // Must return a float (harvester bonus can be fractional)
  // Must never return less than 0
  const currentCapacity = TUNING.grove.treeCapacity + getGroveExpansionBonus();
  const capacityScale = currentCapacity / TUNING.grove.treeCapacity;
  return Math.max(0, harvestConfig.batchSize * capacityScale + getHarvesterOlivesBonus());
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
    logLine("Arborist ordered harvest (trees at capacity).");
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

function getMarketAutosellBaseRate() {
  const baseRate = TUNING.market.autosell.baseRatePerSecond;
  const upgradeRate = TUNING.market.autosell.rateUpgradeAmount * getMarketAutosellRateUpgrades();
  return Math.max(0, baseRate + upgradeRate);
}

function getMarketAutosellRatePerSecond() {
  return getMarketAutosellBaseRate() * getMarketAutosellLanes();
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
    state.florinCount += earned;
  }

  return earned;
}

function resolveMarketEventDurationSeconds(eventDef) {
  const duration = eventDef.durationSeconds;
  if (duration === undefined || duration === null) return 0;
  if (typeof duration === "number") return duration;
  if (typeof duration === "object") {
    const min = duration.min ?? 0;
    const max = duration.max ?? min;
    if (max <= min) return min;
    return min + Math.random() * (max - min);
  }
  return 0;
}

function getActiveMarketModifiers() {
  const defaults = {
    autosellPaused: false,
    autosellRateMultiplier: 1,
    priceMultiplier: 1,
    uiStatus: null,
    uiSuffix: null,
  };

  if (!activeMarketEvent) return defaults;

  const modifiers = activeMarketEvent.def.modifiers || {};
  const ui = activeMarketEvent.def.ui || {};

  return {
    autosellPaused: !!modifiers.autosellPaused,
    autosellRateMultiplier: modifiers.autosellRateMultiplier ?? 1,
    priceMultiplier: modifiers.priceMultiplier ?? 1,
    uiStatus: ui.status || null,
    uiSuffix: ui.suffix || null,
  };
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

  const baseRate = getMarketAutosellRatePerSecond();
  const effectiveRate = Math.max(0, baseRate * modifiers.autosellRateMultiplier);

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

  const baseRate = getMarketAutosellRatePerSecond();
  const effectiveRate = Math.max(0, baseRate * modifiers.autosellRateMultiplier);
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

function canTriggerMarketEvent(eventDef, nowMs, totalInventory) {
  const lastTriggered = marketEventCooldowns[eventDef.id] || 0;
  const cooldownMs = (eventDef.cooldownSeconds || 0) * 1000;
  if (cooldownMs > 0 && nowMs - lastTriggered < cooldownMs) return false;
  if (eventDef.requiresInventory && totalInventory <= 0) return false;
  return true;
}

function logMarketEventStart(eventDef) {
  if (!eventDef.log || !eventDef.log.start) return;
  logEvent({ channel: "market", playerText: eventDef.log.start, debugText: eventDef.log.start });
}

function logMarketEventEnd(eventDef) {
  if (!eventDef.log || !eventDef.log.end) return;
  logEvent({ channel: "market", playerText: eventDef.log.end, debugText: eventDef.log.end });
}

function formatMarketPurchaseLine(buyerName, olives, oil, earned, boughtAll = false) {
  const parts = [];
  if (olives > 0) parts.push(`${olives} olives`);
  if (oil > 0) parts.push(`${oil} olive oil`);
  const goodsText = parts.length ? parts.join(" and ") : "nothing";
  const prefix = boughtAll ? `${buyerName} purchased all market goods` : `${buyerName} purchased`;
  return `${prefix}: ${goodsText} (+${formatFlorins(earned)} florins).`;
}

function executeMarketEventAction(eventDef) {
  const action = eventDef.action;
  if (!action) return null;

  const { olives, oil, total } = getMarketInventoryCounts();
  if (total <= 0) {
    marketLogLine(`${eventDef.name} found nothing to buy.`);
    return { olives: 0, oil: 0, earned: 0 };
  }

  if (action.type === "bulkBuy") {
    const target = Math.min(action.quantity || 0, total);
    if (target <= 0) {
      marketLogLine(`${eventDef.name} found nothing to buy.`);
      return { olives: 0, oil: 0, earned: 0 };
    }
    const allocation = splitMarketSaleUnits(target, olives, oil);
    const earned = applyMarketSale(allocation, getActiveMarketModifiers().priceMultiplier);
    marketLogLine(formatMarketPurchaseLine(eventDef.name, allocation.olives, allocation.oil, earned, false));
    return { ...allocation, earned };
  }

  if (action.type === "buyAll") {
    const allocation = { olives, oil };
    const earned = applyMarketSale(allocation, getActiveMarketModifiers().priceMultiplier);
    marketLogLine(formatMarketPurchaseLine(eventDef.name, allocation.olives, allocation.oil, earned, true));
    return { ...allocation, earned };
  }

  return null;
}

function startMarketEvent(eventDef, nowMs) {
  const durationSeconds = resolveMarketEventDurationSeconds(eventDef);
  activeMarketEvent = {
    def: eventDef,
    startedAtMs: nowMs,
    endsAtMs: nowMs + (durationSeconds * 1000),
  };

  marketEventCooldowns[eventDef.id] = nowMs;
  marketEventAcc = 0;

  logMarketEventStart(eventDef);

  if (eventDef.action) {
    executeMarketEventAction(eventDef);
  }

  updateMarketAutosellUI();

  if (durationSeconds <= 0) {
    endMarketEvent();
  }
}

function endMarketEvent() {
  if (!activeMarketEvent) return;
  const eventDef = activeMarketEvent.def;

  activeMarketEvent = null;
  marketEventAcc = 0;

  logMarketEventEnd(eventDef);
  updateMarketAutosellUI();
}

function tryStartMarketEvent(nowMs) {
  if (activeMarketEvent) return;

  const inventory = getMarketInventoryCounts();
  const events = getMarketEvents(state, TUNING);
  const eligible = events.filter((eventDef) => (
    canTriggerMarketEvent(eventDef, nowMs, inventory.total)
  ));
  if (eligible.length === 0) return;

  if (Math.random() > MARKET_EVENT_SETTINGS.spawnChance) return;

  const selected = rollWeighted(eligible);
  startMarketEvent(selected, nowMs);
}

function startMarketLoop() {
  if (marketLoopInterval) return;

  marketLoopLastMs = Date.now();
  marketLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = (now - marketLoopLastMs) / 1000;
    marketLoopLastMs = now;

    if (activeMarketEvent && now >= activeMarketEvent.endsAtMs) {
      endMarketEvent();
    }

    if (!activeMarketEvent) {
      marketEventAcc += dt;
      if (marketEventAcc >= MARKET_EVENT_SETTINGS.checkEverySeconds) {
        marketEventAcc -= MARKET_EVENT_SETTINGS.checkEverySeconds;
        tryStartMarketEvent(now);
      }
    }

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
  
  const success = investment.purchase(state, TUNING);
  if (success) {
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
  if (investment.id === "build_olive_press") {
    return (state.olivePressCount || 1) - 1 >= TUNING.investments.olivePressExpansion.maxAdditionalPresses;
  }
  if (investment.id === "auto_press") {
    return !!state.autoPressUnlocked;
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
  startLoop();
  startMarketLoop();
}

// --- Main Loop ---
function startLoop() {
  // Prevent multiple intervals
  if (mainLoopInterval) return;
  
  const tickMs = 200;

  let last = Date.now();
  mainLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;

    // Arborist salary drain
    if (state.arboristHired) {
      const salaryPerSec = TUNING.managers.arborist.salaryPerMin / 60;
      const costThisTick = salaryPerSec * dt;
      if (state.florinCount >= costThisTick) {
        state.florinCount -= costThisTick;
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
        state.florinCount -= costThisTick;
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
        state.florinCount -= costThisTick;
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
        state.florinCount -= costThisTick;
        foremanIsActive = true;
      } else {
        foremanIsActive = false;
      }
    } else {
      foremanIsActive = false;
    }

    // Trees grow olives automatically
    growTrees(dt);
    
    // Auto-harvest if Arborist is active and trees are at capacity
    const currentTreeCapacity = TUNING.grove.treeCapacity + getGroveExpansionBonus();
    if (state.arboristHired && arboristIsActive && !isHarvesting && state.treeOlives >= currentTreeCapacity) {
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

    // Auto-press if upgrade purchased and Press Manager is active
    if (state.autoPressUnlocked && pressManagerIsActive && !isPressing && getOlivesToPress() >= TUNING.press.olivesPerPress) {
      startPressing();
    }

    // Auto-ship oil if upgrade purchased and Press Manager is active
    if (state.autoShipOilUnlocked && pressManagerIsActive && !isShippingOliveOil && getShippableCount(state.oliveOilCount || 0) >= 1) {
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
  // Capture current harvest chances as snapshot
  updateDebugHarvestChances();
  
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
  state.florinCount -= cost;
  state.cultivatorCount += 1;
  saveGame();
  updateUI();
  logLine(`Hired Cultivator (#${state.cultivatorCount}) for ${cost} florins.`);
});

hireHarvesterBtn.addEventListener("click", () => {
  const cost = getHarvesterHireCost();
  if (state.florinCount < cost) return;
  state.florinCount -= cost;
  state.harvesterCount += 1;
  saveGame();
  updateUI();
  logLine(`Hired Harvester (#${state.harvesterCount}) for ${cost} florins.`);
});

hirePresserBtn.addEventListener("click", () => {
  const cost = getPresserHireCost();
  if (state.florinCount < cost) return;
  state.florinCount -= cost;
  state.presserCount += 1;
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

debugBtn.addEventListener("click", openDebug);
debugCloseBtn.addEventListener("click", closeDebug);
debugResetBtn.addEventListener("click", resetGame);

debugAddOlivesBtn.addEventListener("click", () => {
  state.harvestedOlives += 100;
  saveGame();
  updateUI();
  logLine("Debug: +100 harvested olives");
});

debugAddFlorinsBtn.addEventListener("click", () => {
  state.florinCount += 100;
  saveGame();
  logLine("Debug: +100 florins");
});

debugAddOilBtn.addEventListener("click", () => {
  state.oliveOilCount += 100;
  saveGame();
  logLine("Debug: +100 olive oil");
});

const debugAddStoneBtn = document.getElementById("debug-add-stone-btn");
debugAddStoneBtn.addEventListener("click", () => {
  state.stone += 100;
  saveGame();
  updateUI();
  logLine("Debug: +100 stone");
});

// Close modal on outside click
debugModal.addEventListener("click", (e) => {
  if (e.target === debugModal) closeDebug();
});

// --- Visibility/Focus Event Listeners ---
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseSim();
  } else {
    resumeSim();
  }
});

window.addEventListener("blur", () => {
  pauseSim();
});

window.addEventListener("focus", () => {
  if (document.hidden) return; // Let visibilitychange handle it
  resumeSim();
});

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

startLoop();
startMarketLoop();
logLine("Tree Groves prototype loaded. Trees grow olives automatically.");
