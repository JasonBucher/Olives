// Prototype Template JS
// Storage convention (rename STORAGE_PREFIX when you copy this template into a new prototype)

import { TUNING } from "./tuning.js";
import * as Calc from "./gameCalc.js";
import { INVESTMENTS } from "./investments.js";
import { createSessionLog } from "./sessionLog.js";
import { initAnalyzerView } from "./views/analyzerView.js";

const STORAGE_PREFIX = "TEMPLATE_";
const STORAGE_KEY = STORAGE_PREFIX + "gameState";

const SessionLog = createSessionLog(STORAGE_PREFIX);

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

// --- Telemetry ---
// --- CUSTOMIZE: add your game's metrics here ---
function captureStateSnapshot(reason = "tick") {
  SessionLog.record("state_snapshot", {
    oliveCount: state.oliveCount,
    ops: computeOps(),
    reason,
  });
}

// --- View switching (game vs analyzer) ---
const gameRootEl = document.getElementById("game-root");
const analyzerScreenEl = document.getElementById("analyzer-screen");
const analyzerBtn = document.getElementById("analyzer-btn");
let activeView = "game";

function renderActiveView() {
  const isAnalyzer = activeView === "analyzer";
  gameRootEl?.classList.toggle("is-hidden", isAnalyzer);
  analyzerScreenEl?.classList.toggle("is-hidden", !isAnalyzer);
}

function openAnalyzer() {
  activeView = "analyzer";
  renderActiveView();
  analyzerView?.notifyVisible();
}

function closeAnalyzer() {
  activeView = "game";
  renderActiveView();
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
  let tickCount = 0;
  mainLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;

    tickCount++;

    // Capture telemetry every 5th tick (~1/s)
    if (tickCount % 5 === 0) captureStateSnapshot("tick");

    // UI refresh (OPS updates even if idle)
    updateUI();

    // Auto-save every ~5s
    if (tickCount % 25 === 0) saveGame();
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

if (analyzerBtn) analyzerBtn.addEventListener("click", openAnalyzer);

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

// --- Analyzer ---
// --- CUSTOMIZE: update series and summaryFields for your prototype ---
const analyzerView = initAnalyzerView({
  sessionLog: SessionLog,
  onBack: closeAnalyzer,
  captureSnapshot: (reason) => captureStateSnapshot(reason),
  series: [
    { key: "oliveCount", label: "Olives", color: "#84cc16", default: true },
    { key: "ops",        label: "OPS",    color: "#3b82f6", default: true },
  ],
  summaryFields: [
    { key: "oliveCount", label: "Olives" },
    { key: "ops",        label: "OPS" },
  ],
  downloadPrefix: "template",
});

// --- Init ---
loadGame();
updateUI();
SessionLog.initSession();
captureStateSnapshot("init");
startLoop();
logLine("Loaded prototype template.");
