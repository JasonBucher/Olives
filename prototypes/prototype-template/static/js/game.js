// Prototype Template JS
// Storage convention (rename STORAGE_PREFIX when you copy this template into a new prototype)
const STORAGE_PREFIX = "TEMPLATE_";
const STORAGE_KEY = STORAGE_PREFIX + "gameState";

// Prefer time + outcomes over instant conversion.
// Logs explain loss/delay/causality; they aren’t cosmetic.
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rollWeighted(outcomes) {
  const totalWeight = outcomes.reduce((sum, entry) => sum + (entry.weight || 0), 0);
  if (totalWeight <= 0) return outcomes[0];

  let roll = Math.random() * totalWeight;
  for (const entry of outcomes) {
    roll -= entry.weight || 0;
    if (roll <= 0) return entry;
  }
  return outcomes[outcomes.length - 1];
}

// --- Reset safety ---
// Prevents the "reset doesn't reset" bug where a still-running interval re-saves state.
let isResetting = false;
let mainLoopInterval = null;

// --- Game State ---
let state = {
  oliveCount: 0,
  oilCount: 0,
  florinCount: 0,

  // Click tracking for OPS
  olivesPickedThisWindow: 0,
  clickWindowSeconds: 5,
  lastClickTimestamps: [],

  // For future expansion
  meta: {
    createdAt: null,
    version: "template",
  },
};

// --- DOM ---
const oliveCountEl = document.getElementById("olive-count");
const opsCountEl = document.getElementById("ops-count");
const logEl = document.getElementById("log");

const pickOliveBtn = document.getElementById("pick-olive-btn");

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

// --- OPS (click-based) ---
function recordClick() {
  const now = Date.now();
  state.lastClickTimestamps.push(now);

  // Remove clicks older than window
  const cutoff = now - state.clickWindowSeconds * 1000;
  while (state.lastClickTimestamps.length && state.lastClickTimestamps[0] < cutoff) {
    state.lastClickTimestamps.shift();
  }
}

function computeOps() {
  // This template only tracks click-based OPS; add passive sources later.
  const now = Date.now();
  const cutoff = now - state.clickWindowSeconds * 1000;
  // Ensure timestamps are pruned (in case of long dt)
  state.lastClickTimestamps = state.lastClickTimestamps.filter(t => t >= cutoff);
  const clickRate = state.lastClickTimestamps.length / state.clickWindowSeconds;
  return clickRate; // olives per second from clicks
}

// --- UI ---
function updateUI() {
  oliveCountEl.textContent = String(state.oliveCount);
  opsCountEl.textContent = computeOps().toFixed(1);
}

// --- Actions ---
function pickOlive() {
  state.oliveCount += 1;
  recordClick();
  saveGame();
  updateUI();
}

// --- Main Loop ---
function startLoop() {
  const tickMs = 200;

  let last = Date.now();
  mainLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;

    // Future: passive production, timers, shipments, etc.
    // Keep template minimal for now.

    // UI refresh (OPS updates even if idle)
    updateUI();

    // Save occasionally if desired. Keeping it light:
    // saveGame();
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
pickOliveBtn.addEventListener("click", pickOlive);

debugBtn.addEventListener("click", openDebug);
debugCloseBtn.addEventListener("click", closeDebug);
debugResetBtn.addEventListener("click", resetGame);

debugAddOlivesBtn.addEventListener("click", () => {
  state.oliveCount += 100;
  saveGame();
  updateUI();
  logLine("Debug: +100 olives");
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
logLine("Loaded prototype template.");
