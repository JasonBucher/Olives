// Prototype Template JS
// Storage convention (rename STORAGE_PREFIX when you copy this template into a new prototype)
import { computeHarvestOutcomeChances } from './harvestWeights.js';
import { computePressOutcomeChances } from './pressWeights.js';
import { TUNING } from './tuning.js';
import { INVESTMENTS } from './investments.js';
import { formatSignedInt, formatSignedPct, formatSignedSeconds, joinStatPills } from './format.js';

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
  "oliveOilCount",
  "florinCount",
  "farmHandCount",
  "harvesterCount",
  "presserCount",
  "arboristHired",
  "foremanHired",
  "pressManagerHired",
  "upgrades",
  "meta",
];

function createDefaultState() {
  return {
    // Grove mechanics
    treeOlives: 0,
    treeCapacity: TUNING.grove.treeCapacity,
    treeGrowthPerSec: TUNING.grove.treeGrowthPerSec,

    // Player inventory
    harvestedOlives: 0,
    marketOlives: 0,
    marketOliveOil: 0,
    oliveOilCount: 0,
    florinCount: 0,

    // Workers
    farmHandCount: 0,
    harvesterCount: 0,
    presserCount: 0,
    arboristHired: false,
    foremanHired: false,
    pressManagerHired: false,

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

// --- Farm Hand Hire Cost ---
function getFarmHandHireCost() {
  const count = state.farmHandCount;
  const baseCost = TUNING.workers.farmHand.baseCost;
  const threshold = TUNING.workers.farmHand.costScaleThreshold;
  
  if (count < threshold) {
    return baseCost + (count * TUNING.workers.farmHand.costScaleLow);
  } else {
    // Cost at threshold + additional cost for workers beyond threshold
    const costAtThreshold = baseCost + (threshold * TUNING.workers.farmHand.costScaleLow);
    const beyondThreshold = count - threshold;
    return costAtThreshold + (beyondThreshold * TUNING.workers.farmHand.costScaleHigh);
  }
}

// --- Farm Hand Effects ---
function getFarmHandGrowthMultiplier() {
  let bonusPct = state.farmHandCount * TUNING.workers.farmHand.growthBonusPct;
  
  // Apply Foreman multiplier to the bonus if Foreman is active
  if (state.foremanHired && foremanIsActive) {
    bonusPct *= TUNING.managers.foreman.growthMultiplier;
  }
  
  return 1 + bonusPct;
}

function getFarmHandCapacityBonus() {
  const bonusPerWorker = TUNING.workers.farmHand.capacityBonusPerWorker;
  const maxBonus = TUNING.workers.farmHand.capacityBonusCap;
  return Math.min(state.farmHandCount * bonusPerWorker, maxBonus);
}

function calculateFarmHandHirePreview() {
  const currentCount = state.farmHandCount;
  const nextCount = currentCount + 1;
  
  // Growth speed
  const currentGrowthMult = 1 + (currentCount * TUNING.workers.farmHand.growthBonusPct);
  const nextGrowthMult = 1 + (nextCount * TUNING.workers.farmHand.growthBonusPct);
  const baseGrowth = TUNING.grove.treeGrowthPerSec;
  const currentGrowth = baseGrowth * currentGrowthMult;
  const nextGrowth = baseGrowth * nextGrowthMult;
  
  // Capacity bonus
  const bonusPerWorker = TUNING.workers.farmHand.capacityBonusPerWorker;
  const maxBonus = TUNING.workers.farmHand.capacityBonusCap;
  const currentCapacityBonus = Math.min(currentCount * bonusPerWorker, maxBonus);
  const nextCapacityBonus = Math.min(nextCount * bonusPerWorker, maxBonus);
  
  return {
    growth: { current: currentGrowth, next: nextGrowth },
    capacityBonus: { current: currentCapacityBonus, next: nextCapacityBonus }
  };
}

// --- Harvester Hire Cost ---
function getHarvesterHireCost() {
  return TUNING.workers.harvester.baseCost + (state.harvesterCount * TUNING.workers.harvester.costScale);
}

// --- Harvester Effects ---
function getHarvesterAttemptBonus() {
  const count = state.harvesterCount;
  if (count === 0) return 0;
  
  const tiers = TUNING.workers.harvester.attemptBonusTiers;
  let bonus = 0;
  // Tier 1: 1-5
  bonus += Math.min(count, tiers.tier1.max) * tiers.tier1.bonus;
  // Tier 2: 6-10
  if (count > tiers.tier1.max) {
    bonus += Math.min(count - tiers.tier1.max, tiers.tier2.max - tiers.tier1.max) * tiers.tier2.bonus;
  }
  // Tier 3: 11+
  if (count > tiers.tier2.max) bonus += (count - tiers.tier2.max) * tiers.tier3.bonus;
  
  return Math.floor(bonus);
}

function getHarvesterDurationMultiplier() {
  const reductionPct = Math.min(
    state.harvesterCount * TUNING.workers.harvester.durationReductionPct,
    TUNING.workers.harvester.durationReductionCap
  );
  return 1 - reductionPct;
}

function calculateHarvesterHirePreview() {
  const currentCount = state.harvesterCount;
  const nextCount = currentCount + 1;
  
  // Haul (attempt bonus)
  const currentHaul = getHarvesterAttemptBonus();
  // Temporarily increment count to calculate next bonus
  const prevCount = state.harvesterCount;
  state.harvesterCount = nextCount;
  const nextHaul = getHarvesterAttemptBonus();
  state.harvesterCount = prevCount; // Restore
  
  // Speed (derive baseline from configured "normal" outcome)
  const baseHarvestMs = getBaselineHarvestDurationMs();
  const currentMultiplier = 1 - Math.min(
    currentCount * TUNING.workers.harvester.durationReductionPct,
    TUNING.workers.harvester.durationReductionCap
  );
  const nextMultiplier = 1 - Math.min(
    nextCount * TUNING.workers.harvester.durationReductionPct,
    TUNING.workers.harvester.durationReductionCap
  );
  const currentSpeed = baseHarvestMs * currentMultiplier;
  const nextSpeed = baseHarvestMs * nextMultiplier;
  
  // Poor chance (actual probability, not just weight)
  // Use the normalized chance computation as single source of truth
  const currentChances = computeHarvestOutcomeChances({
    outcomes: harvestConfig.outcomes,
    harvesterCount: currentCount,
    arboristIsActive: arboristIsActive,
    upgrades: state.upgrades,
    tuning: TUNING.harvest,
  });
  
  const nextChances = computeHarvestOutcomeChances({
    outcomes: harvestConfig.outcomes,
    harvesterCount: nextCount,
    arboristIsActive: arboristIsActive,
    upgrades: state.upgrades,
    tuning: TUNING.harvest,
  });
  
  // Find poor outcome and extract normalized chance (already 0..1)
  const currentPoorOutcome = currentChances.find(o => o.key === "poor");
  const nextPoorOutcome = nextChances.find(o => o.key === "poor");
  const currentPoorChance = currentPoorOutcome?.weight ?? 0;
  const nextPoorChance = nextPoorOutcome?.weight ?? 0;
  
  // These should always be finite due to normalization, but keep defensive check
  const safeCurrentPoor = Number.isFinite(currentPoorChance) ? currentPoorChance : 0;
  const safeNextPoor = Number.isFinite(nextPoorChance) ? nextPoorChance : 0;
  
  return {
    haul: { current: currentHaul, next: nextHaul },
    speed: { current: currentSpeed, next: nextSpeed },
    poor: { current: safeCurrentPoor, next: safeNextPoor }
  };
}

// --- Presser Hire Cost ---
function getPresserHireCost() {
  return TUNING.workers.presser.baseCost + (state.presserCount * TUNING.workers.presser.costScale);
}

// --- Presser Effects ---
// Active state for Press Manager (computed each tick)
let pressManagerIsActive = false;

// Active state for Foreman (computed each tick)
let foremanIsActive = false;

/**
 * Calculate pressing capacity for a given presser count (pure function).
 * Uses logarithmic scaling: capacity = base + (log(1 + count) / logScale) * capacityPerLog
 * Note: Press Manager no longer affects capacity (affects outcome quality instead)
 */
function getPressingCapacityForCount(count) {
  const baseCapacity = TUNING.workers.presser.baseCapacity;
  
  if (count === 0) return baseCapacity;
  
  const logScale = TUNING.workers.presser.logScale;
  const capacityPerLog = TUNING.workers.presser.capacityPerLog;
  
  // Logarithmic scaling: log(1 + count) for smooth diminishing returns
  const logFactor = Math.log(1 + count) / logScale;
  const variableCapacity = logFactor * capacityPerLog;
  
  return Math.floor(baseCapacity + variableCapacity);
}

/**
 * Get current pressing capacity based on current state.
 */
function getPressingCapacity() {
  return getPressingCapacityForCount(state.presserCount);
}

function calculatePresserHirePreview() {
  const currentCount = state.presserCount;
  const nextCount = currentCount + 1;
  
  // Use pure helper to avoid state mutation
  const currentCapacity = getPressingCapacityForCount(currentCount);
  const nextCapacity = getPressingCapacityForCount(nextCount);
  
  return {
    capacity: { current: currentCapacity, next: nextCapacity }
  };
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
  
  // Add bonuses from purchased upgrades
  const upgrades = TUNING.investments.shippingEfficiency.oliveOil;
  for (let i = 0; i < upgrades.length; i++) {
    const upgradeId = `olive_oil_ship_efficiency_${upgrades[i].idSuffix}`;
    if (state.upgrades[upgradeId]) {
      capacity += upgrades[i].capacityBonus;
    }
  }
  
  return capacity;
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
  outcome: null,
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

// --- Market Timer (not persisted) ---
let marketTickAcc = 0;

// --- Arborist Active State (computed each tick) ---
let arboristIsActive = false;

// --- DOM ---
const florinCountEl = document.getElementById("florin-count");
const treeOlivesEl = document.getElementById("tree-olives");
const treeCapacityEl = document.getElementById("tree-capacity");
const treeGrowthRateEl = document.getElementById("tree-growth-rate");
const marketOliveCountEl = document.getElementById("market-olive-count");
const marketOilCountEl = document.getElementById("market-oil-count");
const logEl = document.getElementById("log");
const marketLogEl = document.getElementById("market-log");

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

const pressBtn = document.getElementById("press-btn");
const pressPill = document.getElementById("press-pill");
const pressPillCount = document.getElementById("press-pill-count");
const pressProgressContainer = document.getElementById("press-progress");
const pressProgressBar = document.getElementById("press-progress-bar");
const pressCountdown = document.getElementById("press-countdown");

const farmHandCountEl = document.getElementById("farm-hand-count");
const hireFarmHandBtn = document.getElementById("hire-farm-hand-btn");
const hireFarmHandCostEl = document.getElementById("hire-farm-hand-cost");
const farmHandImpactEl = document.getElementById("farm-hand-impact");
const farmHandBadgeManager = document.getElementById("farm-hand-badge-manager");
const farmHandBadgeStatus = document.getElementById("farm-hand-badge-status");
const farmHandBadgeExtra = document.getElementById("farm-hand-badge-extra");
const farmHandDelta = document.getElementById("farm-hand-delta");

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

// --- Logging ---
function logLine(message, color = null) {
  const div = document.createElement("div");
  div.className = "line";
  if (color) {
    div.classList.add(`log-${color}`);
  }
  div.textContent = message;
  logEl.prepend(div);

  // Cap lines
  const maxLines = 60;
  while (logEl.children.length > maxLines) {
    logEl.removeChild(logEl.lastChild);
  }
}

function marketLogLine(message) {
  const div = document.createElement("div");
  div.className = "line";
  div.textContent = message;
  marketLogEl.prepend(div);

  // Cap lines
  const maxLines = 60;
  while (marketLogEl.children.length > maxLines) {
    marketLogEl.removeChild(marketLogEl.lastChild);
  }
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

  localStorage.removeItem(STORAGE_KEY);

  // Cache-bust reload (useful on GitHub Pages)
  window.location.href = window.location.pathname + "?t=" + Date.now();
}

// --- Tree Growth ---
function growTrees(dt) {
  const growthMultiplier = getFarmHandGrowthMultiplier();
  const growth = state.treeGrowthPerSec * growthMultiplier * dt;
  const currentCapacity = TUNING.grove.treeCapacity + getFarmHandCapacityBonus();
  state.treeOlives = Math.min(state.treeOlives + growth, currentCapacity);
}

// --- UI ---
function updateUI() {
  florinCountEl.textContent = state.florinCount.toFixed(2);
  treeOlivesEl.textContent = Math.floor(state.treeOlives);
  const currentTreeCapacity = TUNING.grove.treeCapacity + getFarmHandCapacityBonus();
  treeCapacityEl.textContent = currentTreeCapacity;
  
  // Display growth rate (olives/sec)
  const growthRate = TUNING.grove.treeGrowthPerSec * getFarmHandGrowthMultiplier();
  treeGrowthRateEl.textContent = `(${growthRate.toFixed(2)}/s)`;
  
  invOlivesQty.textContent = state.harvestedOlives;
  invOliveOilQty.textContent = state.oliveOilCount || 0;
  marketOliveCountEl.textContent = state.marketOlives;
  marketOilCountEl.textContent = state.marketOliveOil || 0;
  
  // Update ship button state based on inventory
  if (!isShipping) {
    shipOlivesBtn.disabled = state.harvestedOlives === 0;
    shipOlivesBtn.textContent = `Ship (up to ${getOliveShippingCapacity()})`;
  }

  // Update oil ship button state based on inventory
  if (!isShippingOliveOil) {
    shipOliveOilBtn.disabled = state.oliveOilCount === 0;
    shipOliveOilBtn.textContent = `Ship (up to ${getOliveOilShippingCapacity()})`;
  }

  // Update press button state based on inventory and capacity
  const pressingCapacity = getPressingCapacity();
  if (!isPressing) {
    pressBtn.disabled = state.harvestedOlives === 0;
    // Update button text to show capacity (but allow partial pressing)
    pressBtn.textContent = `Press (up to ${pressingCapacity})`;
  }

  // Update harvest button state and pill visibility
  if (!isHarvesting) {
    harvestBtn.disabled = false;
    harvestActionUI.setIdle({ resetBar: false });
  }

  // Update farm hand UI
  farmHandCountEl.textContent = `x${state.farmHandCount}`;
  const farmHandCost = getFarmHandHireCost();
  hireFarmHandCostEl.textContent = farmHandCost;
  hireFarmHandBtn.disabled = state.florinCount < farmHandCost;
  
  // Update farm hand stats and preview
  const farmHandPreview = calculateFarmHandHirePreview();
  const baseGrowth = TUNING.grove.treeGrowthPerSec;
  const baseCapacity = TUNING.grove.treeCapacity;
  
  // Top row: Current stats
  if (state.farmHandCount > 0) {
    const currentGrowth = farmHandPreview.growth.current;
    const currentCapacityBonus = farmHandPreview.capacityBonus.current;
    
    const growthStat = `Growth ${formatSignedInt(Math.floor((currentGrowth - baseGrowth) * 10))} per 10s`;
    const capacityStat = `Capacity ${formatSignedInt(currentCapacityBonus)}`;
    
    farmHandImpactEl.textContent = joinStatPills([growthStat, capacityStat]);
  } else {
    farmHandImpactEl.textContent = "—";
  }
  
  // Bottom row: Next hire delta
  const growthDelta = farmHandPreview.growth.next - farmHandPreview.growth.current;
  const farmHandCapacityDelta = farmHandPreview.capacityBonus.next - farmHandPreview.capacityBonus.current;
  
  const growthDeltaStat = `Growth ${formatSignedInt(Math.floor(growthDelta * 10))} per 10s`;
  const farmHandCapacityDeltaStat = `Capacity ${formatSignedInt(farmHandCapacityDelta)}`;
  
  farmHandDelta.textContent = `Next: ${joinStatPills([growthDeltaStat, farmHandCapacityDeltaStat])}`;
  
  // Update farm hand badges
  // Badge slot 1: Foreman coverage
  if (foremanIsActive) {
    farmHandBadgeManager.textContent = "Mgr";
    farmHandBadgeManager.style.visibility = "visible";
  } else {
    farmHandBadgeManager.textContent = "";
    farmHandBadgeManager.style.visibility = "hidden";
  }
  
  // Badge slot 2: Status modifier (for future use)
  farmHandBadgeStatus.textContent = "";
  farmHandBadgeStatus.style.visibility = "hidden";
  
  // Badge slot 3: Extra modifier (for future use)
  farmHandBadgeExtra.textContent = "";
  farmHandBadgeExtra.style.visibility = "hidden";

  // Update harvester UI
  harvesterCountEl.textContent = `x${state.harvesterCount}`;
  const harvesterCost = getHarvesterHireCost();
  hireHarvesterCostEl.textContent = harvesterCost;
  hireHarvesterBtn.disabled = state.florinCount < harvesterCost;
  
  // Update harvester stats and preview (sign-driven display)
  const preview = calculateHarvesterHirePreview();
  const baseHarvestMs = getBaselineHarvestDurationMs(); // Derive from configured "normal" outcome
  
  // Top row: Current stats (sign-driven)
  if (state.harvesterCount > 0) {
    const currentBatch = preview.haul.current;
    const currentSpeedReduction = (baseHarvestMs - preview.speed.current) / 1000; // Reduction in seconds
    const currentPoor = preview.poor.current;
    
    const batchStat = `Batch ${formatSignedInt(currentBatch)}`;
    const speedStat = `Speed ${formatSignedSeconds(-currentSpeedReduction)}`; // Negative = faster/reduction
    const poorStat = `Poor ${formatSignedPct(currentPoor)}`;
    
    harvesterImpactEl.textContent = joinStatPills([batchStat, speedStat, poorStat]);
  } else {
    harvesterImpactEl.textContent = "—";
  }
  
  // Bottom row: Next hire deltas (sign-driven)
  const batchDelta = preview.haul.next - preview.haul.current;
  const currentSpeedReduction = (baseHarvestMs - preview.speed.current) / 1000;
  const nextSpeedReduction = (baseHarvestMs - preview.speed.next) / 1000;
  const speedDelta = nextSpeedReduction - currentSpeedReduction; // Additional reduction
  const poorDelta = preview.poor.next - preview.poor.current;
  
  const batchDeltaStat = `Batch ${formatSignedInt(batchDelta)}`;
  const speedDeltaStat = `Speed ${formatSignedSeconds(-speedDelta)}`; // Negative = more reduction
  const poorDeltaStat = `Poor ${formatSignedPct(poorDelta)}`;
  
  harvesterDelta.textContent = `Next: ${joinStatPills([batchDeltaStat, speedDeltaStat, poorDeltaStat])}`;
  
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
  
  // Update presser stats and preview
  const presserPreview = calculatePresserHirePreview();
  const basePressingCapacity = TUNING.workers.presser.baseCapacity;
  
  // Top row: Current capacity bonus (not total)
  if (state.presserCount > 0) {
    const currentCapacity = presserPreview.capacity.current;
    const capacityBonus = currentCapacity - basePressingCapacity;
    const capacityStat = `Capacity ${formatSignedInt(capacityBonus)}`;
    presserImpactEl.textContent = capacityStat;
  } else {
    presserImpactEl.textContent = "—";
  }
  
  // Bottom row: Next hire delta
  const presserCapacityDelta = presserPreview.capacity.next - presserPreview.capacity.current;
  const presserCapacityDeltaStat = `Capacity ${formatSignedInt(presserCapacityDelta)}`;
  presserDelta.textContent = `Next: ${presserCapacityDeltaStat}`;
  
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
  const anyManagerHired = state.arboristHired || state.foremanHired || state.pressManagerHired;
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

// --- Debug Helper: Current Press Outcome Chances ---
/**
 * Get the current normalized press outcome chances used by the game.
 * This is the single source of truth for press probabilities.
 * @returns {Array} Normalized outcomes with weight property representing probabilities (0..1)
 */
function getCurrentPressOutcomeChances() {
  return computePressOutcomeChances({
    outcomes: TUNING.production.olivePress.outcomes,
    presserCount: state.presserCount,
    pressManagerIsActive: state.pressManagerHired && pressManagerIsActive,
    upgrades: state.upgrades,
    tuning: TUNING.production.olivePress,
  });
}

// --- Harvest System ---
function selectWeightedOutcome() {
  return rollWeighted(harvestConfig.outcomes);
}

function startHarvest(opts = {}) {
  if (isHarvesting) return;
  if (state.treeOlives < 1) {
    logLine("No olives to harvest");
    return;
  }
  
  // Determine batch with harvester bonus
  const effectiveBatchSize = harvestConfig.batchSize + getHarvesterAttemptBonus();
  const attempted = Math.min(Math.floor(state.treeOlives), effectiveBatchSize);
  
  // Use normalized chances from single source of truth
  const adjustedOutcomes = getCurrentHarvestOutcomeChances();
  
  // Log the probabilities used for this harvest (debug visibility)
  const chancesLog = adjustedOutcomes
    .map(o => `${o.key}=${o.weight.toFixed(3)}`)
    .join(' ');
  logLine(`Chances at harvest: ${chancesLog}`);
  
  // Select outcome with normalized chances (weights now represent probabilities 0..1)
  const outcome = rollWeighted(adjustedOutcomes);
  
  // Apply harvester speed bonus to duration
  const effectiveDurationMs = Math.floor(outcome.durationMs * getHarvesterDurationMultiplier());
  
  // Start job
  isHarvesting = true;
  harvestJob = {
    startTimeMs: Date.now(),
    durationMs: effectiveDurationMs,
    attempted,
    outcome,
  };
  
  // Update UI
  harvestBtn.disabled = true;
  harvestActionUI.start({ count: attempted, percent: 0 });
  
  // Show harvest pill with attempting count
  harvestPill.classList.remove("inline-fade-out");
  
  if (opts.source === "auto") {
    logLine("Arborist ordered harvest (trees at capacity).");
  } else {
    logLine(`Starting harvest (H: ${state.harvesterCount}): attempting ${attempted} olives`);
  }
}

function completeHarvest() {
  const { attempted, outcome, durationMs } = harvestJob;
  
  // Calculate results
  const collected = Math.floor(attempted * outcome.collectedPct);
  const lost = Math.floor(attempted * outcome.lostPct);
  const remaining = attempted - collected - lost;
  
  // Apply changes
  state.treeOlives -= (collected + lost);
  state.harvestedOlives += collected;
  
  // Log outcome
  const outcomeLabel = outcome.key.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());
  const durationSec = (durationMs / 1000).toFixed(2);
  
  // Determine color based on outcome
  let logColor = null;
  if (outcome.key === 'poor') logColor = 'red';
  else if (outcome.key === 'efficient') logColor = 'green';
  else if (outcome.key.startsWith('interrupted')) logColor = 'orange';
  
  if (remaining > 0) {
    logLine(`Harvest (${outcomeLabel}, ${durationSec}s): attempted ${attempted}, collected ${collected}, lost ${lost} (${remaining} left on trees)`, logColor);
  } else {
    logLine(`Harvest (${outcomeLabel}, ${durationSec}s): attempted ${attempted}, collected ${collected}, lost ${lost}`, logColor);
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
  shipOlivesBtn.disabled = state.harvestedOlives === 0 || isShipping;
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
  
  if (state.harvestedOlives < 1) {
    logLine("No harvested olives to ship");
    return;
  }
  
  // Determine amount to ship (use capacity helper)
  const amount = Math.min(state.harvestedOlives, getOliveShippingCapacity());
  
  // Deduct from farm inventory immediately (loaded onto cart)
  state.harvestedOlives -= amount;
  
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
  
  const pressingCapacity = getPressingCapacity();
  
  // Use the minimum of pressing capacity and available olives
  const olivesToPress = Math.min(pressingCapacity, state.harvestedOlives);
  
  // Allow partial pressing - just need at least 1 olive
  if (olivesToPress <= 0) {
    logLine("Not enough olives to press");
    return;
  }
  
  // Get current press outcome chances and roll
  const adjustedOutcomes = getCurrentPressOutcomeChances();
  const outcome = rollWeighted(adjustedOutcomes);
  
  // Deduct olives immediately
  state.harvestedOlives -= olivesToPress;
  
  // Set up press job
  pressJob = {
    startTimeMs: Date.now(),
    durationMs: TUNING.production.olivePress.baseDurationMs,
    olivesConsumed: olivesToPress,
    outcome: outcome,
  };
  
  isPressing = true;
  
  // Update inline UI
  pressActionUI.start({ count: olivesToPress, percent: 0 });
  pressBtn.disabled = true;
  
  saveGame();
  updateUI();
}

function completePressing() {
  // Calculate expected oil using outcome yield multiplier
  const oilPerOlive = TUNING.production.olivePress.oilPerPress / TUNING.production.olivePress.olivesPerPress;
  const yieldMultiplier = pressJob.outcome?.yieldMultiplier || 1.0;
  const expectedOil = pressJob.olivesConsumed * oilPerOlive * yieldMultiplier;
  
  // Apply stochastic rounding: "swim" to handle fractional oil
  const floor = Math.floor(expectedOil);
  const frac = expectedOil - floor;
  const producedOil = floor + (Math.random() < frac ? 1 : 0);
  
  state.oliveOilCount += producedOil;
  
  isPressing = false;
  pressActionUI.end();
  
  const outcomeName = pressJob.outcome?.key || 'unknown';
  
  // Determine color based on outcome
  let logColor = null;
  if (outcomeName === 'poor') logColor = 'red';
  else if (outcomeName === 'good') logColor = 'green';
  else if (outcomeName === 'excellent' || outcomeName === 'masterwork') logColor = 'gold';
  
  logLine(`Pressed ${pressJob.olivesConsumed} olives: ${outcomeName} outcome, expected=${expectedOil.toFixed(2)}, produced=${producedOil}`, logColor);
  
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
  
  // Ensure oliveOilCount is a valid number
  if (!state.oliveOilCount || state.oliveOilCount < 1) {
    logLine("No olive oil to ship");
    return;
  }
  
  // Determine amount to ship (use capacity helper)
  const amount = Math.min(state.oliveOilCount, getOliveOilShippingCapacity());
  
  // Deduct from inventory immediately (loaded onto cart)
  state.oliveOilCount = (state.oliveOilCount || 0) - amount;
  
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

// --- Market System ---
function runMarketTick() {
  // Check if any goods are available
  const hasOlives = state.marketOlives > 0;
  const hasOil = (state.marketOliveOil || 0) > 0;
  
  if (!hasOlives && !hasOil) return;
  
  // Randomly choose which good to process this tick
  let goodType;
  if (hasOlives && hasOil) {
    // Both available, randomly pick one
    goodType = Math.random() < 0.5 ? 'olives' : 'oil';
  } else {
    // Only one available
    goodType = hasOlives ? 'olives' : 'oil';
  }
  
  // Get inventory and price for chosen good
  const inventory = goodType === 'olives' ? state.marketOlives : state.marketOliveOil;
  const price = goodType === 'olives' ? TUNING.market.prices.olivesFlorins : TUNING.market.prices.oliveOilFlorins;
  const goodName = goodType === 'olives' ? 'olives' : 'olive oil';
  
  // Buyer step
  const buyer = rollWeighted(TUNING.market.buyerOutcomes);
  let buyCount;
  
  if (buyer.buyAll) {
    buyCount = inventory;
  } else {
    // Random int between buyMin and buyMax
    buyCount = Math.floor(Math.random() * (buyer.buyMax - buyer.buyMin + 1)) + buyer.buyMin;
    buyCount = Math.min(buyCount, inventory);
  }
  
  // Deduct from inventory
  if (goodType === 'olives') {
    state.marketOlives -= buyCount;
  } else {
    state.marketOliveOil = (state.marketOliveOil || 0) - buyCount;
  }
  const earned = buyCount * price;
  state.florinCount += earned;
  
  // Capitalize buyer name for display
  const buyerName = buyer.key.charAt(0).toUpperCase() + buyer.key.slice(1);
  marketLogLine(`Buyer (${buyerName}) bought ${buyCount} ${goodName} (+${earned} florins).`);
  
  // Mishap step (only if goods remain)
  const remainingInventory = goodType === 'olives' ? state.marketOlives : (state.marketOliveOil || 0);
  if (remainingInventory <= 0) return;
  
  const mishap = rollWeighted(TUNING.market.mishapOutcomes);
  
  if (mishap.key === "none") {
    // No mishap, no log
    return;
  }
  
  if (mishap.key === "urchin" || mishap.key === "crow") {
    // Stolen mishap
    const stolenCount = Math.floor(Math.random() * (mishap.stolenMax - mishap.stolenMin + 1)) + mishap.stolenMin;
    const actualStolen = Math.min(stolenCount, remainingInventory);
    const mishapName = mishap.key.charAt(0).toUpperCase() + mishap.key.slice(1);
    
    if (goodType === 'olives') {
      state.marketOlives -= actualStolen;
    } else {
      state.marketOliveOil = (state.marketOliveOil || 0) - actualStolen;
    }
    marketLogLine(`Mishap (${mishapName}): ${actualStolen} ${goodName} stolen.`);
  } else if (mishap.key === "spoil") {
    // Rotted mishap
    const rottedCount = Math.floor(Math.random() * (mishap.rottedMax - mishap.rottedMin + 1)) + mishap.rottedMin;
    const actualRotted = Math.min(rottedCount, remainingInventory);
    const mishapName = mishap.key.charAt(0).toUpperCase() + mishap.key.slice(1);
    
    if (goodType === 'olives') {
      state.marketOlives -= actualRotted;
    } else {
      state.marketOliveOil = (state.marketOliveOil || 0) - actualRotted;
    }
    marketLogLine(`Mishap (${mishapName}): ${actualRotted} ${goodName} rotted.`);
  }
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
    const costValue = investment.cost(TUNING, state);
    cost.textContent = `${costValue} florins`;
    
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
    btn.addEventListener("click", () => {
      buyInvestment(investment.id);
    });
    
    container.appendChild(btn);
  });
}

function updateInvestmentButtons() {
  INVESTMENTS.forEach(investment => {
    const btn = document.getElementById(`inv-${investment.id}`);
    if (!btn) return;
    
    // Hide if owned
    let isOwned = false;
    if (investment.id === "arborist") {
      isOwned = state.arboristHired;
    } else if (investment.id === "foreman") {
      isOwned = state.foremanHired;
    } else if (investment.id === "pressManager") {
      isOwned = state.pressManagerHired;
    } else {
      isOwned = state.upgrades[investment.id];
    }
    
    if (isOwned) {
      btn.style.display = "none";
      return;
    }
    
    // Show and update disabled state
    btn.style.display = "";
    btn.disabled = !investment.canPurchase(state, TUNING);
    
    // Update effect lines for state-aware previews
    const effectsEl = btn.querySelector(".inv__effects");
    if (effectsEl) {
      effectsEl.innerHTML = "";
      const effectLines = investment.effectLines(state, TUNING);
      effectLines.forEach(line => {
        const effectEl = document.createElement("div");
        effectEl.className = "inv__effect";
        if (line.startsWith("Requires:") || line.startsWith("Ongoing:")) {
          effectEl.classList.add("inv__effect--muted");
        }
        effectEl.textContent = line;
        effectsEl.appendChild(effectEl);
      });
    }
  });
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
  
  isSimPaused = false;
  pausedAtMs = 0;
  
  // Restart the loop
  startLoop();
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
    const currentTreeCapacity = TUNING.grove.treeCapacity + getFarmHandCapacityBonus();
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
    
    // Market tick accumulator
    marketTickAcc += dt;
    while (marketTickAcc >= TUNING.market.tickSeconds) {
      marketTickAcc -= TUNING.market.tickSeconds;
      runMarketTick();
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

hireFarmHandBtn.addEventListener("click", () => {
  const cost = getFarmHandHireCost();
  if (state.florinCount < cost) return;
  state.florinCount -= cost;
  state.farmHandCount += 1;
  saveGame();
  updateUI();
  logLine(`Hired Farm Hand (#${state.farmHandCount}) for ${cost} florins.`);
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
  logEl.innerHTML = '';
});

clearMarketLogBtn.addEventListener("click", () => {
  marketLogEl.innerHTML = '';
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

// Set press manager salary from TUNING (display as negative cost)
const pressManagerSalary = TUNING.managers.pressManager.salaryPerMin;
pressManagerSalaryEl.textContent = "-" + pressManagerSalary.toFixed(2) + " fl/min";

startLoop();
logLine("Tree Groves prototype loaded. Trees grow olives automatically.");
