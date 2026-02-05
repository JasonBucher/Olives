// Prototype Template JS
// Storage convention (rename STORAGE_PREFIX when you copy this template into a new prototype)
import { computeHarvestOutcomeChances } from './harvestWeights.js';
import { TUNING } from './tuning.js';
import { INVESTMENTS } from './investments.js';

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
  "oilCount",
  "florinCount",
  "harvesterCount",
  "arboristHired",
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
    oilCount: 0,
    florinCount: 0,

    // Workers
    harvesterCount: 0,
    arboristHired: false,

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
  
  // Speed (use "normal" harvest as baseline: 4500ms)
  const baseHarvestMs = 4500;
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

// --- Shipping Config ---
const shippingConfig = {
  batchSize: 10,
  timeOutcomes: [
    { key: "fast", weight: 0.20, durationMs: 3000 },
    { key: "normal", weight: 0.60, durationMs: 5000 },
    { key: "slow", weight: 0.20, durationMs: 8000 },
  ],
  incidentOutcomes: [
    { key: "none", weight: 0.60, lostPct: 0.00, stolenPct: 0.00 },
    { key: "bumps", weight: 0.20, lostPct: 0.10, stolenPct: 0.00 },
    { key: "snack", weight: 0.10, lostPct: 0.05, stolenPct: 0.00 },
    { key: "bandits", weight: 0.10, lostPct: 0.00, stolenPct: 0.30 },
  ],
};

// --- Market Config ---
const marketConfig = {
  tickSeconds: TUNING.market.tickSeconds,
  olivePriceFlorins: TUNING.market.olivePriceFlorins,
  buyerOutcomes: [
    { key: "nonna", weight: 0.45, buyMin: 1, buyMax: 4 },
    { key: "regular", weight: 0.40, buyMin: 2, buyMax: 8 },
    { key: "giuseppe", weight: 0.15, buyAll: true },
  ],
  mishapOutcomes: [
    { key: "none", weight: 0.70 },
    { key: "urchin", weight: 0.15, stolenMin: 1, stolenMax: 3 },
    { key: "crow", weight: 0.10, stolenMin: 1, stolenMax: 2 },
    { key: "spoil", weight: 0.05, rottedMin: 1, rottedMax: 4 },
  ],
};

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

// --- Market Timer (not persisted) ---
let marketTickAcc = 0;

// --- Arborist Active State (computed each tick) ---
let arboristIsActive = false;

// --- DOM ---
const florinCountEl = document.getElementById("florin-count");
const treeOlivesEl = document.getElementById("tree-olives");
const treeCapacityEl = document.getElementById("tree-capacity");
const marketOliveCountEl = document.getElementById("market-olive-count");
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
const invTransitPill = document.getElementById("inv-olives-transit");
const invTransitCount = document.getElementById("inv-olives-transit-count");
const shipProgressBar = document.getElementById("ship-progress-bar");
const shipCountdown = document.getElementById("ship-countdown");
const shipProgressContainer = document.getElementById("ship-progress");
const shipOlivesBtn = document.getElementById("ship-olives-btn");

const harvesterCountEl = document.getElementById("harvester-count");
const hireHarvesterBtn = document.getElementById("hire-harvester-btn");
const hireHarvesterCostEl = document.getElementById("hire-harvester-cost");
const harvesterImpactEl = document.getElementById("harvester-impact");
const harvesterBadgeManager = document.getElementById("harvester-badge-manager");
const harvesterBadgeStatus = document.getElementById("harvester-badge-status");
const harvesterBadgeExtra = document.getElementById("harvester-badge-extra");
const harvesterDelta = document.getElementById("harvester-delta");

const arboristStatusEl = document.getElementById("arborist-status");
const managersEmptyEl = document.getElementById("managers-empty");
const managersArboristWrap = document.getElementById("managers-arborist");

// Debug UI
const debugBtn = document.getElementById("debug-btn");
const debugModal = document.getElementById("debug-modal");
const debugCloseBtn = document.getElementById("debug-close-btn");
const debugResetBtn = document.getElementById("debug-reset-btn");
const debugAddOlivesBtn = document.getElementById("debug-add-olives-btn");
const debugAddFlorinsBtn = document.getElementById("debug-add-florins-btn");
const debugAddOilBtn = document.getElementById("debug-add-oil-btn");

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

// --- Logging ---
function logLine(message) {
  const div = document.createElement("div");
  div.className = "line";
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
  const growth = state.treeGrowthPerSec * dt;
  state.treeOlives = Math.min(state.treeOlives + growth, state.treeCapacity);
}

// --- UI ---
function updateUI() {
  florinCountEl.textContent = state.florinCount.toFixed(2);
  treeOlivesEl.textContent = Math.floor(state.treeOlives);
  treeCapacityEl.textContent = state.treeCapacity;
  invOlivesQty.textContent = state.harvestedOlives;
  marketOliveCountEl.textContent = state.marketOlives;
  
  // Update ship button state based on inventory
  if (!isShipping) {
    shipOlivesBtn.disabled = state.harvestedOlives === 0;
  }

  // Update harvest button state and pill visibility
  if (!isHarvesting) {
    harvestBtn.disabled = false;
    harvestActionUI.setIdle({ resetBar: false });
  }

  // Update harvester UI
  harvesterCountEl.textContent = `x${state.harvesterCount}`;
  const harvesterCost = getHarvesterHireCost();
  hireHarvesterCostEl.textContent = harvesterCost;
  hireHarvesterBtn.disabled = state.florinCount < harvesterCost;
  
  // Update harvester hire delta (always visible, single line)
  const preview = calculateHarvesterHirePreview();
  
  // Format haul (integers)
  const haulText = `Haul +${preview.haul.current}→+${preview.haul.next}`;
  
  // Format speed (seconds with 1 decimal)
  const currentSpeedSec = (preview.speed.current / 1000).toFixed(1);
  const nextSpeedSec = (preview.speed.next / 1000).toFixed(1);
  const speedText = `Speed ${currentSpeedSec}s→${nextSpeedSec}s`;
  
  // Format poor (percentage, with NaN guard)
  let poorText;
  if (Number.isFinite(preview.poor.current) && Number.isFinite(preview.poor.next)) {
    const currentPct = (preview.poor.current * 100).toFixed(0);
    const nextPct = (preview.poor.next * 100).toFixed(0);
    poorText = `Poor ${currentPct}%→${nextPct}%`;
  } else {
    poorText = `Poor —→—`;
  }
  
  // Combine into single line with bullet separators
  harvesterDelta.textContent = ` ${haulText} • ${speedText} • ${poorText}`;
  
  // Update harvester impact (show harvest rate bonus)
  if (state.harvesterCount > 0) {
    const attemptBonus = getHarvesterAttemptBonus();
    const speedBonus = Math.round((1 - getHarvesterDurationMultiplier()) * 100);
    harvesterImpactEl.textContent = `+${attemptBonus} olives / harvest`;
  } else {
    harvesterImpactEl.textContent = "—";
  }
  
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

  // Toggle Managers section
  if (state.arboristHired) {
    managersEmptyEl.hidden = true;
    managersArboristWrap.hidden = false;
    arboristStatusEl.textContent = arboristIsActive ? "Active" : "Inactive (Unpaid)";
  } else {
    managersEmptyEl.hidden = false;
    managersArboristWrap.hidden = true;
  }
  
  // Update investment button states (state-aware previews)
  updateInvestmentButtons();

  // Toggle Production section visibility
  if (productionSection) {
    if (state.arboristHired) {
      productionSection.hidden = false;
    } else {
      productionSection.hidden = true;
    }
  }
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
  const adjustedOutcomes = computeHarvestOutcomeChances({
    outcomes: harvestConfig.outcomes,
    harvesterCount: state.harvesterCount,
    arboristIsActive: arboristIsActive,
    upgrades: state.upgrades,
    tuning: TUNING.harvest,
  });
  
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
  if (remaining > 0) {
    logLine(`Harvest (${outcomeLabel}, ${durationSec}s): attempted ${attempted}, collected ${collected}, lost ${lost} (${remaining} left on trees)`);
  } else {
    logLine(`Harvest (${outcomeLabel}, ${durationSec}s): attempted ${attempted}, collected ${collected}, lost ${lost}`);
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
  
  // Determine amount to ship
  const amount = Math.min(state.harvestedOlives, shippingConfig.batchSize);
  
  // Deduct from farm inventory immediately (loaded onto cart)
  state.harvestedOlives -= amount;
  
  // Roll time outcome and incident outcome
  const timeOutcome = rollWeighted(shippingConfig.timeOutcomes);
  const incidentOutcome = rollWeighted(shippingConfig.incidentOutcomes);
  
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

// --- Market System ---
function runMarketTick() {
  if (state.marketOlives <= 0) return;
  
  // Buyer step
  const buyer = rollWeighted(marketConfig.buyerOutcomes);
  let buyCount;
  
  if (buyer.buyAll) {
    buyCount = state.marketOlives;
  } else {
    // Random int between buyMin and buyMax
    buyCount = Math.floor(Math.random() * (buyer.buyMax - buyer.buyMin + 1)) + buyer.buyMin;
    buyCount = Math.min(buyCount, state.marketOlives);
  }
  
  state.marketOlives -= buyCount;
  const earned = buyCount * marketConfig.olivePriceFlorins;
  state.florinCount += earned;
  
  // Capitalize buyer name for display
  const buyerName = buyer.key.charAt(0).toUpperCase() + buyer.key.slice(1);
  marketLogLine(`Buyer (${buyerName}) bought ${buyCount} olives (+${earned} florins).`);
  
  // Mishap step (only if olives remain)
  if (state.marketOlives <= 0) return;
  
  const mishap = rollWeighted(marketConfig.mishapOutcomes);
  
  if (mishap.key === "none") {
    // No mishap, no log
    return;
  }
  
  if (mishap.key === "urchin" || mishap.key === "crow") {
    // Stolen mishap
    const stolenCount = Math.floor(Math.random() * (mishap.stolenMax - mishap.stolenMin + 1)) + mishap.stolenMin;
    const actualStolen = Math.min(stolenCount, state.marketOlives);
    state.marketOlives -= actualStolen;
    
    const mishapName = mishap.key.charAt(0).toUpperCase() + mishap.key.slice(1);
    marketLogLine(`Mishap (${mishapName}): ${actualStolen} olives stolen.`);
  } else if (mishap.key === "spoil") {
    // Rotted mishap
    const rottedCount = Math.floor(Math.random() * (mishap.rottedMax - mishap.rottedMin + 1)) + mishap.rottedMin;
    const actualRotted = Math.min(rottedCount, state.marketOlives);
    state.marketOlives -= actualRotted;
    
    marketLogLine(`Mishap (Spoil): ${actualRotted} olives rotted.`);
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
  
  INVESTMENTS.forEach(investment => {
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
    const isOwned = investment.id === "arborist" 
      ? state.arboristHired 
      : state.upgrades[investment.id];
    
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

    // Trees grow olives automatically
    growTrees(dt);
    
    // Auto-harvest if Arborist is active and trees are at capacity
    if (state.arboristHired && arboristIsActive && !isHarvesting && state.treeOlives >= state.treeCapacity) {
      startHarvest({ source: "auto" });
    }
    
    // Update harvest progress
    updateHarvestProgress();
    
    // Update ship progress
    updateShipProgress();
    
    // Market tick accumulator
    marketTickAcc += dt;
    while (marketTickAcc >= marketConfig.tickSeconds) {
      marketTickAcc -= marketConfig.tickSeconds;
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

hireHarvesterBtn.addEventListener("click", () => {
  const cost = getHarvesterHireCost();
  if (state.florinCount < cost) return;
  state.florinCount -= cost;
  state.harvesterCount += 1;
  saveGame();
  updateUI();
  logLine(`Hired Harvester (#${state.harvesterCount}) for ${cost} florins.`);
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
  state.oilCount += 100;
  saveGame();
  logLine("Debug: +100 oil");
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
startLoop();
logLine("Tree Groves prototype loaded. Trees grow olives automatically.");
