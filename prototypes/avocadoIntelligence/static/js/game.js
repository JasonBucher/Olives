// Avocado Intelligence — main game loop and state

import { TUNING } from "./tuning.js";
import * as Calc from "./gameCalc.js";
import { INVESTMENTS } from "./investments.js";

const STORAGE_PREFIX = "AVO_";
const STORAGE_KEY = STORAGE_PREFIX + "gameState";

// --- Persisted State ---
// Only keys listed here are saved to / loaded from localStorage.
// Add new keys here AND in createDefaultState() when extending the game.
const PERSISTED_STATE_KEYS = [
  "avocadoCount",
  "totalAvocados",
  "prestigeCount",
  "prestigeMultiplier",
  "meta",
];

function createDefaultState() {
  return {
    avocadoCount: 0,
    totalAvocados: 0,
    prestigeCount: 0,
    prestigeMultiplier: 1.0,

    // Click tracking for APS (transient — not persisted)
    clickWindowSeconds: 5,
    lastClickTimestamps: [],

    meta: {
      createdAt: null,
      version: "avocadoIntelligence",
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
const avocadoCountEl = document.getElementById("avocado-count");
const apsCountEl = document.getElementById("aps-count");
const logEl = document.getElementById("log");

const pickAvocadoBtn = document.getElementById("pick-avocado-btn");

// Prestige UI
const prestigeLockedEl = document.getElementById("prestige-locked");
const prestigeUnlockedEl = document.getElementById("prestige-unlocked");
const prestigeCountEl = document.getElementById("prestige-count");
const prestigeMultiplierEl = document.getElementById("prestige-multiplier");
const totalAvocadosEl = document.getElementById("total-avocados");
const prestigeBtn = document.getElementById("prestige-btn");

// Debug UI
const debugBtn = document.getElementById("debug-btn");
const debugModal = document.getElementById("debug-modal");
const debugCloseBtn = document.getElementById("debug-close-btn");
const debugResetBtn = document.getElementById("debug-reset-btn");
const debugAddAvocadosBtn = document.getElementById("debug-add-avocados-btn");

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
  if (!confirm("Reset this prototype? All progress will be lost.")) return;

  isResetting = true;
  if (mainLoopInterval) clearInterval(mainLoopInterval);

  localStorage.removeItem(STORAGE_KEY);

  // Cache-bust reload (useful on GitHub Pages)
  window.location.href = window.location.pathname + "?t=" + Date.now();
}

// --- APS (click-based) ---
function recordClick() {
  const now = Date.now();
  state.lastClickTimestamps.push(now);

  // Remove clicks older than window
  const cutoff = now - state.clickWindowSeconds * 1000;
  while (state.lastClickTimestamps.length && state.lastClickTimestamps[0] < cutoff) {
    state.lastClickTimestamps.shift();
  }
}

function computeAps() {
  const now = Date.now();
  const cutoff = now - state.clickWindowSeconds * 1000;
  state.lastClickTimestamps = state.lastClickTimestamps.filter(t => t >= cutoff);
  const clickRate = state.lastClickTimestamps.length / state.clickWindowSeconds;
  return clickRate * TUNING.production.baseClickYield * state.prestigeMultiplier;
}

// --- UI ---
function updateUI() {
  avocadoCountEl.textContent = String(Calc.getDisplayCount(state.avocadoCount));
  apsCountEl.textContent = Calc.formatRate(computeAps());

  // Prestige section
  const canPrestigeNow = Calc.canPrestige(state.totalAvocados, TUNING);
  if (canPrestigeNow) {
    prestigeLockedEl.style.display = "none";
    prestigeUnlockedEl.style.display = "";
    prestigeCountEl.textContent = String(state.prestigeCount);
    prestigeMultiplierEl.textContent = Calc.formatRate(state.prestigeMultiplier);
    totalAvocadosEl.textContent = String(Calc.getDisplayCount(state.totalAvocados));
  } else {
    prestigeLockedEl.style.display = "";
    prestigeUnlockedEl.style.display = "none";
  }
}

// --- Actions ---
function pickAvocado() {
  const yield_ = TUNING.production.baseClickYield * state.prestigeMultiplier;
  state.avocadoCount += yield_;
  state.totalAvocados += yield_;
  recordClick();
  saveGame();
  updateUI();
}

function prestige() {
  if (!Calc.canPrestige(state.totalAvocados, TUNING)) return;

  state.avocadoCount = 0;
  state.prestigeCount += 1;
  state.prestigeMultiplier = Calc.calcPrestigeMultiplier(state.prestigeCount, TUNING);

  saveGame();
  updateUI();
  logLine(`Prestige ${state.prestigeCount}! Multiplier now ${Calc.formatRate(state.prestigeMultiplier)}x`);
}

// --- Main Loop ---
function startLoop() {
  let last = Date.now();
  mainLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;

    // UI refresh (APS updates even if idle)
    updateUI();
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
pickAvocadoBtn.addEventListener("click", pickAvocado);
prestigeBtn.addEventListener("click", prestige);

debugBtn.addEventListener("click", openDebug);
debugCloseBtn.addEventListener("click", closeDebug);
debugResetBtn.addEventListener("click", resetGame);

debugAddAvocadosBtn.addEventListener("click", () => {
  state.avocadoCount += 100;
  state.totalAvocados += 100;
  saveGame();
  updateUI();
  logLine("Debug: +100 avocados");
});

// Close modal on outside click
debugModal.addEventListener("click", (e) => {
  if (e.target === debugModal) closeDebug();
});

// --- Init ---
loadGame();
updateUI();
startLoop();
logLine("Avocado Intelligence loaded.");
