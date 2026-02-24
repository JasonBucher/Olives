// Avocado Intelligence — main game loop and state

import { TUNING, PRODUCER_ORDER } from "./tuning.js";
import * as Calc from "./gameCalc.js";
import { INVESTMENTS } from "./investments.js";

const STORAGE_PREFIX = "AVO_";
const STORAGE_KEY = STORAGE_PREFIX + "gameState";

// --- Persisted State ---
const PERSISTED_STATE_KEYS = [
  "avocadoCount",
  "totalAvocadosThisRun",
  "totalAvocadosAllTime",
  "guacCount",
  "producers",
  "upgrades",
  "wisdom",
  "meta",
];

function createDefaultState() {
  return {
    avocadoCount: 0,
    totalAvocadosThisRun: 0,
    totalAvocadosAllTime: 0,
    guacCount: 0,

    producers: {
      sapling: 0, orchard_row: 0, drone: 0, guac_lab: 0,
      exchange: 0, pit_miner: 0, neural_pit: 0, orchard_cloud: 0,
    },
    upgrades: {},
    wisdom: 0,

    // Click tracking for APS display (transient — not persisted)
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
let isResetting = false;
let mainLoopInterval = null;

// --- Game State ---
let state = createDefaultState();

// --- APS milestone tracking ---
const APS_MILESTONES = [1, 10, 100, 1000, 10000, 100000];
const APS_MILESTONE_MESSAGES = {
  1:      "First avocado per second. The orchard awakens.",
  10:     "10 APS. You can taste the guacamole.",
  100:    "100 APS! The avocados are self-organizing.",
  1000:   "1K APS. The pit network is fully operational.",
  10000:  "10K APS. You've achieved Avocado Singularity.",
  100000: "100K APS. The avocados have become sentient.",
};
let lastMilestoneReached = 0;

// --- Click flavor text ---
const CLICK_MESSAGES = [
  "A perfectly ripe one!",
  "The guac gods smile upon you.",
  "That avocado was already ripe. Lucky!",
  "You found a double-seeded avocado!",
  "The avocado whispers: 'thank you.'",
  "A wild avocado appeared!",
  "Pit-iful resistance.",
  "Avocado acquired. Target locked.",
  "The algorithm detected peak ripeness.",
  "This one sparks joy.",
];

// --- DOM ---
const avocadoCountEl = document.getElementById("avocado-count");
const apsCountEl = document.getElementById("aps-count");
const clickPowerEl = document.getElementById("click-power");
const guacRowEl = document.getElementById("guac-row");
const guacCountEl = document.getElementById("guac-count");
const wisdomRowEl = document.getElementById("wisdom-row");
const wisdomCountEl = document.getElementById("wisdom-count");
const logEl = document.getElementById("log");

const pickAvocadoBtn = document.getElementById("pick-avocado-btn");
const producersListEl = document.getElementById("producers-list");
const upgradesListEl = document.getElementById("upgrades-list");

// Prestige UI
const prestigeLockedEl = document.getElementById("prestige-locked");
const prestigeUnlockedEl = document.getElementById("prestige-unlocked");
const wisdomPreviewEl = document.getElementById("wisdom-preview");
const totalAvocadosRunEl = document.getElementById("total-avocados-run");
const prestigeBtn = document.getElementById("prestige-btn");

// Debug UI
const debugBtn = document.getElementById("debug-btn");
const debugModal = document.getElementById("debug-modal");
const debugCloseBtn = document.getElementById("debug-close-btn");
const debugResetBtn = document.getElementById("debug-reset-btn");
const debugAddAvocadosBtn = document.getElementById("debug-add-avocados-btn");
const debugAddBigAvocadosBtn = document.getElementById("debug-add-big-avocados-btn");
const debugAddWisdomBtn = document.getElementById("debug-add-wisdom-btn");

// --- Logging ---
function logLine(message) {
  const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const div = document.createElement("div");
  div.className = "line";
  div.textContent = `[${ts}] ${message}`;
  logEl.prepend(div);

  const maxLines = 60;
  while (logEl.children.length > maxLines) {
    logEl.removeChild(logEl.lastChild);
  }
}

// --- Storage ---
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

    // Deep merge producers and upgrades objects
    const defaults = createDefaultState();
    state = {
      ...defaults,
      ...persisted,
      producers: { ...defaults.producers, ...(persisted.producers || {}) },
      upgrades: { ...(persisted.upgrades || {}) },
      meta: { ...defaults.meta, ...(persisted.meta || {}) },
    };
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
  window.location.href = window.location.pathname + "?t=" + Date.now();
}

// --- APS (click-based, for display only) ---
function recordClick() {
  const now = Date.now();
  state.lastClickTimestamps.push(now);

  const cutoff = now - state.clickWindowSeconds * 1000;
  while (state.lastClickTimestamps.length && state.lastClickTimestamps[0] < cutoff) {
    state.lastClickTimestamps.shift();
  }
}

// --- Dynamic UI rendering ---
function renderProducerList() {
  producersListEl.innerHTML = "";
  for (const id of PRODUCER_ORDER) {
    const cfg = TUNING.producers[id];
    const row = document.createElement("div");
    row.className = "producer-row";
    row.dataset.id = id;
    row.innerHTML = `
      <div class="producer-header">
        <div>
          <div class="producer-title">${cfg.title} <span class="producer-count" data-count="${id}">0</span></div>
          <div class="producer-desc">${cfg.desc}</div>
        </div>
        <button class="btn producer-buy" data-buy="${id}" type="button">
          Buy — <span data-cost="${id}">10</span>
        </button>
      </div>
      <div class="producer-rate muted" data-rate="${id}"></div>
    `;
    producersListEl.appendChild(row);
  }

  // Wire buy buttons
  producersListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-buy]");
    if (btn) buyProducer(btn.dataset.buy);
  });
}

function renderUpgradeList() {
  upgradesListEl.innerHTML = "";
  for (const inv of INVESTMENTS) {
    const cfg = TUNING.upgrades[inv.id];
    const row = document.createElement("div");
    row.className = "upgrade-row";
    row.dataset.id = inv.id;
    row.innerHTML = `
      <div class="upgrade-info">
        <div class="upgrade-title">${cfg.title}</div>
        <div class="upgrade-desc">${cfg.desc}</div>
      </div>
      <button class="btn upgrade-buy" data-upgrade="${inv.id}" type="button">
        <span data-ucost="${inv.id}">${Calc.formatNumber(cfg.cost)}</span>
      </button>
    `;
    upgradesListEl.appendChild(row);
  }

  // Wire buy buttons
  upgradesListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-upgrade]");
    if (btn) buyUpgrade(btn.dataset.upgrade);
  });
}

// --- UI Update (per tick) ---
let tickCount = 0;

function updateUI() {
  const aps = Calc.calcTotalAps(state.producers, state.upgrades, state.wisdom, TUNING);
  const clickPower = Calc.calcClickPower(state.upgrades, state.wisdom, TUNING);

  avocadoCountEl.textContent = Calc.formatNumber(state.avocadoCount);
  apsCountEl.textContent = Calc.formatNumber(aps);
  clickPowerEl.textContent = Calc.formatNumber(clickPower);

  // Guac row
  const hasGuac = !!state.upgrades.guac_unlock;
  guacRowEl.style.display = hasGuac ? "" : "none";
  if (hasGuac) {
    guacCountEl.textContent = Calc.formatNumber(state.guacCount);
  }

  // Wisdom row
  wisdomRowEl.style.display = state.wisdom > 0 ? "" : "none";
  if (state.wisdom > 0) {
    const bonus = Calc.calcWisdomBonus(state.wisdom, state.upgrades, TUNING);
    wisdomCountEl.textContent = `${state.wisdom} (${Calc.formatRate(bonus)}x)`;
  }

  // Producer rows: update counts, costs, rates, disable state
  for (const id of PRODUCER_ORDER) {
    const owned = state.producers[id] || 0;
    const cost = Calc.calcProducerCost(id, owned, TUNING);
    const unitRate = Calc.calcProducerUnitRate(id, state.upgrades, TUNING);
    const canAfford = state.avocadoCount >= cost;

    const countEl = producersListEl.querySelector(`[data-count="${id}"]`);
    const costEl = producersListEl.querySelector(`[data-cost="${id}"]`);
    const rateEl = producersListEl.querySelector(`[data-rate="${id}"]`);
    const buyBtn = producersListEl.querySelector(`[data-buy="${id}"]`);

    if (countEl) countEl.textContent = owned > 0 ? `(${owned} owned)` : "";
    if (costEl) costEl.textContent = Calc.formatNumber(cost);
    if (rateEl) rateEl.textContent = owned > 0
      ? `Producing ${Calc.formatRate(unitRate * owned)} avocados/sec (${Calc.formatRate(unitRate)} each)`
      : `Each produces ${Calc.formatRate(unitRate)} avocados/sec`;
    if (buyBtn) buyBtn.disabled = !canAfford;
  }

  // Upgrade rows: show/hide, owned state, disable
  for (const inv of INVESTMENTS) {
    const row = upgradesListEl.querySelector(`[data-id="${inv.id}"]`);
    if (!row) continue;

    const unlocked = inv.isUnlocked(state);
    const owned = inv.isOwned(state);

    row.style.display = unlocked ? "" : "none";

    if (owned) {
      row.classList.add("owned");
      const btn = row.querySelector(`[data-upgrade="${inv.id}"]`);
      if (btn) { btn.disabled = true; btn.textContent = "Owned"; }
    } else {
      row.classList.remove("owned");
      const btn = row.querySelector(`[data-upgrade="${inv.id}"]`);
      if (btn) btn.disabled = !inv.canPurchase(state);
    }
  }

  // Prestige section
  const canPrestigeNow = Calc.canPrestige(state.totalAvocadosThisRun, TUNING);
  if (canPrestigeNow) {
    prestigeLockedEl.style.display = "none";
    prestigeUnlockedEl.style.display = "";
    const wisdomGain = Calc.calcWisdomEarned(state.totalAvocadosThisRun, TUNING);
    wisdomPreviewEl.textContent = String(wisdomGain);
    totalAvocadosRunEl.textContent = Calc.formatNumber(state.totalAvocadosThisRun);
  } else {
    prestigeLockedEl.style.display = "";
    prestigeUnlockedEl.style.display = "none";
  }
}

// --- Actions ---
function pickAvocado() {
  const power = Calc.calcClickPower(state.upgrades, state.wisdom, TUNING);
  state.avocadoCount += power;
  state.totalAvocadosThisRun += power;
  state.totalAvocadosAllTime += power;
  recordClick();

  // Flavor text (1-in-10 chance)
  if (Math.random() < 0.1) {
    const msg = CLICK_MESSAGES[Math.floor(Math.random() * CLICK_MESSAGES.length)];
    logLine(msg);
  }

  updateUI();
}

function buyProducer(id) {
  const owned = state.producers[id] || 0;
  const cost = Calc.calcProducerCost(id, owned, TUNING);
  if (state.avocadoCount < cost) return;

  state.avocadoCount -= cost;
  state.producers[id] = owned + 1;

  const cfg = TUNING.producers[id];
  logLine(`Bought ${cfg.title} (#${state.producers[id]})`);
  saveGame();
  updateUI();
}

function buyUpgrade(id) {
  const inv = INVESTMENTS.find(i => i.id === id);
  if (!inv || inv.isOwned(state) || !inv.canPurchase(state)) return;

  inv.purchase(state);
  const cfg = TUNING.upgrades[id];
  logLine(`Research complete: ${cfg.title}`);
  saveGame();
  updateUI();
}

function prestige() {
  if (!Calc.canPrestige(state.totalAvocadosThisRun, TUNING)) return;

  const wisdomGain = Calc.calcWisdomEarned(state.totalAvocadosThisRun, TUNING);
  const allTime = state.totalAvocadosAllTime;
  const newWisdom = state.wisdom + wisdomGain;

  // Reset run state
  state.avocadoCount = 0;
  state.totalAvocadosThisRun = 0;
  state.totalAvocadosAllTime = allTime; // keep all-time
  state.guacCount = 0;
  state.producers = createDefaultState().producers;
  state.upgrades = {};
  state.wisdom = newWisdom;

  // Reset milestones
  lastMilestoneReached = 0;

  const PRESTIGE_MESSAGES = [
    "The avocados have been composted. Wisdom remains.",
    "Back to seed. But the roots remember.",
    "The orchard sleeps. The mind grows.",
    "Composting complete. You smell... enlightened.",
    "Reset? No. Rebirth.",
  ];
  const msg = PRESTIGE_MESSAGES[Math.floor(Math.random() * PRESTIGE_MESSAGES.length)];
  logLine(`Prestige! +${wisdomGain} wisdom. ${msg}`);

  saveGame();
  updateUI();
}

// --- Main Loop ---
function startLoop() {
  let last = Date.now();
  tickCount = 0;

  mainLoopInterval = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;

    // Production
    const aps = Calc.calcTotalAps(state.producers, state.upgrades, state.wisdom, TUNING);
    if (aps > 0) {
      const produced = aps * dt;
      state.avocadoCount += produced;
      state.totalAvocadosThisRun += produced;
      state.totalAvocadosAllTime += produced;
    }

    // Guac conversion
    if (state.upgrades.guac_unlock && (state.producers.guac_lab || 0) > 0) {
      const guacPerSec = TUNING.guac.labConversionRate * state.producers.guac_lab;
      const guacThisTick = guacPerSec * dt;
      const avocadoCost = guacThisTick * TUNING.guac.avocadosPerGuac;
      if (state.avocadoCount >= avocadoCost) {
        state.avocadoCount -= avocadoCost;
        state.guacCount += guacThisTick;
      }
    }

    // APS milestones
    if (aps > lastMilestoneReached) {
      for (const milestone of APS_MILESTONES) {
        if (aps >= milestone && lastMilestoneReached < milestone) {
          lastMilestoneReached = milestone;
          logLine(APS_MILESTONE_MESSAGES[milestone]);
        }
      }
    }

    // Auto-save every ~5s
    tickCount++;
    if (tickCount % 25 === 0) saveGame();

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
  state.totalAvocadosThisRun += 100;
  state.totalAvocadosAllTime += 100;
  saveGame();
  updateUI();
  logLine("Debug: +100 avocados");
});

debugAddBigAvocadosBtn.addEventListener("click", () => {
  state.avocadoCount += 10000;
  state.totalAvocadosThisRun += 10000;
  state.totalAvocadosAllTime += 10000;
  saveGame();
  updateUI();
  logLine("Debug: +10,000 avocados");
});

debugAddWisdomBtn.addEventListener("click", () => {
  state.wisdom += 10;
  saveGame();
  updateUI();
  logLine("Debug: +10 wisdom");
});

debugModal.addEventListener("click", (e) => {
  if (e.target === debugModal) closeDebug();
});

// --- Init ---
loadGame();
renderProducerList();
renderUpgradeList();
updateUI();
startLoop();
logLine("Avocado Intelligence loaded.");
