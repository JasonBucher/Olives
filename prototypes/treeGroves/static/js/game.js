// Prototype Template JS
// Storage convention (rename STORAGE_PREFIX when you copy this template into a new prototype)
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
let state = {
  // Grove mechanics
  treeOlives: 0,
  treeCapacity: 25,
  treeGrowthPerSec: 1.0,
  
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

// --- Harvest Config (upgrade-tweakable) ---
const harvestConfig = {
  batchSize: 10,
  outcomes: [
    { key: "interrupted_short", weight: 0.10, durationMs: 2000, collectedPct: 0.30, lostPct: 0.00 },
    { key: "poor", weight: 0.25, durationMs: 5500, collectedPct: 0.50, lostPct: 0.50 },
    { key: "normal", weight: 0.55, durationMs: 4500, collectedPct: 0.80, lostPct: 0.20 },
    { key: "efficient", weight: 0.10, durationMs: 3500, collectedPct: 1.00, lostPct: 0.00 },
  ],
};

// --- Upgrades Registry ---
const UPGRADES = [
  {
    id: "standardized_tools",
    title: "Standardized Tools",
    desc: "Quality tools reduce Poor harvests.",
    cost: 75,
    prereqs: [],
  },
  {
    id: "training_program",
    title: "Training Program",
    desc: "Trained harvesters make fewer mistakes.",
    cost: 150,
    prereqs: [],
  },
  {
    id: "selective_picking",
    title: "Selective Picking",
    desc: "Better technique improves Efficient harvests.",
    cost: 200,
    prereqs: [],
  },
  {
    id: "ladders_nets",
    title: "Ladders & Nets",
    desc: "Equipment scales efficiency with team size.",
    cost: 300,
    prereqs: [],
  },
  {
    id: "quality_inspector",
    title: "Quality Inspector",
    desc: "Expert oversight maximizes Arborist benefits.",
    cost: 500,
    prereqs: ["arborist"],
  },
];

// --- Harvester Hire Cost ---
function getHarvesterHireCost() {
  // Escalating linear cost (tweakable later)
  return 10 + (state.harvesterCount * 5);
}

// --- Harvester Effects ---
function getHarvesterAttemptBonus() {
  const count = state.harvesterCount;
  if (count === 0) return 0;
  
  let bonus = 0;
  // 1-5: +1 each
  bonus += Math.min(count, 5) * 1;
  // 6-10: +0.5 each
  if (count > 5) bonus += Math.min(count - 5, 5) * 0.5;
  // 11+: +0.25 each
  if (count > 10) bonus += (count - 10) * 0.25;
  
  return Math.floor(bonus);
}

function getHarvesterDurationMultiplier() {
  // Each harvester reduces duration by 4%, capped at 25% total reduction
  const reductionPct = Math.min(state.harvesterCount * 0.04, 0.25);
  return 1 - reductionPct;
}

function getHarvesterPoorWeightDelta() {
  // +0.01 per harvester, reduced by 50% if arborist is active
  let multiplier = arboristIsActive ? 0.5 : 1;
  
  // training_program reduces the per-harvester poor delta
  if (state.upgrades.training_program) {
    multiplier *= 0.5;
  }
  
  return state.harvesterCount * 0.01 * multiplier;
}

// --- Upgrade Effect Helpers ---
function getPoorFlatReductionWeight() {
  // standardized_tools reduces Poor weight by flat amount
  return state.upgrades.standardized_tools ? 0.08 : 0;
}

function getEfficientBonusWeight() {
  let bonus = 0;
  
  // Arborist base bonus
  if (arboristIsActive) {
    bonus += 0.05;
  }
  
  // selective_picking adds flat Efficient bonus
  if (state.upgrades.selective_picking) {
    bonus += 0.06;
  }
  
  // ladders_nets adds Efficient bonus scaling with harvesters (capped)
  if (state.upgrades.ladders_nets) {
    const scaledBonus = Math.min(state.harvesterCount * 0.01, 0.08);
    bonus += scaledBonus;
  }
  
  // quality_inspector amplifies Arborist benefits
  if (state.upgrades.quality_inspector && arboristIsActive) {
    bonus += 0.08;
  }
  
  return bonus;
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
  tickSeconds: 12,
  olivePriceFlorins: 1,
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

const arboristStatusEl = document.getElementById("arborist-status");
const upgradeArboristBtn = document.getElementById("upgrade-arborist-btn");
const upgradeArboristCostEl = document.getElementById("upgrade-arborist-cost");
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
  if (!raw) {
    // Fresh start
    state.meta.createdAt = new Date().toISOString();
    saveGame(); // create key immediately so it's easy to see in DevTools
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    // Shallow merge so missing fields get defaults
    state = { ...state, ...parsed, meta: { ...state.meta, ...(parsed.meta || {}) } };
  } catch (e) {
    console.warn("Failed to parse saved game state. Starting fresh.", e);
    state.meta.createdAt = new Date().toISOString();
    saveGame();
  }
}

function saveGame() {
  if (isResetting) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

  // Toggle Upgrades - Hire Arborist
  const upgradeArborist = document.getElementById("upgrade-arborist");
  if (state.arboristHired) {
    upgradeArborist.hidden = true;
  } else {
    upgradeArborist.hidden = false;
    upgradeArboristBtn.disabled = state.florinCount < 50;
  }
  
  // Update upgrade button states (not full re-render)
  updateUpgradeButtons();

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
  
  // Create adjusted outcome weights for harvester mistakes and upgrades
  // Compute explicit deltas relative to base weights
  const poorWeightDelta = getHarvesterPoorWeightDelta();
  const poorFlatReduction = getPoorFlatReductionWeight();
  const deltaPoor = poorWeightDelta - poorFlatReduction;
  const deltaEff = getEfficientBonusWeight();
  
  const adjustedOutcomes = harvestConfig.outcomes.map(o => {
    if (o.key === "poor") {
      // Apply delta to Poor
      return { ...o, weight: Math.max(0, o.weight + deltaPoor) };
    } else if (o.key === "efficient") {
      // Apply delta to Efficient
      return { ...o, weight: Math.max(0, o.weight + deltaEff) };
    } else if (o.key === "normal") {
      // Normal compensates to conserve probability mass
      // If poor increases by X and efficient by Y, normal must decrease by (X + Y)
      return { ...o, weight: Math.max(0, o.weight - deltaPoor - deltaEff) };
    } else {
      // interrupted_short and others remain unchanged
      return { ...o };
    }
  });
  
  // Select outcome with adjusted weights
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

// --- Upgrade System ---
function canBuyUpgrade(id) {
  const upgrade = UPGRADES.find(u => u.id === id);
  if (!upgrade) return false;
  
  // Already owned
  if (state.upgrades[id]) return false;
  
  // Can't afford
  if (state.florinCount < upgrade.cost) return false;
  
  // Check prerequisites
  for (const prereq of upgrade.prereqs) {
    if (prereq === "arborist" && !state.arboristHired) return false;
    if (prereq !== "arborist" && !state.upgrades[prereq]) return false;
  }
  
  return true;
}

function buyUpgrade(id) {
  if (!canBuyUpgrade(id)) return false;
  
  const upgrade = UPGRADES.find(u => u.id === id);
  state.florinCount -= upgrade.cost;
  state.upgrades[id] = true;
  
  saveGame();
  updateUI();
  logLine(`Purchased upgrade: ${upgrade.title}`);
  return true;
}

function initUpgrades() {
  const container = document.getElementById("upgrades-container");
  if (!container) return;
  
  container.innerHTML = "";
  
  UPGRADES.forEach(upgrade => {
    const div = document.createElement("div");
    div.className = "upgrade-item";
    div.id = `upgrade-${upgrade.id}-item`;
    
    const btn = document.createElement("button");
    btn.className = "upgrade-pill";
    btn.type = "button";
    btn.id = `upgrade-${upgrade.id}-btn`;
    btn.textContent = `${upgrade.title} — ${upgrade.cost} florins`;
    
    // Add click handler
    btn.addEventListener("click", () => {
      buyUpgrade(upgrade.id);
    });
    
    div.appendChild(btn);
    
    // Add description below button
    const desc = document.createElement("div");
    desc.className = "upgrade-desc";
    desc.textContent = upgrade.desc;
    div.appendChild(desc);
    
    container.appendChild(div);
  });
}

function updateUpgradeButtons() {
  UPGRADES.forEach(upgrade => {
    const item = document.getElementById(`upgrade-${upgrade.id}-item`);
    const btn = document.getElementById(`upgrade-${upgrade.id}-btn`);
    
    if (!item || !btn) return;
    
    // Hide if already owned
    if (state.upgrades[upgrade.id]) {
      item.style.display = "none";
      return;
    }
    
    // Show and update disabled state
    item.style.display = "";
    btn.disabled = !canBuyUpgrade(upgrade.id);
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
      const salaryPerSec = 0.2 / 60;
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

upgradeArboristBtn.addEventListener("click", () => {
  const cost = 50;
  if (state.arboristHired) return;
  if (state.florinCount < cost) return;
  state.florinCount -= cost;
  state.arboristHired = true;
  saveGame();
  updateUI();
  logLine("Hired Arborist (salary 0.2 florins/min).");
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
initUpgrades();
updateUI();
setShipUIIdle();
startLoop();
logLine("Tree Groves prototype loaded. Trees grow olives automatically.");
