// Prototype Template JS
// Storage convention (rename STORAGE_PREFIX when you copy this template into a new prototype)

import { TUNING } from "./tuning.js";
import * as Calc from "./gameCalc.js";
import { INVESTMENTS } from "./investments.js";
import { createDomLogger } from "./logger.js";

const STORAGE_PREFIX = "TEMPLATE_";
const STORAGE_KEY = STORAGE_PREFIX + "gameState";

// --- Persisted State ---
// Only keys listed here are saved to / loaded from localStorage.
// Add new keys here AND in createDefaultState() when extending the game.
const PERSISTED_STATE_KEYS = [
  "oliveCount",
  "oilCount",
  "florinCount",
  "sharperPickOwned",
  "meta",
];

function createDefaultState() {
  return {
    oliveCount: 0,
    oilCount: 0,
    florinCount: 0,
    sharperPickOwned: false,

    // Click tracking for OPS (transient — not persisted)
    olivesPickedThisWindow: 0,
    clickWindowSeconds: 5,
    lastClickTimestamps: [],

    meta: {
      createdAt: null,
      version: "template",
    },
  };
}

function buildPersistedState(state) {
  const out = {};
  for (const key of PERSISTED_STATE_KEYS) {
    if (key in state) out[key] = state[key];
  }
  return out;
}

function pickPersistedState(parsed) {
  const out = {};
  for (const key of PERSISTED_STATE_KEYS) {
    if (key in parsed) out[key] = parsed[key];
  }
  return out;
}

// --- Reset safety ---
// Prevents the "reset doesn't reset" bug where a still-running interval re-saves state.
let isResetting = false;
let mainLoopInterval = null;

// --- Game State ---
let state = createDefaultState();

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
const logLine = createDomLogger({
  container: logEl,
  maxLines: 60,
  timestamp: "locale",
});

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
    const persisted = pickPersistedState(parsed);
    // Shallow merge so missing fields get defaults
    state = { ...state, ...persisted, meta: { ...state.meta, ...(persisted.meta || {}) } };
  } catch (e) {
    console.warn("Failed to parse saved game state. Starting fresh.", e);
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
  oliveCountEl.textContent = String(Calc.getDisplayCount(state.oliveCount));
  opsCountEl.textContent = Calc.formatRate(computeOps());
}

// --- Actions ---
function pickOlive() {
  state.oliveCount += TUNING.production.baseClickYield;
  recordClick();
  saveGame();
  updateUI();
}

// --- Main Loop ---
function startLoop() {
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
  }, TUNING.production.tickMs);
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
