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
  "wisdomUnlocks",
  "prestigeCount",
  "meta",
];

function createDefaultState() {
  return {
    avocadoCount: 0,
    totalAvocadosThisRun: 0,
    totalAvocadosAllTime: 0,
    guacCount: 0,

    producers: {
      sapling: 0, orchard_row: 0, influencer: 0, drone: 0, guac_lab: 0, guac_refinery: 0,
      exchange: 0, pit_miner: 0, neural_pit: 0, orchard_cloud: 0,
    },
    upgrades: {},
    wisdom: 0,
    wisdomUnlocks: {},
    prestigeCount: 0,

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

// --- Guac multiplier milestone tracking ---
const GUAC_MULT_MESSAGES = [
  "\u{1f951} The orchard compresses into efficiency.",
  "\u{1f7e2} Guac density increased.",
  "\u{1f951} The avocados are condensing.",
  "\u{1f7e2} Guac pressure rising.",
];
let lastGuacMultMilestone = 1; // tracks last logged floor at 0.25 increments

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

// --- Guac underfed throttle ---
let lastUnderfedLogTime = 0;

// --- DOM ---
const avocadoCountEl = document.getElementById("avocado-count");
const apsCountEl = document.getElementById("aps-count");
const clickPowerEl = document.getElementById("click-power");
const guacRowEl = document.getElementById("guac-row");
const guacCountEl = document.getElementById("guac-count");
const guacMultRowEl = document.getElementById("guac-mult-row");
const guacMultEl = document.getElementById("guac-mult");
const wisdomRowEl = document.getElementById("wisdom-row");
const wisdomCountEl = document.getElementById("wisdom-count");
const wisdomMultRowEl = document.getElementById("wisdom-mult-row");
const wisdomMultEl = document.getElementById("wisdom-mult");
const totalMultRowEl = document.getElementById("total-mult-row");
const totalMultEl = document.getElementById("total-mult");
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

// Wisdom Unlocks UI
const wisdomUnlocksListEl = document.getElementById("wisdom-unlocks-list");

// Debug UI
const debugBtn = document.getElementById("debug-btn");
const debugModal = document.getElementById("debug-modal");
const debugCloseBtn = document.getElementById("debug-close-btn");
const debugResetBtn = document.getElementById("debug-reset-btn");
const debugAddAvocadosBtn = document.getElementById("debug-add-avocados-btn");
const debugAddBigAvocadosBtn = document.getElementById("debug-add-big-avocados-btn");
const debugAdd100kAvocadosBtn = document.getElementById("debug-add-100k-avocados-btn");
const debugAdd1mAvocadosBtn = document.getElementById("debug-add-1m-avocados-btn");
const debugAddWisdomBtn = document.getElementById("debug-add-wisdom-btn");

// --- Logging ---
function logLine(message) {
  const ts = new Date().toISOString();
  const div = document.createElement("div");
  div.className = "line";
  div.dataset.ts = ts;
  div.textContent = message;
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
      wisdomUnlocks: { ...(persisted.wisdomUnlocks || {}) },
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
          <div class="producer-desc" data-desc="${id}">${cfg.desc}</div>
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

function renderWisdomUnlocks() {
  if (!wisdomUnlocksListEl) return;
  wisdomUnlocksListEl.innerHTML = "";
  for (const [id, cfg] of Object.entries(TUNING.wisdomUnlocks)) {
    const row = document.createElement("div");
    row.className = "upgrade-row";
    row.dataset.wid = id;
    row.innerHTML = `
      <div class="upgrade-info">
        <div class="upgrade-title">${cfg.title}</div>
        <div class="upgrade-desc">${cfg.desc}</div>
      </div>
      <button class="btn upgrade-buy" data-wbuy="${id}" type="button">
        ${cfg.wisdomCost} Wisdom
      </button>
    `;
    wisdomUnlocksListEl.appendChild(row);
  }

  wisdomUnlocksListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-wbuy]");
    if (btn) buyWisdomUnlock(btn.dataset.wbuy);
  });
}

function buyWisdomUnlock(id) {
  const cfg = TUNING.wisdomUnlocks[id];
  if (!cfg) return;
  if (state.wisdomUnlocks[id]) return; // already owned
  if (state.wisdom < cfg.wisdomCost) return;

  state.wisdom -= cfg.wisdomCost;
  state.wisdomUnlocks[id] = true;
  logLine(`Wisdom unlock: ${cfg.title}`);
  saveGame();
  updateUI();
}

// --- UI Update (per tick) ---
let tickCount = 0;

function updateUI() {
  const aps = Calc.calcTotalAps(state.producers, state.upgrades, state.wisdom, state.guacCount, TUNING);
  const clickPower = Calc.calcClickPower(state.upgrades, state.producers, state.wisdom, state.guacCount, aps, TUNING);

  avocadoCountEl.textContent = Calc.formatNumber(state.avocadoCount);
  apsCountEl.textContent = aps.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  clickPowerEl.textContent = Calc.formatNumber(clickPower);

  // Guac row — show when guac protocol owned
  const hasGuac = !!state.upgrades.guac_unlock;
  guacRowEl.style.display = hasGuac ? "" : "none";
  const labs = state.producers.guac_lab || 0;
  const refineries = state.producers.guac_refinery || 0;
  if (hasGuac) {
    if (labs > 0) {
      const guacPerSec = Calc.calcGuacProduction(labs, TUNING, state.upgrades, state.wisdomUnlocks, state.prestigeCount);
      guacCountEl.textContent = `${Calc.formatNumber(state.guacCount)} (+${Calc.formatRate(guacPerSec)}/sec)`;
    } else {
      guacCountEl.textContent = `${Calc.formatNumber(state.guacCount)} (need Guac Labs)`;
    }
  }

  // Guac multiplier row — show when guac > 0
  const guacMult = Calc.calcGuacMultiplier(state.guacCount, TUNING);
  guacMultRowEl.style.display = state.guacCount > 0 ? "" : "none";
  if (state.guacCount > 0) {
    guacMultEl.textContent = `x${guacMult.toFixed(2)}`;
  }

  // Wisdom row
  wisdomRowEl.style.display = state.wisdom > 0 ? "" : "none";
  if (state.wisdom > 0) {
    wisdomCountEl.textContent = String(state.wisdom);
  }

  // Wisdom multiplier row
  const wisdomMult = Calc.calcWisdomBonus(state.wisdom, state.upgrades, TUNING);
  wisdomMultRowEl.style.display = state.wisdom > 0 ? "" : "none";
  if (state.wisdom > 0) {
    wisdomMultEl.textContent = `x${wisdomMult.toFixed(2)}`;
  }

  // Total multiplier row — show when any multiplier is active
  const hasMultipliers = state.guacCount > 0 || state.wisdom > 0;
  totalMultRowEl.style.display = hasMultipliers ? "" : "none";
  if (hasMultipliers) {
    totalMultEl.textContent = `x${(guacMult * wisdomMult).toFixed(2)}`;
  }

  // Producer rows: update counts, costs, rates, disable state, guac_lab gating
  const currentAps = Calc.calcTotalAps(state.producers, state.upgrades, state.wisdom, state.guacCount, TUNING);
  const guacLabUnlocked = currentAps >= TUNING.guac.labUnlockAps || (state.producers.guac_lab || 0) > 0;

  for (const id of PRODUCER_ORDER) {
    const owned = state.producers[id] || 0;
    const cost = Calc.calcProducerCost(id, owned, TUNING);
    const unitRate = Calc.calcProducerUnitRate(id, state.upgrades, TUNING);
    const canAfford = state.avocadoCount >= cost;

    const row = producersListEl.querySelector(`[data-id="${id}"]`);
    const countEl = producersListEl.querySelector(`[data-count="${id}"]`);
    const costEl = producersListEl.querySelector(`[data-cost="${id}"]`);
    const rateEl = producersListEl.querySelector(`[data-rate="${id}"]`);
    const buyBtn = producersListEl.querySelector(`[data-buy="${id}"]`);
    const descEl = producersListEl.querySelector(`[data-desc="${id}"]`);

    // Guac lab gating
    if (id === "guac_lab" && !guacLabUnlocked && owned === 0) {
      if (row) row.classList.add("locked");
      if (descEl) descEl.textContent = `Requires ${TUNING.guac.labUnlockAps} avocados/sec to unlock.`;
      if (buyBtn) buyBtn.disabled = true;
      if (rateEl) rateEl.textContent = "";
      if (countEl) countEl.textContent = "";
      if (costEl) costEl.textContent = Calc.formatNumber(Calc.calcProducerCost(id, 0, TUNING));
      continue;
    }
    // Guac refinery gating — need at least 1 guac_lab
    if (id === "guac_refinery" && (state.producers.guac_lab || 0) === 0 && owned === 0) {
      if (row) row.classList.add("locked");
      if (descEl) descEl.textContent = "Requires at least 1 Guacamole Lab.";
      if (buyBtn) buyBtn.disabled = true;
      if (rateEl) rateEl.textContent = "";
      if (countEl) countEl.textContent = "";
      if (costEl) costEl.textContent = Calc.formatNumber(Calc.calcProducerCost(id, 0, TUNING));
      continue;
    }
    if (row) row.classList.remove("locked");
    if (descEl) descEl.textContent = TUNING.producers[id].desc;

    if (countEl) countEl.textContent = owned > 0 ? `(${owned} owned)` : "";
    if (costEl) costEl.textContent = Calc.formatNumber(cost);
    let rateText;
    if (owned > 0) {
      rateText = `Producing ${Calc.formatRate(unitRate * owned)} avocados/sec (${Calc.formatRate(unitRate)} each)`;
    } else {
      rateText = `Each produces ${Calc.formatRate(unitRate)} avocados/sec`;
    }
    // Show guac conversion info on guac_lab rows
    if (id === "guac_lab" && state.upgrades.guac_unlock) {
      const labCount = owned || 1;
      const consumption = Calc.calcGuacConsumption(labCount, TUNING, refineries, state.upgrades, state.wisdomUnlocks, state.prestigeCount);
      const guacOut = Calc.calcGuacProduction(labCount, TUNING, state.upgrades, state.wisdomUnlocks, state.prestigeCount);
      if (owned > 0) {
        rateText += ` | Consumes ${Calc.formatRate(consumption)} avo/sec \u2192 ${Calc.formatRate(guacOut)} guac/sec`;
      } else {
        rateText += ` | Also converts avocados \u2192 guac`;
      }
    }
    // Show click bonus on influencer rows
    if (id === "influencer") {
      const clickBonus = TUNING.producers.influencer.clickBonus;
      rateText = owned > 0
        ? `+${Calc.formatRate(clickBonus * owned)} click power (${Calc.formatRate(clickBonus)} each)`
        : `Each adds +${Calc.formatRate(clickBonus)} click power`;
    }
    // Show refinery effect on guac_refinery rows
    if (id === "guac_refinery") {
      const effExp = Calc.calcEffectiveConsumeExponent(owned, state.upgrades, state.wisdomUnlocks, state.prestigeCount, TUNING);
      rateText = owned > 0
        ? `Consume exponent: ${effExp.toFixed(2)} (base ${TUNING.guac.consumeExponent})`
        : `Each refinery lowers consume exponent by 0.01`;
    }
    if (rateEl) rateEl.textContent = rateText;
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
      if (btn) {
        btn.disabled = !inv.canPurchase(state);
        const costEl = btn.querySelector(`[data-ucost="${inv.id}"]`);
        if (costEl) {
          costEl.textContent = Calc.formatNumber(inv.cost());
        } else {
          // Recreate span (e.g. after prestige resets "Owned" text back to cost)
          btn.innerHTML = `<span data-ucost="${inv.id}">${Calc.formatNumber(inv.cost())}</span>`;
        }
      }
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

  // Wisdom unlocks section — show when player has wisdom
  if (wisdomUnlocksListEl) {
    const wisdomUnlocksSection = wisdomUnlocksListEl.closest(".section");
    if (wisdomUnlocksSection) {
      wisdomUnlocksSection.style.display = state.wisdom > 0 || Object.keys(state.wisdomUnlocks).length > 0 ? "" : "none";
    }
    for (const [id, cfg] of Object.entries(TUNING.wisdomUnlocks)) {
      const row = wisdomUnlocksListEl.querySelector(`[data-wid="${id}"]`);
      if (!row) continue;
      const owned = !!state.wisdomUnlocks[id];
      if (owned) {
        row.classList.add("owned");
        const btn = row.querySelector(`[data-wbuy="${id}"]`);
        if (btn) { btn.disabled = true; btn.textContent = "Owned"; }
      } else {
        row.classList.remove("owned");
        const btn = row.querySelector(`[data-wbuy="${id}"]`);
        if (btn) {
          btn.disabled = state.wisdom < cfg.wisdomCost;
          btn.textContent = `${cfg.wisdomCost} Wisdom`;
        }
      }
    }
  }
}

// --- Actions ---
function spawnClickEmoji() {
  const rect = pickAvocadoBtn.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "click-emoji";
  el.textContent = "\u{1f951}";
  // Random angle within ±15° from straight up
  const angle = (Math.random() - 0.5) * 60 * (Math.PI / 180);
  const dx = Math.sin(angle) * 80;
  el.style.left = `${rect.left + rect.width / 2 - 11}px`;
  el.style.top = `${rect.top - 10}px`;
  el.style.setProperty("--dx", `${dx}px`);
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function pickAvocado() {
  const aps = Calc.calcTotalAps(state.producers, state.upgrades, state.wisdom, state.guacCount, TUNING);
  const power = Calc.calcClickPower(state.upgrades, state.producers, state.wisdom, state.guacCount, aps, TUNING);
  state.avocadoCount += power;
  state.totalAvocadosThisRun += power;
  state.totalAvocadosAllTime += power;
  recordClick();
  spawnClickEmoji();

  // Flavor text (1-in-10 chance)
  if (Math.random() < 0.1) {
    const msg = CLICK_MESSAGES[Math.floor(Math.random() * CLICK_MESSAGES.length)];
    logLine(msg);
  }

  updateUI();
}

function buyProducer(id) {
  // Guac lab gating — need enough APS to feed the lab
  if (id === "guac_lab" && (state.producers.guac_lab || 0) === 0) {
    const currentAps = Calc.calcTotalAps(state.producers, state.upgrades, state.wisdom, state.guacCount, TUNING);
    if (currentAps < TUNING.guac.labUnlockAps) return;
  }

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
  const keptWisdomUnlocks = { ...state.wisdomUnlocks };
  const newPrestigeCount = (state.prestigeCount || 0) + 1;

  // Reset run state
  state.avocadoCount = 0;
  state.totalAvocadosThisRun = 0;
  state.totalAvocadosAllTime = allTime; // keep all-time
  state.guacCount = 0;
  state.producers = createDefaultState().producers;
  state.upgrades = {};
  state.wisdom = newWisdom;
  state.wisdomUnlocks = keptWisdomUnlocks; // persists through prestige
  state.prestigeCount = newPrestigeCount;

  // Reset milestones
  lastMilestoneReached = 0;
  lastGuacMultMilestone = 1;

  logLine(`\u267b\ufe0f The orchard collapses into nutrient memory.`);
  logLine(`\u2728 You gained ${wisdomGain} Wisdom. (Prestige #${newPrestigeCount})`);

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
    const aps = Calc.calcTotalAps(state.producers, state.upgrades, state.wisdom, state.guacCount, TUNING);
    if (aps > 0) {
      const produced = aps * dt;
      state.avocadoCount += produced;
      state.totalAvocadosThisRun += produced;
      state.totalAvocadosAllTime += produced;
    }

    // Guac conversion — sublinear consumption, capped at available surplus
    if (state.upgrades.guac_unlock && (state.producers.guac_lab || 0) > 0) {
      const labs = state.producers.guac_lab;
      const refineries = state.producers.guac_refinery || 0;
      const desiredConsumption = Calc.calcGuacConsumption(labs, TUNING, refineries, state.upgrades, state.wisdomUnlocks, state.prestigeCount) * dt;
      const actualConsumption = Math.min(desiredConsumption, state.avocadoCount);
      if (actualConsumption > 0) {
        state.avocadoCount -= actualConsumption;
        // Guac produced proportional to actual vs desired consumption
        const fullGuac = Calc.calcGuacProduction(labs, TUNING, state.upgrades, state.wisdomUnlocks, state.prestigeCount) * dt;
        state.guacCount += desiredConsumption > 0 ? fullGuac * (actualConsumption / desiredConsumption) : 0;
      }
      // Debug log when underfed (throttled to every ~5s)
      if (actualConsumption < desiredConsumption && now - lastUnderfedLogTime > 5000) {
        lastUnderfedLogTime = now;
        logLine("\u26a0\ufe0f Guac Labs are underfed.");
      }
    }

    // Guac multiplier milestones (log every 0.25 increase)
    const guacMult = Calc.calcGuacMultiplier(state.guacCount, TUNING);
    const nextMilestone = lastGuacMultMilestone + 0.25;
    if (guacMult >= nextMilestone) {
      lastGuacMultMilestone = Math.floor(guacMult * 4) / 4; // snap to 0.25 grid
      const msg = GUAC_MULT_MESSAGES[Math.floor(Math.random() * GUAC_MULT_MESSAGES.length)];
      logLine(`${msg} (x${guacMult.toFixed(2)})`);
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

debugAdd100kAvocadosBtn.addEventListener("click", () => {
  state.avocadoCount += 100000;
  state.totalAvocadosThisRun += 100000;
  state.totalAvocadosAllTime += 100000;
  saveGame();
  updateUI();
  logLine("Debug: +100,000 avocados");
});

debugAdd1mAvocadosBtn.addEventListener("click", () => {
  state.avocadoCount += 1000000;
  state.totalAvocadosThisRun += 1000000;
  state.totalAvocadosAllTime += 1000000;
  saveGame();
  updateUI();
  logLine("Debug: +1,000,000 avocados");
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
renderWisdomUnlocks();
updateUI();
startLoop();
logLine("Avocado Intelligence loaded.");
