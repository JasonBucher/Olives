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

// --- Harvest Job State (not persisted) ---
let isHarvesting = false;
let harvestJob = {
  startTimeMs: 0,
  durationMs: 0,
  attempted: 0,
  outcome: null,
};

// --- DOM ---
const treeOlivesEl = document.getElementById("tree-olives");
const treeCapacityEl = document.getElementById("tree-capacity");
const harvestedOlivesEl = document.getElementById("harvested-olives");
const logEl = document.getElementById("log");

const harvestBtn = document.getElementById("harvest-btn");
const harvestProgressContainer = document.getElementById("harvest-progress-container");
const harvestProgressBar = document.getElementById("harvest-progress-bar");
const harvestCountdown = document.getElementById("harvest-countdown");

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
  treeOlivesEl.textContent = Math.floor(state.treeOlives);
  treeCapacityEl.textContent = state.treeCapacity;
  harvestedOlivesEl.textContent = state.harvestedOlives;
}

// --- Harvest System ---
function selectWeightedOutcome() {
  const totalWeight = harvestConfig.outcomes.reduce((sum, o) => sum + o.weight, 0);
  let roll = Math.random() * totalWeight;
  
  for (const outcome of harvestConfig.outcomes) {
    roll -= outcome.weight;
    if (roll <= 0) return outcome;
  }
  
  // Fallback (shouldn't happen)
  return harvestConfig.outcomes[2]; // normal
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
startLoop();
logLine("Tree Groves prototype loaded. Trees grow olives automatically.");
