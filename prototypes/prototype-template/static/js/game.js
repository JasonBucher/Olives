// Prototype Template JS
// Storage convention (rename STORAGE_PREFIX when you copy this template into a new prototype)

import { TUNING } from "./tuning.js";
import * as Calc from "./gameCalc.js";
import { INVESTMENTS } from "./investments.js";

const STORAGE_PREFIX = "TEMPLATE_";
const STORAGE_KEY = STORAGE_PREFIX + "gameState";

// --- Persisted State ---
const PERSISTED_STATE_KEYS = [
  "oliveCount",
  "oilCount",
  "florinCount",
  "sharperPickOwned",
  "biggerBasketsLevel",
  "marketStallOwned",
  "meta",
];

function createDefaultState() {
  return {
    oliveCount: 0,
    oilCount: 0,
    florinCount: 0,

    sharperPickOwned: false,
    biggerBasketsLevel: 0,
    marketStallOwned: false,

    // Click tracking for OPS (transient — not persisted)
    clickWindowSeconds: 5,
    lastClickTimestamps: [],

    meta: {
      createdAt: null,
      version: "template-sample-game",
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

let isResetting = false;
let mainLoopInterval = null;
let state = createDefaultState();

// --- DOM ---
const oliveCountEl = document.getElementById("olive-count");
const oilCountEl = document.getElementById("oil-count");
const florinCountEl = document.getElementById("florin-count");
const opsCountEl = document.getElementById("ops-count");
const clickYieldEl = document.getElementById("click-yield");
const marketRateEl = document.getElementById("market-rate");
const logEl = document.getElementById("log");
const investmentsListEl = document.getElementById("investments-list");

const pickOliveBtn = document.getElementById("pick-olive-btn");
const pressOilBtn = document.getElementById("press-oil-btn");
const sellOilBtn = document.getElementById("sell-oil-btn");

// Debug UI
const debugBtn = document.getElementById("debug-btn");
const debugModal = document.getElementById("debug-modal");
const debugCloseBtn = document.getElementById("debug-close-btn");
const debugResetBtn = document.getElementById("debug-reset-btn");
const debugAddOlivesBtn = document.getElementById("debug-add-olives-btn");
const debugAddFlorinsBtn = document.getElementById("debug-add-florins-btn");
const debugAddOilBtn = document.getElementById("debug-add-oil-btn");

function logLine(message) {
  const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const div = document.createElement("div");
  div.className = "line";
  div.textContent = `[${ts}] ${message}`;
  logEl.prepend(div);

  while (logEl.children.length > 60) {
    logEl.removeChild(logEl.lastChild);
  }
}

function getClickYield() {
  return Calc.getClickYield(
    TUNING.production.baseClickYield,
    state.sharperPickOwned,
    state.biggerBasketsLevel,
    TUNING.production.basketBonusPerLevel,
  );
}

function getMarketMultiplier() {
  return state.marketStallOwned ? TUNING.market.stallBonusMultiplier : 1;
}

function getOilSellValue(oilToSell = 1) {
  return Calc.getSellValue(oilToSell, TUNING.market.baseSellPrice, getMarketMultiplier());
}

function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.meta.createdAt = new Date().toISOString();
    saveGame();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const persisted = pickPersistedState(parsed);
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
  window.location.href = window.location.pathname + "?t=" + Date.now();
}

function recordClick() {
  const now = Date.now();
  state.lastClickTimestamps.push(now);
  const cutoff = now - state.clickWindowSeconds * 1000;
  while (state.lastClickTimestamps.length && state.lastClickTimestamps[0] < cutoff) {
    state.lastClickTimestamps.shift();
  }
}

function computeOps() {
  const now = Date.now();
  const cutoff = now - state.clickWindowSeconds * 1000;
  state.lastClickTimestamps = state.lastClickTimestamps.filter(t => t >= cutoff);
  return state.lastClickTimestamps.length / state.clickWindowSeconds;
}

function createInvestmentCard(investment) {
  const cost = investment.cost(state, TUNING, Calc);
  const owned = investment.isOwned(state, TUNING, Calc);
  const canBuy = investment.canPurchase(state, TUNING, Calc);

  const card = document.createElement("div");
  card.className = "investment-card";

  const lines = investment.effectLines(state, TUNING, Calc)
    .map(line => `<div class="muted">${line}</div>`)
    .join("");

  card.innerHTML = `
    <div class="row"><div class="label">${investment.title}</div><div class="value">Cost ${Calc.getDisplayCount(cost)}</div></div>
    ${lines}
  `;

  const actions = document.createElement("div");
  actions.className = "actions";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.textContent = owned ? "Owned" : "Buy";
  button.disabled = owned || !canBuy;
  button.addEventListener("click", () => {
    investment.purchase(state, TUNING, Calc);
    saveGame();
    updateUI();
    logLine(`Purchased ${investment.title}`);
  });

  actions.append(button);
  card.append(actions);
  return card;
}

function renderInvestments() {
  investmentsListEl.innerHTML = "";
  const unlocked = INVESTMENTS.filter(investment => investment.isUnlocked(state, TUNING, Calc));

  if (unlocked.length === 0) {
    const hint = document.createElement("div");
    hint.className = "muted";
    hint.textContent = "No investments unlocked yet. Gather olives and florins to reveal starter upgrades.";
    investmentsListEl.append(hint);
    return;
  }

  for (const investment of unlocked) {
    investmentsListEl.append(createInvestmentCard(investment));
  }
}

function updateUI() {
  oliveCountEl.textContent = String(Calc.getDisplayCount(state.oliveCount));
  oilCountEl.textContent = String(Calc.getDisplayCount(state.oilCount));
  florinCountEl.textContent = String(Calc.getDisplayCount(state.florinCount));
  opsCountEl.textContent = Calc.formatRate(computeOps());
  clickYieldEl.textContent = String(getClickYield());
  marketRateEl.textContent = `${Calc.formatRate(getOilSellValue(1))} florins/oil`;

  pressOilBtn.disabled = state.oliveCount < TUNING.processing.olivesPerPress;
  sellOilBtn.disabled = state.oilCount < 1;

  renderInvestments();
}

function pickOlive() {
  state.oliveCount += getClickYield();
  recordClick();
  saveGame();
  updateUI();
}

function pressOil() {
  const result = Calc.getPressResult(state.oliveCount, TUNING.processing.olivesPerPress, TUNING.processing.oilYieldPerPress);
  if (!result.canPress) {
    logLine(`Need ${TUNING.processing.olivesPerPress} olives to press oil.`);
    return;
  }

  state.oliveCount -= result.olivesSpent;
  state.oilCount += result.oilMade;
  saveGame();
  updateUI();
  logLine(`Pressed ${result.olivesSpent} olives into ${result.oilMade} oil.`);
}

function sellOil() {
  if (state.oilCount < 1) {
    logLine("No oil to sell.");
    return;
  }

  const sellValue = getOilSellValue(state.oilCount);
  const soldOil = state.oilCount;
  state.oilCount = 0;
  state.florinCount += sellValue;

  saveGame();
  updateUI();
  logLine(`Sold ${Calc.getDisplayCount(soldOil)} oil for ${Calc.getDisplayCount(sellValue)} florins.`);
}

function startLoop() {
  mainLoopInterval = setInterval(() => {
    updateUI();
  }, TUNING.production.tickMs);
}

function openDebug() {
  debugModal.classList.add("active");
  debugModal.setAttribute("aria-hidden", "false");
}

function closeDebug() {
  debugModal.classList.remove("active");
  debugModal.setAttribute("aria-hidden", "true");
}

pickOliveBtn.addEventListener("click", pickOlive);
pressOilBtn.addEventListener("click", pressOil);
sellOilBtn.addEventListener("click", sellOil);

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
  updateUI();
  logLine("Debug: +100 florins");
});

debugAddOilBtn.addEventListener("click", () => {
  state.oilCount += 100;
  saveGame();
  updateUI();
  logLine("Debug: +100 oil");
});

debugModal.addEventListener("click", (e) => {
  if (e.target === debugModal) closeDebug();
});

loadGame();
pressOilBtn.textContent = `Press Oil (${TUNING.processing.olivesPerPress} olives)`;
updateUI();
startLoop();
logLine("Loaded template sample game. Use this to validate template systems end-to-end.");
