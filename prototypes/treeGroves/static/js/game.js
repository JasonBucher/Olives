// Prototype Template JS
// Storage convention (rename STORAGE_PREFIX when you copy this template into a new prototype)
const STORAGE_PREFIX = "treeGroves_";
const STORAGE_KEY = STORAGE_PREFIX + "gameState";

// --- Reset safety ---
// Prevents the "reset doesn't reset" bug where a still-running interval re-saves state.
let isResetting = false;
let mainLoopInterval = null;

// --- Game State ---
let state = {
  // Grove mechanics
  treeOlives: 0,
  treeCapacity: 25,
  treeGrowthPerSec: 0.25,
  
  // Player inventory
  harvestedOlives: 0,
  marketOlives: 0,
  oilCount: 0,
  florinCount: 0,

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

// --- DOM ---
const florinCountEl = document.getElementById("florin-count");
const treeOlivesEl = document.getElementById("tree-olives");
const treeCapacityEl = document.getElementById("tree-capacity");
const marketOliveCountEl = document.getElementById("market-olive-count");
const logEl = document.getElementById("log");
const marketLogEl = document.getElementById("market-log");

const harvestBtn = document.getElementById("harvest-btn");
const harvestProgressContainer = document.getElementById("harvest-progress-container");
const harvestProgressBar = document.getElementById("harvest-progress-bar");
const harvestCountdown = document.getElementById("harvest-countdown");

const invOlivesQty = document.getElementById("inv-olives-qty");
const shipProgressBar = document.getElementById("ship-progress-bar");
const shipProgressContainer = document.querySelector(".inv-progress");
const shipOlivesBtn = document.getElementById("ship-olives-btn");

// Debug UI
const debugBtn = document.getElementById("debug-btn");
const debugModal = document.getElementById("debug-modal");
const debugCloseBtn = document.getElementById("debug-close-btn");
const debugResetBtn = document.getElementById("debug-reset-btn");
const debugAddOlivesBtn = document.getElementById("debug-add-olives-btn");
const debugAddFlorinsBtn = document.getElementById("debug-add-florins-btn");
const debugAddOilBtn = document.getElementById("debug-add-oil-btn");

// --- Logging ---
function logLine(message) {
  const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const div = document.createElement("div");
  div.className = "line";
  div.textContent = `[${ts}] ${message}`;
  logEl.prepend(div);

  // Cap lines
  const maxLines = 60;
  while (logEl.children.length > maxLines) {
    logEl.removeChild(logEl.lastChild);
  }
}

function marketLogLine(message) {
  const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const div = document.createElement("div");
  div.className = "line";
  div.textContent = `[${ts}] ${message}`;
  marketLogEl.prepend(div);

  // Cap lines
  const maxLines = 60;
  while (marketLogEl.children.length > maxLines) {
    marketLogEl.removeChild(marketLogEl.lastChild);
  }
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
  florinCountEl.textContent = state.florinCount;
  treeOlivesEl.textContent = Math.floor(state.treeOlives);
  treeCapacityEl.textContent = state.treeCapacity;
  invOlivesQty.textContent = state.harvestedOlives;
  marketOliveCountEl.textContent = state.marketOlives;
  
  // Update ship button state based on inventory
  if (!isShipping) {
    shipOlivesBtn.disabled = state.harvestedOlives === 0;
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

function startHarvest() {
  if (isHarvesting) return;
  if (state.treeOlives < 1) {
    logLine("No olives to harvest");
    return;
  }
  
  // Determine batch
  const attempted = Math.min(Math.floor(state.treeOlives), harvestConfig.batchSize);
  
  // Select outcome
  const outcome = selectWeightedOutcome();
  
  // Start job
  isHarvesting = true;
  harvestJob = {
    startTimeMs: Date.now(),
    durationMs: outcome.durationMs,
    attempted,
    outcome,
  };
  
  // Update UI
  harvestBtn.disabled = true;
  harvestProgressContainer.style.display = "block";
  harvestProgressBar.style.width = "0%";
  harvestCountdown.style.display = "block";
  
  logLine(`Starting harvest: attempting ${attempted} olives`);
}

function completeHarvest() {
  const { attempted, outcome } = harvestJob;
  
  // Calculate results
  const collected = Math.floor(attempted * outcome.collectedPct);
  const lost = Math.floor(attempted * outcome.lostPct);
  const remaining = attempted - collected - lost;
  
  // Apply changes
  state.treeOlives -= (collected + lost);
  state.harvestedOlives += collected;
  
  // Log outcome
  const outcomeLabel = outcome.key.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());
  if (remaining > 0) {
    logLine(`Harvest (${outcomeLabel}): attempted ${attempted}, collected ${collected}, lost ${lost} (${remaining} left on trees)`);
  } else {
    logLine(`Harvest (${outcomeLabel}): attempted ${attempted}, collected ${collected}, lost ${lost}`);
  }
  
  // Reset state
  isHarvesting = false;
  
  // Hide progress UI after brief delay
  setTimeout(() => {
    harvestProgressContainer.style.display = "none";
    harvestProgressBar.style.width = "0%";
    harvestCountdown.style.display = "none";
    harvestBtn.disabled = false;
  }, 150);
  
  saveGame();
  updateUI();
}

function updateHarvestProgress() {
  if (!isHarvesting) return;
  
  const now = Date.now();
  const elapsed = now - harvestJob.startTimeMs;
  const progress = Math.min(1, elapsed / harvestJob.durationMs);
  const remaining = Math.max(0, (harvestJob.durationMs - elapsed) / 1000);
  
  harvestProgressBar.style.width = (progress * 100) + "%";
  harvestCountdown.textContent = Math.ceil(remaining) + "s";
  
  if (elapsed >= harvestJob.durationMs) {
    completeHarvest();
  }
}

// --- Shipping System ---
// Thin inline UI helpers
function setShipUIIdle() {
  shipProgressBar.style.width = "0%";
  shipProgressContainer.classList.remove("active");
  shipOlivesBtn.disabled = state.harvestedOlives === 0 || isShipping;
}

function setShipUIActive(percent) {
  shipProgressContainer.classList.add("active");
  shipProgressBar.style.width = percent + "%";
  shipOlivesBtn.disabled = true;
}

function setShipUIDone() {
  shipProgressBar.style.width = "100%";
  
  // Reset after brief delay
  setTimeout(() => {
    shipProgressContainer.classList.remove("active");
    shipProgressBar.style.width = "0%";
    setShipUIIdle();
  }, 600);
}

function setShipUIFailed() {
  // Reset after brief delay
  setTimeout(() => {
    shipProgressContainer.classList.remove("active");
    shipProgressBar.style.width = "0%";
    setShipUIIdle();
  }, 600);
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
  setShipUIActive(0);
  
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
  if (arrived === 0) {
    setShipUIFailed();
  } else {
    setShipUIDone();
  }
  
  saveGame();
  updateUI();
}

function updateShipProgress() {
  if (!isShipping) return;
  
  const now = Date.now();
  const elapsed = now - shipJob.startTimeMs;
  const progress = Math.min(1, elapsed / shipJob.durationMs);
  
  // Update progress bar
  const progressPct = Math.floor(progress * 100);
  setShipUIActive(progressPct);
  
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

// --- Main Loop ---
function startLoop() {
  const tickMs = 200;

  let last = Date.now();
  mainLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;

    // Trees grow olives automatically
    growTrees(dt);
    
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

// --- Init ---
loadGame();
updateUI();
setShipUIIdle();
startLoop();
logLine("Tree Groves prototype loaded. Trees grow olives automatically.");
