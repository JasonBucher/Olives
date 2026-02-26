// Avocado Intelligence — main game loop and state

import { TUNING, PRODUCER_ORDER, GUAC_PRODUCER_ORDER } from "./tuning.js";
import * as Calc from "./gameCalc.js";
import { INVESTMENTS } from "./investments.js";
import { checkBenchmarks, BENCHMARK_ORDER } from "./benchmarks.js";
import SessionLog from "./sessionLog.js";
import { initAnalyzerView } from "./views/analyzerView.js";

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
  "benchmarks",
  "totalWisdomEarned",
  "hyperparams",
  "modelVersion",
  "distillationCount",
  "totalWisdomSinceLastDistill",
  "meta",
];

function createDefaultState() {
  const producers = {};
  for (const id of [...PRODUCER_ORDER, ...GUAC_PRODUCER_ORDER]) {
    producers[id] = 0;
  }
  return {
    avocadoCount: 0,
    totalAvocadosThisRun: 0,
    totalAvocadosAllTime: 0,
    guacCount: 0,

    producers,
    upgrades: {},
    wisdom: 0,
    wisdomUnlocks: {},
    prestigeCount: 0,
    benchmarks: {},
    totalWisdomEarned: 0,
    hyperparams: {
      learningRate: "conservative",
      batchSize: "small",
      regularization: "none",
      lastTuneTime: 0,
      warmupStartTime: 0,
    },
    modelVersion: 0,
    distillationCount: 0,
    totalWisdomSinceLastDistill: 0,

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

// --- Revealed tracking (session-only, not persisted) ---
const revealedProducers = new Set();
const revealedUpgrades = new Set();

// --- Buy quantity selector (session-only, not persisted) ---
let buyQuantity = 1; // 1, 10, 100, or "max"
let guacBuyQuantity = 1; // independent selector for guac producers

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

// --- Idle click prompt ---
let lastClickTime = Date.now();
let idlePromptShowing = false;

// --- DOM ---
const gameTitleEl = document.getElementById("game-title");
const avocadoCountEl = document.getElementById("avocado-count");
const apsCountEl = document.getElementById("aps-count");
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
const guacProducersListEl = document.getElementById("guac-producers-list");
const guacSectionEl = document.getElementById("guac-section");
const upgradesListEl = document.getElementById("upgrades-list");
const upgradesOwnedListEl = document.getElementById("upgrades-owned-list");

// Prestige UI
const prestigeLockedEl = document.getElementById("prestige-locked");
const prestigeUnlockedEl = document.getElementById("prestige-unlocked");
const wisdomPreviewEl = document.getElementById("wisdom-preview");
const totalAvocadosRunEl = document.getElementById("total-avocados-run");
const prestigeBtn = document.getElementById("prestige-btn");

// Prestige Overlay UI
const prestigeOverlay = document.getElementById("prestige-overlay");
const prestigeSummaryEl = document.getElementById("prestige-summary");
const prestigeWisdomUnlocksEl = document.getElementById("prestige-wisdom-unlocks");
const prestigeRebornBtn = document.getElementById("prestige-reborn-btn");

// Distillation UI (inside prestige overlay)
const prestigeDistillationEl = document.getElementById("prestige-distillation");

// Benchmarks UI
const benchmarksListEl = document.getElementById("benchmarks-list");
const benchmarksCounterEl = document.getElementById("benchmarks-counter");

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

// --- Telemetry helpers ---
function captureStateSnapshot(reason = "tick") {
  const hpMods = Calc.calcHyperparamModifiers(state.hyperparams, Date.now(), TUNING);
  const distBonus = Calc.calcDistillationBonus(state.modelVersion || 0, TUNING);
  let aps = Calc.calcTotalAps(state.producers, state.upgrades, state.wisdom, state.guacCount, TUNING, state.benchmarks);
  aps *= hpMods.apsMult * hpMods.globalMult * distBonus.apsMult * distBonus.allProdMult;

  SessionLog.record("state_snapshot", {
    avocadoCount: state.avocadoCount,
    totalAvocadosThisRun: state.totalAvocadosThisRun,
    guacCount: state.guacCount,
    wisdom: state.wisdom,
    prestigeCount: state.prestigeCount,
    aps,
    reason,
  });
}

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
      benchmarks: { ...(persisted.benchmarks || {}) },
      hyperparams: { ...defaults.hyperparams, ...(persisted.hyperparams || {}) },
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
  SessionLog.clear();
  sessionStorage.removeItem("AVO_session_id");
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
function renderProducerRows(listEl, order) {
  listEl.innerHTML = "";
  for (const id of order) {
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
    listEl.appendChild(row);
  }

}

function renderProducerList() {
  renderProducerRows(producersListEl, PRODUCER_ORDER);
}

function renderGuacProducerList() {
  renderProducerRows(guacProducersListEl, GUAC_PRODUCER_ORDER);
}

function renderBuyQuantitySelector() {
  const sectionTitle = producersListEl.closest(".section")?.querySelector(".section-title");
  if (!sectionTitle) return;
  // Remove existing bar if re-rendering after prestige
  const existing = sectionTitle.querySelector(".buy-qty-bar");
  if (existing) existing.remove();

  sectionTitle.style.display = "flex";
  sectionTitle.style.justifyContent = "space-between";
  sectionTitle.style.alignItems = "center";

  const bar = document.createElement("div");
  bar.className = "buy-qty-bar";
  const options = [1, 10, 100, "max"];
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.className = "buy-qty-tab" + (opt === 1 ? " active" : "");
    btn.type = "button";
    btn.textContent = opt === "max" ? "MAX" : String(opt);
    btn.addEventListener("click", () => {
      bar.querySelectorAll(".buy-qty-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      buyQuantity = opt;
      updateUI();
    });
    bar.appendChild(btn);
  }
  sectionTitle.appendChild(bar);
}

function renderGuacBuyQuantitySelector() {
  const sectionTitle = guacProducersListEl.closest(".section")?.querySelector(".section-title");
  if (!sectionTitle) return;
  // Remove existing bar if re-rendering after prestige
  const existing = sectionTitle.querySelector(".buy-qty-bar");
  if (existing) existing.remove();

  sectionTitle.style.display = "flex";
  sectionTitle.style.justifyContent = "space-between";
  sectionTitle.style.alignItems = "center";

  const bar = document.createElement("div");
  bar.className = "buy-qty-bar";
  const options = [1, 10, 100, "max"];
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.className = "buy-qty-tab" + (opt === 1 ? " active" : "");
    btn.type = "button";
    btn.textContent = opt === "max" ? "MAX" : String(opt);
    btn.addEventListener("click", () => {
      bar.querySelectorAll(".buy-qty-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      guacBuyQuantity = opt;
      updateUI();
    });
    bar.appendChild(btn);
  }
  sectionTitle.appendChild(bar);
}

const GUAC_PRODUCER_IDS = new Set(["guac_lab", "guac_refinery", "guac_centrifuge"]);

function getUpgradeCategory(cfg) {
  if (cfg.clickMult || cfg.apsPctPerClick) return "click";
  if (cfg.synergyPct) return "synergy";
  if (cfg.unlocksGuac || cfg.consumeExpDelta || cfg.produceExpDelta || cfg.baseProdMult) return "guac";
  if (cfg.producerId && GUAC_PRODUCER_IDS.has(cfg.producerId)) return "guac";
  if (cfg.globalMult || cfg.wisdomMult) return "global";
  if (cfg.producerId) return "production";
  return "global";
}

function renderUpgradeList() {
  upgradesListEl.innerHTML = "";
  for (const inv of INVESTMENTS) {
    const cfg = TUNING.upgrades[inv.id];
    const row = document.createElement("div");
    row.className = "upgrade-row";
    row.dataset.id = inv.id;
    row.dataset.category = getUpgradeCategory(cfg);
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

}

// --- Wisdom Unlock Purchasing (used in prestige overlay) ---
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

// --- Distillation Rendering (inside prestige overlay) ---
function renderDistillation() {
  if (!prestigeDistillationEl) return;
  const mv = state.modelVersion || 0;
  const dc = state.distillationCount || 0;
  const maxDistills = TUNING.distillation.costs.length;

  // Compute wisdom that will be available after prestige (including the gain from this compost)
  const wsld = (state.totalWisdomSinceLastDistill || 0) + overlayWisdomGain;
  const cost = Calc.calcDistillationCost(dc, TUNING);
  const shouldShow = mv > 0 || wsld >= Math.floor(cost * 0.5);

  const blockEl = document.getElementById("prestige-distillation-block");
  prestigeDistillationEl.innerHTML = "";
  if (!shouldShow) {
    if (blockEl) blockEl.style.display = "none";
    return;
  }
  if (blockEl) blockEl.style.display = "";

  const descEl = document.createElement("div");
  descEl.className = "muted";
  descEl.textContent = "Compress all knowledge into a new model version. Resets wisdom, producers, upgrades, and prestige count. Wisdom unlocks persist.";
  prestigeDistillationEl.appendChild(descEl);

  // Current model
  const headerEl = document.createElement("div");
  headerEl.className = "row";
  headerEl.innerHTML = `<div class="label">Current Model</div><div class="value">v${mv}.0</div>`;
  prestigeDistillationEl.appendChild(headerEl);

  // Progress to next
  if (dc < maxDistills) {
    const progressEl = document.createElement("div");
    progressEl.className = "row";
    progressEl.innerHTML = `<div class="label">Wisdom This Cycle (after compost)</div><div class="value">${wsld} / ${cost}</div>`;
    prestigeDistillationEl.appendChild(progressEl);

    const canDo = wsld >= cost;
    const btnEl = document.createElement("button");
    btnEl.className = "btn btn-danger";
    btnEl.type = "button";
    btnEl.textContent = "Compost & Distill";
    btnEl.disabled = !canDo;
    btnEl.addEventListener("click", () => {
      confirmPrestigeAndDistill();
    });
    const actionsEl = document.createElement("div");
    actionsEl.className = "actions";
    actionsEl.appendChild(btnEl);
    prestigeDistillationEl.appendChild(actionsEl);
    if (canDo) {
      const warnEl = document.createElement("div");
      warnEl.className = "muted";
      warnEl.style.marginTop = "4px";
      warnEl.textContent = "Warning: This will compost AND distill, resetting wisdom, producers, upgrades, and prestige count. Wisdom unlocks are kept.";
      prestigeDistillationEl.appendChild(warnEl);
    }
  } else {
    const doneEl = document.createElement("div");
    doneEl.className = "muted";
    doneEl.textContent = "Maximum model version reached.";
    prestigeDistillationEl.appendChild(doneEl);
  }

  // Version history
  const bonuses = TUNING.distillation.bonuses;
  for (let i = 0; i < bonuses.length; i++) {
    const b = bonuses[i];
    const earned = i < mv;
    const isNext = i === mv && dc < maxDistills;
    const row = document.createElement("div");
    row.className = `benchmark-row ${earned ? "earned" : "hint"}`;
    let prefix = earned ? "\u2713" : (isNext ? "\u2190 next" : "");
    row.innerHTML = `<strong>v${i + 1}.0</strong> ${prefix ? `<span class="${earned ? "benchmark-check" : "muted"}">${prefix}</span>` : ""} <span class="muted">${b.desc}</span>`;
    prestigeDistillationEl.appendChild(row);
  }
}

// --- Benchmarks Rendering ---
const BENCHMARK_PHASES = ["Early", "Mid", "Prestige", "Endgame"];

function renderBenchmarks() {
  if (!benchmarksListEl) return;
  benchmarksListEl.innerHTML = "";
  const total = BENCHMARK_ORDER.length;
  let earned = 0;
  let hintCount = 0;

  // Count earned
  for (const id of BENCHMARK_ORDER) {
    if (state.benchmarks[id]) earned++;
  }

  // Group benchmarks by phase
  for (const phase of BENCHMARK_PHASES) {
    const phaseIds = BENCHMARK_ORDER.filter(id => TUNING.benchmarks[id].phase === phase);
    if (phaseIds.length === 0) continue;

    const phaseEarned = phaseIds.filter(id => state.benchmarks[id]).length;
    const phaseTotal = phaseIds.length;
    const allEarned = phaseEarned === phaseTotal;

    // Phase header
    const header = document.createElement("div");
    header.className = "benchmark-phase-header";
    header.innerHTML = `<span>${phase}</span> <span class="muted">${phaseEarned}/${phaseTotal}</span>`;
    if (allEarned) header.classList.add("complete");
    benchmarksListEl.appendChild(header);

    // Phase content — earned benchmarks collapsed if all earned, else show earned + hints
    for (const id of phaseIds) {
      const cfg = TUNING.benchmarks[id];
      const isEarned = !!state.benchmarks[id];

      if (isEarned) {
        // If all earned in this phase, skip individual display
        if (allEarned) continue;
        const row = document.createElement("div");
        row.className = "benchmark-row earned";
        let bonusText = "";
        if (cfg.globalMult) bonusText = ` (+${Math.round(cfg.globalMult * 100)}% global)`;
        if (cfg.clickMult) bonusText = ` (+${Math.round(cfg.clickMult * 100)}% click)`;
        if (cfg.guacProdMult) bonusText = ` (+${Math.round(cfg.guacProdMult * 100)}% guac prod)`;
        if (cfg.guacMult) bonusText = ` (+${Math.round(cfg.guacMult * 100)}% guac mult)`;
        if (cfg.wisdomMult) bonusText = ` (+${Math.round(cfg.wisdomMult * 100)}% wisdom)`;
        row.innerHTML = `<span class="benchmark-check">\u2713</span> <strong>${cfg.title}</strong>${bonusText}`;
        benchmarksListEl.appendChild(row);
      } else if (hintCount < 3) {
        hintCount++;
        const row = document.createElement("div");
        row.className = "benchmark-row hint";
        row.innerHTML = `<span class="benchmark-lock">?</span> ${cfg.desc}`;
        benchmarksListEl.appendChild(row);
      }
    }
  }

  if (benchmarksCounterEl) {
    benchmarksCounterEl.textContent = `${earned} / ${total}`;
  }
}

// --- UI Update (per tick) ---
let tickCount = 0;

function updateUI() {
  const hpMods = Calc.calcHyperparamModifiers(state.hyperparams, Date.now(), TUNING);
  const distBonus = Calc.calcDistillationBonus(state.modelVersion || 0, TUNING);
  let aps = Calc.calcTotalAps(state.producers, state.upgrades, state.wisdom, state.guacCount, TUNING, state.benchmarks);
  aps *= hpMods.apsMult * hpMods.globalMult * distBonus.apsMult * distBonus.allProdMult;
  const baseAps = Calc.calcBaseAps(state.producers, state.upgrades, TUNING);
  let clickPower = Calc.calcClickPower(state.upgrades, state.producers, state.wisdom, state.guacCount, baseAps, TUNING, state.benchmarks);
  clickPower *= hpMods.clickMult * hpMods.globalMult;
  // Distillation click base bonus + multiplier
  clickPower += distBonus.clickBaseBonus;
  clickPower *= distBonus.apsMult * distBonus.allProdMult;

  // Dynamic game title based on model version
  const gameTitle = (state.modelVersion || 0) >= 1 ? "Avocado Intelligence" : "Avocado";
  if (gameTitleEl) gameTitleEl.textContent = gameTitle;
  document.title = gameTitle;

  avocadoCountEl.textContent = Calc.formatNumber(state.avocadoCount);
  apsCountEl.textContent = Calc.formatNumber(aps);


  // Guac row — show when guac protocol owned
  const hasGuac = !!state.upgrades.guac_unlock;
  guacRowEl.style.display = hasGuac ? "" : "none";
  const labs = state.producers.guac_lab || 0;
  const refineries = state.producers.guac_refinery || 0;
  const centrifuges = state.producers.guac_centrifuge || 0;
  if (hasGuac) {
    if (labs > 0) {
      const guacPerSec = Calc.calcGuacProduction(labs, TUNING, state.upgrades, state.wisdomUnlocks, state.prestigeCount, state.benchmarks);
      guacCountEl.textContent = `${Calc.formatNumber(state.guacCount)} (+${Calc.formatRate(guacPerSec)}/sec)`;
    } else {
      guacCountEl.textContent = `${Calc.formatNumber(state.guacCount)} (need Guac Labs)`;
    }
  }

  // Guac multiplier row — show when guac > 0
  const guacMult = Calc.calcGuacMultiplier(state.guacCount, TUNING, state.benchmarks);
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
  const wisdomMult = Calc.calcWisdomBonus(state.wisdom, state.upgrades, TUNING, state.benchmarks);
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

  // Model version bar
  const modelBarEl = document.getElementById("model-bar");
  if (modelBarEl) {
    const mv = state.modelVersion || 0;
    modelBarEl.style.display = mv > 0 ? "" : "none";
    if (mv > 0) {
      document.getElementById("model-bar-label").textContent = `◆ Model v${mv}.0`;
      const tooltipEl = document.getElementById("model-bar-tooltip");
      const lines = [];
      if (distBonus.apsMult !== 1) lines.push(`APS ×${distBonus.apsMult.toFixed(1)}`);
      if (distBonus.allProdMult !== 1) lines.push(`All production ×${distBonus.allProdMult.toFixed(1)}`);
      if (distBonus.clickBaseBonus > 0) lines.push(`+${distBonus.clickBaseBonus} base click power`);
      if (distBonus.guacProdMult !== 1) lines.push(`Guac production ×${distBonus.guacProdMult.toFixed(1)}`);
      if (distBonus.costMult !== 1) lines.push(`Producer costs ×${distBonus.costMult.toFixed(2)}`);
      if (distBonus.startingWisdom > 0) lines.push(`+${distBonus.startingWisdom} starting wisdom on prestige`);
      if (distBonus.multiplierCoeffBonus > 0) lines.push(`Guac mult coeff +${distBonus.multiplierCoeffBonus.toFixed(2)}`);
      if (distBonus.consumeFloorBonus !== 0) lines.push(`Consume floor ${distBonus.consumeFloorBonus.toFixed(2)}`);
      if (distBonus.wisdomEarnMult !== 1) lines.push(`Wisdom earn rate ×${distBonus.wisdomEarnMult.toFixed(1)}`);
      if (distBonus.unlocksFoundationModel) lines.push(`Foundation Model unlocked`);
      tooltipEl.textContent = lines.join("  ·  ");
    }
  }

  // Hyperparams row — show when tuned (any non-default)
  const hpRowEl = document.getElementById("hyperparams-row");
  if (hpRowEl) {
    const isDefault = state.hyperparams.learningRate === "conservative"
      && state.hyperparams.batchSize === "small"
      && state.hyperparams.regularization === "none";
    hpRowEl.style.display = (state.prestigeCount >= 1 && !isDefault) ? "" : "none";
    if (!isDefault) {
      const hpValEl = document.getElementById("hyperparams-val");
      if (hpValEl) hpValEl.textContent = `${state.hyperparams.learningRate} / ${state.hyperparams.batchSize} / ${state.hyperparams.regularization}`;
    }
  }

  // Tune button visibility
  const tuneBtn = document.getElementById("tune-btn");
  if (tuneBtn) {
    tuneBtn.style.display = state.prestigeCount >= 1 ? "" : "none";
    const now = Date.now();
    const elapsed = now - (state.hyperparams.lastTuneTime || 0);
    const cooldownMs = TUNING.hyperparams.cooldownMs;
    if (elapsed < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
      tuneBtn.disabled = true;
      tuneBtn.textContent = `Tune Hyperparams (${remaining}s)`;
    } else {
      tuneBtn.disabled = false;
      tuneBtn.textContent = "Tune Hyperparams";
    }
  }

  // Guac section visibility — show when guac is unlocked
  if (guacSectionEl) {
    guacSectionEl.style.display = hasGuac ? "" : "none";
  }

  // Current APS for gating
  const currentAps = aps;
  const ctx = { currentAps };

  // Guac lab unlock gating
  const guacLabUnlocked = currentAps >= TUNING.guac.labUnlockAps || (state.producers.guac_lab || 0) > 0;

  // --- Standard producer rows ---
  updateProducerRows(producersListEl, PRODUCER_ORDER, distBonus, hpMods, currentAps, guacLabUnlocked, TUNING.reveal.producerLookahead, buyQuantity);

  // --- Guac producer rows ---
  updateProducerRows(guacProducersListEl, GUAC_PRODUCER_ORDER, distBonus, hpMods, currentAps, guacLabUnlocked, TUNING.reveal.guacProducerLookahead, guacBuyQuantity);

  // Upgrade rows: move between Research / Owned tabs (with lookahead + threshold)
  const upgradeLookaheadLimit = TUNING.reveal.upgradeLookahead;
  const upgradeCostThreshold = TUNING.reveal.costThreshold;
  let upgradeLookaheadUsed = 0;
  let firstEligibleUpgradeSeen = false;

  for (const inv of INVESTMENTS) {
    const row = upgradesListEl.querySelector(`[data-id="${inv.id}"]`)
             || upgradesOwnedListEl.querySelector(`[data-id="${inv.id}"]`);
    if (!row) continue;

    const owned = inv.isOwned(state);

    // 1. Owned: move to Owned tab, no lookahead consumed
    if (owned) {
      if (row.parentNode !== upgradesOwnedListEl) {
        row.classList.add("owned");
        const btn = row.querySelector(`[data-upgrade="${inv.id}"]`);
        if (btn) btn.remove();
        upgradesOwnedListEl.appendChild(row);
      }
      row.style.display = "";
      continue;
    }

    // Move back to research list if needed (e.g. after prestige)
    if (row.parentNode !== upgradesListEl) {
      row.classList.remove("owned");
      const info = row.querySelector(".upgrade-info");
      if (!row.querySelector(`[data-upgrade="${inv.id}"]`) && info) {
        const btn = document.createElement("button");
        btn.className = "btn upgrade-buy";
        btn.dataset.upgrade = inv.id;
        btn.type = "button";
        btn.innerHTML = `<span data-ucost="${inv.id}">${Calc.formatNumber(inv.cost())}</span>`;
        row.appendChild(btn);
      }
      upgradesListEl.appendChild(row);
    }

    // 2. isUnlocked gate: fails and not already revealed → hidden, no slot consumed
    const unlocked = inv.isUnlocked(state, ctx);
    if (!unlocked && !revealedUpgrades.has(inv.id)) {
      row.style.display = "none";
      continue;
    }

    // 3. Lookahead check: if at limit and not already revealed → hidden
    if (upgradeLookaheadUsed >= upgradeLookaheadLimit && !revealedUpgrades.has(inv.id)) {
      row.style.display = "none";
      continue;
    }

    // 4. Consume a lookahead slot
    upgradeLookaheadUsed++;

    // 5. Threshold check: first eligible always visible; others need >= costThreshold
    const upgradeCost = inv.cost();
    if (!firstEligibleUpgradeSeen) {
      firstEligibleUpgradeSeen = true;
      revealedUpgrades.add(inv.id);
    } else if (state.avocadoCount >= upgradeCost * upgradeCostThreshold) {
      revealedUpgrades.add(inv.id);
    }

    // 6. If revealed → show; otherwise hidden (slot consumed)
    if (!revealedUpgrades.has(inv.id)) {
      row.style.display = "none";
      continue;
    }

    row.style.display = "";
    const btn = row.querySelector(`[data-upgrade="${inv.id}"]`);
    if (btn) {
      btn.disabled = !inv.canPurchase(state);
      const costEl = btn.querySelector(`[data-ucost="${inv.id}"]`);
      if (costEl) {
        costEl.textContent = Calc.formatNumber(upgradeCost);
      } else {
        btn.innerHTML = `<span data-ucost="${inv.id}">${Calc.formatNumber(upgradeCost)}</span>`;
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
}

function updateProducerRows(listEl, order, distBonus, hpMods, currentAps, guacLabUnlocked, lookaheadLimit, qty) {
  const refineries = state.producers.guac_refinery || 0;
  const centrifuges = state.producers.guac_centrifuge || 0;
  const costThreshold = TUNING.reveal.costThreshold;
  const combinedCostMult = distBonus.costMult * hpMods.costMult;
  let lookaheadUsed = 0;
  let firstEligibleSeen = false;

  for (const id of order) {
    const owned = state.producers[id] || 0;
    const singleCost = Math.floor(Calc.calcProducerCost(id, owned, TUNING) * combinedCostMult);
    const unitRate = Calc.calcProducerUnitRate(id, state.upgrades, TUNING);

    // Compute display cost and effective quantity based on qty
    let effectiveQty;
    let displayCost;
    if (qty === "max") {
      effectiveQty = Calc.calcMaxAffordable(id, owned, state.avocadoCount, TUNING, combinedCostMult);
      displayCost = effectiveQty > 0
        ? Calc.calcBulkProducerCost(id, owned, effectiveQty, TUNING, combinedCostMult)
        : singleCost;
    } else {
      effectiveQty = qty;
      displayCost = Calc.calcBulkProducerCost(id, owned, qty, TUNING, combinedCostMult);
    }
    const canAfford = state.avocadoCount >= displayCost && effectiveQty > 0;

    const row = listEl.querySelector(`[data-id="${id}"]`);
    const countEl = listEl.querySelector(`[data-count="${id}"]`);
    const costEl = listEl.querySelector(`[data-cost="${id}"]`);
    const rateEl = listEl.querySelector(`[data-rate="${id}"]`);
    const buyBtn = listEl.querySelector(`[data-buy="${id}"]`);
    const descEl = listEl.querySelector(`[data-desc="${id}"]`);

    const cfg = TUNING.producers[id];

    // Format buy button label
    const costLabel = effectiveQty > 1
      ? `${Calc.formatNumber(displayCost)} (\u00d7${effectiveQty})`
      : Calc.formatNumber(displayCost);

    // 1. Hard gate: prestige-gated producers hidden until enough prestiges
    if (cfg.minPrestigeCount && (state.prestigeCount || 0) < cfg.minPrestigeCount && owned === 0) {
      if (row) row.style.display = "none";
      continue;
    }

    // 1b. Hard gate: foundation model requires model v5.0
    if (id === "foundation_model" && !distBonus.unlocksFoundationModel && owned === 0) {
      if (row) row.style.display = "none";
      continue;
    }

    // 2. Owned: always visible, no lookahead consumed
    if (owned > 0) {
      if (row) { row.style.display = ""; row.classList.remove("locked"); }
      if (descEl) descEl.textContent = cfg.desc;
      if (countEl) countEl.textContent = `(${owned} owned)`;
      if (costEl) costEl.textContent = costLabel;
      const synergyMult = Calc.calcSynergyMultiplier(id, state.producers, state.upgrades, TUNING);
      const effectiveUnitRate = unitRate * synergyMult;
      let rateText = `Producing ${Calc.formatRate(effectiveUnitRate * owned)} avocados/sec (${Calc.formatRate(effectiveUnitRate)} each)`;
      if (synergyMult > 1) {
        rateText += ` [synergy x${synergyMult.toFixed(2)}]`;
      }
      if (id === "guac_lab" && state.upgrades.guac_unlock) {
        const consumption = Calc.calcGuacConsumption(owned, TUNING, refineries, state.upgrades, state.wisdomUnlocks, state.prestigeCount, state.guacCount);
        const guacOut = Calc.calcGuacProduction(owned, TUNING, state.upgrades, state.wisdomUnlocks, state.prestigeCount, state.benchmarks);
        rateText += ` | Consumes ${Calc.formatRate(consumption)} avo/sec \u2192 ${Calc.formatRate(guacOut)} guac/sec`;
      }
      if (id === "guac_refinery") {
        const effExp = Calc.calcEffectiveConsumeExponent(owned, state.upgrades, state.wisdomUnlocks, state.prestigeCount, TUNING);
        rateText = `Consume exponent: ${effExp.toFixed(2)} (base ${TUNING.guac.consumeExponent})`;
      }
      if (id === "guac_centrifuge") {
        rateText = `Centrifuge effect: -${(centrifuges * 0.005).toFixed(3)} consume exponent`;
      }
      if (rateEl) rateEl.textContent = rateText;
      if (buyBtn) buyBtn.disabled = !canAfford;
      continue;
    }

    // 3. Lookahead check: if at limit and not already revealed, hide
    if (lookaheadUsed >= lookaheadLimit && !revealedProducers.has(id)) {
      if (row) row.style.display = "none";
      continue;
    }

    // 4. Consume a lookahead slot (whether or not threshold is met)
    lookaheadUsed++;

    // 5. Soft gate checks — show as LOCKED if fail
    let softLocked = false;
    let lockMessage = "";
    // Wisdom unlock gate for producers
    if (cfg.requiresWisdomUnlock && !state.wisdomUnlocks[cfg.requiresWisdomUnlock]) {
      const unlockCfg = TUNING.wisdomUnlocks[cfg.requiresWisdomUnlock];
      softLocked = true;
      lockMessage = `Requires wisdom unlock: ${unlockCfg ? unlockCfg.title : cfg.requiresWisdomUnlock}`;
    } else if (id === "guac_lab" && !guacLabUnlocked) {
      softLocked = true;
      lockMessage = `Requires ${TUNING.guac.labUnlockAps} avocados/sec to unlock.`;
    } else if (id === "guac_refinery" && (state.producers.guac_lab || 0) === 0) {
      softLocked = true;
      lockMessage = "Requires at least 1 Guacamole Lab.";
    } else if (id === "guac_centrifuge" && (state.producers.guac_refinery || 0) < 3) {
      softLocked = true;
      lockMessage = "Requires at least 3 Guac Refineries.";
    }

    if (softLocked) {
      // Soft-locked items are always revealed (visible once in window)
      revealedProducers.add(id);
      if (row) { row.style.display = ""; row.classList.add("locked"); }
      if (descEl) descEl.textContent = lockMessage;
      if (buyBtn) buyBtn.disabled = true;
      if (rateEl) rateEl.textContent = "";
      if (countEl) countEl.textContent = "";
      if (costEl) costEl.textContent = Calc.formatNumber(Calc.calcProducerCost(id, 0, TUNING));
      continue;
    }

    // 6. Threshold check: first eligible always visible; others need >= costThreshold
    // Use singleCost for reveal gating, not bulk cost
    if (!firstEligibleSeen) {
      firstEligibleSeen = true;
      revealedProducers.add(id);
    } else if (state.avocadoCount >= singleCost * costThreshold) {
      revealedProducers.add(id);
    }

    // 7. If revealed (sticky) → show normally; otherwise hidden (slot consumed)
    if (!revealedProducers.has(id)) {
      if (row) row.style.display = "none";
      continue;
    }

    if (row) { row.style.display = ""; row.classList.remove("locked"); }
    if (descEl) descEl.textContent = cfg.desc;
    if (countEl) countEl.textContent = "";
    if (costEl) costEl.textContent = costLabel;
    let rateText = `Each produces ${Calc.formatRate(unitRate)} avocados/sec`;
    if (id === "guac_lab" && state.upgrades.guac_unlock) {
      rateText += ` | Also converts avocados \u2192 guac`;
    }
    if (id === "guac_refinery") {
      rateText = `Each refinery lowers consume exponent by 0.01`;
    }
    if (id === "guac_centrifuge") {
      rateText = `Each centrifuge lowers consume exponent by 0.005`;
    }
    if (rateEl) rateEl.textContent = rateText;
    if (buyBtn) buyBtn.disabled = !canAfford;
  }
}

// --- Actions ---
function spawnClickEmoji(value) {
  const rect = pickAvocadoBtn.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "click-emoji";
  el.innerHTML = `\u{1f951} <span class="click-value">+${Calc.formatNumber(value)}</span>`;
  // Random angle within ±15° from straight up
  const angle = (Math.random() - 0.5) * 60 * (Math.PI / 180);
  const dx = Math.sin(angle) * 120;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top + rect.height / 2}px`;
  el.style.transform = "translate(-50%, -50%)";
  el.style.setProperty("--dx", `${dx}px`);
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function dismissIdlePrompt() {
  const el = document.getElementById("idle-prompt");
  if (!el || !idlePromptShowing) return;
  el.classList.remove("pulsing");
  el.classList.add("dismissing");
  idlePromptShowing = false;
  el.addEventListener("animationend", () => {
    el.classList.remove("dismissing");
  }, { once: true });
}

function pickAvocado() {
  lastClickTime = Date.now();
  if (idlePromptShowing) dismissIdlePrompt();

  const hpMods = Calc.calcHyperparamModifiers(state.hyperparams, Date.now(), TUNING);
  const baseAps = Calc.calcBaseAps(state.producers, state.upgrades, TUNING);
  let power = Calc.calcClickPower(state.upgrades, state.producers, state.wisdom, state.guacCount, baseAps, TUNING, state.benchmarks);
  power *= hpMods.clickMult * hpMods.globalMult;
  state.avocadoCount += power;
  state.totalAvocadosThisRun += power;
  state.totalAvocadosAllTime += power;
  recordClick();
  spawnClickEmoji(power);

  // Flavor text (1-in-10 chance)
  if (Math.random() < 0.1) {
    const msg = CLICK_MESSAGES[Math.floor(Math.random() * CLICK_MESSAGES.length)];
    logLine(msg);
  }

  updateUI();
}

function confirmPrestigeAndDistill() {
  if (!confirm("Compost AND Distill? This resets wisdom, producers, upgrades, and prestige count. Wisdom unlocks and benchmarks are kept. You gain a permanent Model Version upgrade.")) return;

  // First apply the prestige wisdom gain to totalWisdomSinceLastDistill
  const wisdomGain = overlayWisdomGain;
  const newTotalWisdomSinceLastDistill = (state.totalWisdomSinceLastDistill || 0) + wisdomGain;
  const newTotalWisdomEarned = (state.totalWisdomEarned || 0) + wisdomGain;

  const newModelVersion = (state.modelVersion || 0) + 1;
  const newDistillationCount = (state.distillationCount || 0) + 1;
  const keptBenchmarks = { ...state.benchmarks };
  const keptAllTime = state.totalAvocadosAllTime;

  // Full reset — wisdom unlocks persist through distillation (wisdom itself resets to 0,
  // and prestigeCount resets so scaling unlocks lose their effect until re-earned)
  const keptWisdomUnlocks = { ...state.wisdomUnlocks };

  const fresh = createDefaultState();
  state.avocadoCount = 0;
  state.totalAvocadosThisRun = 0;
  state.totalAvocadosAllTime = keptAllTime;
  state.guacCount = 0;
  state.producers = fresh.producers;
  state.upgrades = {};
  state.wisdom = 0;
  state.wisdomUnlocks = keptWisdomUnlocks;
  state.prestigeCount = 0;
  state.benchmarks = keptBenchmarks;
  state.totalWisdomEarned = newTotalWisdomEarned;
  state.totalWisdomSinceLastDistill = 0;
  state.hyperparams = fresh.hyperparams;
  state.modelVersion = newModelVersion;
  state.distillationCount = newDistillationCount;

  // Apply starting wisdom from new model version
  const distBonus = Calc.calcDistillationBonus(newModelVersion, TUNING);
  if (distBonus.startingWisdom > 0) {
    state.wisdom += distBonus.startingWisdom;
  }

  // Reset milestones
  lastMilestoneReached = 0;
  lastGuacMultMilestone = 1;
  revealedProducers.clear();
  revealedUpgrades.clear();
  setResearchTab("research");

  SessionLog.record("distill", { modelVersion: newModelVersion, distillationCount: newDistillationCount });
  logLine(`\u267b\ufe0f The orchard collapses into nutrient memory.`);
  logLine(`Model distilled to v${newModelVersion}.0!`);
  const bonus = TUNING.distillation.bonuses[newModelVersion - 1];
  if (bonus) logLine(bonus.flavor);

  closePrestigeOverlay();
  saveGame();
  renderProducerList();
  renderBuyQuantitySelector();
  renderGuacProducerList();
  renderGuacBuyQuantitySelector();
  buyQuantity = 1;
  guacBuyQuantity = 1;
  renderUpgradeList();
  renderBenchmarks();
  updateUI();
}

function buyProducer(id) {
  // Wisdom unlock gating for producers
  const producerCfg = TUNING.producers[id];
  if (producerCfg.requiresWisdomUnlock && !state.wisdomUnlocks[producerCfg.requiresWisdomUnlock]) return;

  // Guac lab gating — need enough APS to feed the lab
  if (id === "guac_lab" && (state.producers.guac_lab || 0) === 0) {
    const currentAps = Calc.calcTotalAps(state.producers, state.upgrades, state.wisdom, state.guacCount, TUNING, state.benchmarks);
    if (currentAps < TUNING.guac.labUnlockAps) return;
  }

  // Guac centrifuge gating — need 3+ refineries
  if (id === "guac_centrifuge" && (state.producers.guac_centrifuge || 0) === 0) {
    if ((state.producers.guac_refinery || 0) < 3) return;
  }

  // Prestige gating
  const cfg = TUNING.producers[id];
  if (cfg.minPrestigeCount && (state.prestigeCount || 0) < cfg.minPrestigeCount) return;

  const hpModsBuy = Calc.calcHyperparamModifiers(state.hyperparams, Date.now(), TUNING);
  const distBonusBuy = Calc.calcDistillationBonus(state.modelVersion || 0, TUNING);
  const combinedCostMult = distBonusBuy.costMult * hpModsBuy.costMult;

  // Determine how many to buy
  const startOwned = state.producers[id] || 0;
  const activeBuyQty = GUAC_PRODUCER_ORDER.includes(id) ? guacBuyQuantity : buyQuantity;
  let qty;
  if (activeBuyQty === "max") {
    qty = Calc.calcMaxAffordable(id, startOwned, state.avocadoCount, TUNING, combinedCostMult);
  } else {
    qty = activeBuyQty;
  }
  if (qty <= 0) return;

  // Buy loop — one at a time for correct scaling
  let bought = 0;
  let totalCost = 0;
  for (let i = 0; i < qty; i++) {
    const owned = state.producers[id] || 0;
    const cost = Math.floor(Calc.calcProducerCost(id, owned, TUNING) * combinedCostMult);
    if (state.avocadoCount < cost) break;
    state.avocadoCount -= cost;
    state.producers[id] = owned + 1;
    totalCost += cost;
    bought++;
  }

  if (bought === 0) return;

  const endCount = state.producers[id];
  if (bought === 1) {
    SessionLog.record("purchase", { kind: "producer", id, title: cfg.title, count: endCount, cost: totalCost });
    logLine(`Bought ${cfg.title} (#${endCount})`);
  } else {
    SessionLog.record("purchase", { kind: "producer", id, title: cfg.title, count: endCount, bought, cost: totalCost });
    logLine(`Bought ${bought} ${cfg.title} (#${startOwned + 1}-${endCount})`);
  }
  saveGame();
  updateUI();
}

function buyUpgrade(id) {
  const inv = INVESTMENTS.find(i => i.id === id);
  if (!inv || inv.isOwned(state) || !inv.canPurchase(state)) return;

  inv.purchase(state);
  const cfg = TUNING.upgrades[id];
  SessionLog.record("purchase", { kind: "upgrade", id, title: cfg.title });
  logLine(`Research complete: ${cfg.title}`);
  saveGame();
  updateUI();
}

// --- Prestige Overlay ---
let overlayWisdomGain = 0;
let overlayPurchases = {};

function openPrestigeOverlay() {
  if (!Calc.canPrestige(state.totalAvocadosThisRun, TUNING)) return;

  const distBonus = Calc.calcDistillationBonus(state.modelVersion || 0, TUNING);
  overlayWisdomGain = Math.floor(Calc.calcWisdomEarned(state.totalAvocadosThisRun, TUNING) * distBonus.wisdomEarnMult);
  overlayPurchases = {};

  const newPrestigeCount = (state.prestigeCount || 0) + 1;
  const totalWisdom = state.wisdom + overlayWisdomGain;

  // Build summary
  prestigeSummaryEl.innerHTML = "";
  const rows = [
    ["Prestige #", `${newPrestigeCount}`],
    ["Avocados This Run", Calc.formatNumber(state.totalAvocadosThisRun)],
    ["Wisdom Gained", `+${overlayWisdomGain}`],
    ["Total Wisdom After", `${totalWisdom}`],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
    prestigeSummaryEl.appendChild(row);
  }

  // Build wisdom unlocks
  renderPrestigeWisdomUnlocks(totalWisdom);

  // Build distillation section
  renderDistillation();

  prestigeOverlay.classList.add("active");
  prestigeOverlay.setAttribute("aria-hidden", "false");
}

function renderPrestigeWisdomUnlocks(availableWisdom) {
  prestigeWisdomUnlocksEl.innerHTML = "";

  const hasAnyUnlocks = Object.keys(TUNING.wisdomUnlocks).length > 0;
  const blockEl = document.getElementById("prestige-wisdom-unlocks-block");
  if (!hasAnyUnlocks) {
    if (blockEl) blockEl.style.display = "none";
    return;
  }
  if (blockEl) blockEl.style.display = "";

  const descEl = document.createElement("div");
  descEl.className = "muted";
  descEl.textContent = "Permanent upgrades bought with Wisdom. Persist through prestige.";
  prestigeWisdomUnlocksEl.appendChild(descEl);

  let remainingWisdom = availableWisdom;
  // Subtract already-purchased overlayPurchases
  for (const id of Object.keys(overlayPurchases)) {
    remainingWisdom -= TUNING.wisdomUnlocks[id].wisdomCost;
  }

  const wisdomLabel = document.createElement("div");
  wisdomLabel.className = "row";
  wisdomLabel.id = "overlay-wisdom-remaining";
  wisdomLabel.innerHTML = `<div class="label">Remaining Wisdom</div><div class="value">${remainingWisdom}</div>`;
  prestigeWisdomUnlocksEl.appendChild(wisdomLabel);

  for (const [id, cfg] of Object.entries(TUNING.wisdomUnlocks)) {
    const alreadyOwned = !!state.wisdomUnlocks[id];
    const overlayBought = !!overlayPurchases[id];
    const isOwned = alreadyOwned || overlayBought;

    const row = document.createElement("div");
    row.className = `upgrade-row${isOwned ? " owned" : ""}`;
    row.innerHTML = `
      <div class="upgrade-info">
        <div class="upgrade-title">${cfg.title}</div>
        <div class="upgrade-desc">${cfg.desc}</div>
      </div>
    `;

    if (isOwned) {
      const badge = document.createElement("span");
      badge.className = "muted";
      badge.textContent = "Owned";
      row.appendChild(badge);
    } else {
      const btn = document.createElement("button");
      btn.className = "btn upgrade-buy";
      btn.type = "button";
      btn.textContent = `${cfg.wisdomCost} Wisdom`;
      btn.disabled = remainingWisdom < cfg.wisdomCost;
      btn.addEventListener("click", () => {
        overlayPurchases[id] = true;
        const totalWisdom = state.wisdom + overlayWisdomGain;
        renderPrestigeWisdomUnlocks(totalWisdom);
      });
      row.appendChild(btn);
    }

    prestigeWisdomUnlocksEl.appendChild(row);
  }
}

function closePrestigeOverlay() {
  prestigeOverlay.classList.remove("active");
  prestigeOverlay.setAttribute("aria-hidden", "true");
}

function confirmPrestige() {
  const distBonus = Calc.calcDistillationBonus(state.modelVersion || 0, TUNING);
  const wisdomGain = overlayWisdomGain;
  const allTime = state.totalAvocadosAllTime;
  const newWisdom = state.wisdom + wisdomGain;
  const keptWisdomUnlocks = { ...state.wisdomUnlocks };
  const newPrestigeCount = (state.prestigeCount || 0) + 1;
  const keptBenchmarks = { ...state.benchmarks };
  const newTotalWisdomEarned = (state.totalWisdomEarned || 0) + wisdomGain;
  const newTotalWisdomSinceLastDistill = (state.totalWisdomSinceLastDistill || 0) + wisdomGain;

  // Apply overlay wisdom unlock purchases
  for (const id of Object.keys(overlayPurchases)) {
    const cfg = TUNING.wisdomUnlocks[id];
    keptWisdomUnlocks[id] = true;
    // Deduct cost from newWisdom (we already computed it in overlay)
  }
  let wisdomAfterPurchases = newWisdom;
  for (const id of Object.keys(overlayPurchases)) {
    if (!state.wisdomUnlocks[id]) { // only deduct for new purchases
      wisdomAfterPurchases -= TUNING.wisdomUnlocks[id].wisdomCost;
    }
  }

  // Reset run state
  state.avocadoCount = 0;
  state.totalAvocadosThisRun = 0;
  state.totalAvocadosAllTime = allTime; // keep all-time
  state.guacCount = 0;
  state.producers = createDefaultState().producers;
  state.upgrades = {};
  state.wisdom = wisdomAfterPurchases;
  state.wisdomUnlocks = keptWisdomUnlocks; // persists through prestige
  state.prestigeCount = newPrestigeCount;
  state.benchmarks = keptBenchmarks; // benchmarks persist forever
  state.totalWisdomEarned = newTotalWisdomEarned;
  state.totalWisdomSinceLastDistill = newTotalWisdomSinceLastDistill;
  state.hyperparams = createDefaultState().hyperparams;
  // Distillation state persists through prestige
  // Apply starting wisdom bonus from distillation
  if (distBonus.startingWisdom > 0) {
    state.wisdom += distBonus.startingWisdom;
  }

  // Reset milestones
  lastMilestoneReached = 0;
  lastGuacMultMilestone = 1;
  revealedProducers.clear();
  revealedUpgrades.clear();

  // Reset research tab to "Research"
  setResearchTab("research");

  SessionLog.record("prestige", { wisdomGain, prestigeCount: newPrestigeCount });
  logLine(`\u267b\ufe0f The orchard collapses into nutrient memory.`);
  logLine(`\u2728 You gained ${wisdomGain} Wisdom. (Prestige #${newPrestigeCount})`);

  closePrestigeOverlay();
  saveGame();
  renderProducerList();
  renderBuyQuantitySelector();
  renderGuacProducerList();
  renderGuacBuyQuantitySelector();
  buyQuantity = 1;
  guacBuyQuantity = 1;
  renderUpgradeList();
  renderBenchmarks();
  updateUI();
}

function prestige() {
  if (!Calc.canPrestige(state.totalAvocadosThisRun, TUNING)) return;
  openPrestigeOverlay();
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
    const hpMods = Calc.calcHyperparamModifiers(state.hyperparams, now, TUNING);
    const distBonus = Calc.calcDistillationBonus(state.modelVersion || 0, TUNING);
    let aps = Calc.calcTotalAps(state.producers, state.upgrades, state.wisdom, state.guacCount, TUNING, state.benchmarks);
    aps *= hpMods.apsMult * hpMods.globalMult * distBonus.apsMult * distBonus.allProdMult;
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
      const centrifuges = state.producers.guac_centrifuge || 0;
      // Centrifuge effect: each lowers consumeExponent by 0.005 (applied via extra refinery-equivalent count)
      // We pass refineries to calcGuacConsumption which handles refinery reduction;
      // centrifuge effect is additional, so we adjust the refinery count for calc purposes
      const effectiveRefineries = refineries + centrifuges * 0.5; // 0.5 * 0.01 = 0.005 per centrifuge
      const desiredConsumption = Calc.calcGuacConsumption(labs, TUNING, effectiveRefineries, state.upgrades, state.wisdomUnlocks, state.prestigeCount, state.guacCount) * dt * hpMods.guacConsumeMult;
      const actualConsumption = Math.min(desiredConsumption, state.avocadoCount);
      if (actualConsumption > 0) {
        state.avocadoCount -= actualConsumption;
        // Guac produced proportional to actual vs desired consumption
        const fullGuac = Calc.calcGuacProduction(labs, TUNING, state.upgrades, state.wisdomUnlocks, state.prestigeCount, state.benchmarks) * dt;
        state.guacCount += desiredConsumption > 0 ? fullGuac * (actualConsumption / desiredConsumption) : 0;
      }
      // Debug log when underfed (throttled to every ~5s)
      if (actualConsumption < desiredConsumption && now - lastUnderfedLogTime > 5000) {
        lastUnderfedLogTime = now;
        logLine("\u26a0\ufe0f Guac Labs are underfed.");
      }
    }

    // Guac multiplier milestones (log every 0.25 increase)
    const guacMult = Calc.calcGuacMultiplier(state.guacCount, TUNING, state.benchmarks);
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

    // Check benchmarks every 5th tick (~1/s)
    if (tickCount % 5 === 0) {
      const newBenchmarks = checkBenchmarks(state, aps);
      for (const id of newBenchmarks) {
        state.benchmarks[id] = true;
        const cfg = TUNING.benchmarks[id];
        logLine(`Benchmark: ${cfg.title}`);
      }
      if (newBenchmarks.length > 0) {
        renderBenchmarks();
      }
    }

    // Telemetry snapshot every 5 ticks (~1s)
    tickCount++;
    if (tickCount % 5 === 0) captureStateSnapshot("tick");

    // Auto-save every ~5s
    if (tickCount % 25 === 0) saveGame();

    // Idle click prompt — show after 60s of no clicks
    if (!idlePromptShowing && now - lastClickTime >= 60000) {
      const el = document.getElementById("idle-prompt");
      if (el) {
        el.classList.remove("dismissing");
        el.classList.add("pulsing");
        idlePromptShowing = true;
      }
    }

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

// --- Bonuses Modal ---
const bonusesModal = document.getElementById("bonuses-modal");
const bonusesModalBody = document.getElementById("bonuses-modal-body");
const bonusesBtn = document.getElementById("bonuses-btn");
const bonusesCloseBtn = document.getElementById("bonuses-close-btn");

function openBonusesModal() {
  renderBonusesModal();
  bonusesModal.classList.add("active");
  bonusesModal.setAttribute("aria-hidden", "false");
}

function closeBonusesModal() {
  bonusesModal.classList.remove("active");
  bonusesModal.setAttribute("aria-hidden", "true");
}

function renderBonusesModal() {
  bonusesModalBody.innerHTML = "";

  // Helper to create a section
  function addSection(title) {
    const sec = document.createElement("div");
    sec.className = "bonuses-section";
    const h = document.createElement("div");
    h.className = "bonuses-section-title";
    h.textContent = title;
    sec.appendChild(h);
    bonusesModalBody.appendChild(sec);
    return sec;
  }

  // Helper to create a row
  function addRow(parent, label, value) {
    const row = document.createElement("div");
    row.className = "bonuses-row";
    row.innerHTML = `<span class="bonuses-label">${label}</span> <span class="bonuses-value">${value}</span>`;
    parent.appendChild(row);
  }

  // 1. Wisdom
  if (state.wisdom > 0 || state.totalWisdomEarned > 0) {
    const sec = addSection("Wisdom");
    addRow(sec, "Wisdom Points", String(state.wisdom));
    const perPoint = TUNING.prestige.wisdomMultPerPoint;
    const hasWisdomBoost = !!state.upgrades.wisdom_boost;
    const boostExtra = hasWisdomBoost ? TUNING.upgrades.wisdom_boost.wisdomMult : 0;
    const effectivePerPoint = perPoint + boostExtra;
    addRow(sec, "Per-Point Bonus", `+${Math.round(effectivePerPoint * 100)}% each${hasWisdomBoost ? " (includes AGI upgrade)" : ""}`);
    const wisdomMult = Calc.calcWisdomBonus(state.wisdom, state.upgrades, TUNING, state.benchmarks);
    addRow(sec, "Total Wisdom Multiplier", `x${wisdomMult.toFixed(2)}`);
  }

  // 2. Wisdom Unlocks
  const ownedUnlocks = Object.entries(TUNING.wisdomUnlocks).filter(([id]) => state.wisdomUnlocks[id]);
  if (ownedUnlocks.length > 0) {
    const sec = addSection("Wisdom Unlocks");
    for (const [, cfg] of ownedUnlocks) {
      addRow(sec, cfg.title, cfg.desc);
    }
  }

  // 3. Research Upgrades
  const ownedUpgrades = INVESTMENTS.filter(inv => inv.isOwned(state));
  if (ownedUpgrades.length > 0) {
    const groups = { click: [], global: [], production: [], synergy: [], guac: [] };
    for (const inv of ownedUpgrades) {
      const cfg = TUNING.upgrades[inv.id];
      if (cfg.clickMult || cfg.apsPctPerClick) {
        groups.click.push(inv);
      } else if (cfg.globalMult || cfg.wisdomMult || cfg.unlocksGuac) {
        groups.global.push(inv);
      } else if (cfg.synergyPct) {
        groups.synergy.push(inv);
      } else if (cfg.consumeExpDelta || cfg.produceExpDelta || cfg.baseProdMult) {
        groups.guac.push(inv);
      } else if (cfg.producerId) {
        groups.production.push(inv);
      }
    }

    const sec = addSection("Research Upgrades");
    const groupLabels = [
      ["click", "Click"],
      ["global", "Global"],
      ["production", "Production"],
      ["synergy", "Synergy"],
      ["guac", "Guac"],
    ];
    for (const [key, label] of groupLabels) {
      if (groups[key].length === 0) continue;
      const subheader = document.createElement("div");
      subheader.className = "bonuses-row";
      subheader.innerHTML = `<span class="bonuses-label" style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">${label} (${groups[key].length})</span>`;
      sec.appendChild(subheader);
      for (const inv of groups[key]) {
        const cfg = TUNING.upgrades[inv.id];
        addRow(sec, cfg.title, cfg.desc);
      }
    }
  }

  // 4. Benchmarks
  const earnedBenchmarks = BENCHMARK_ORDER.filter(id => state.benchmarks[id]);
  if (earnedBenchmarks.length > 0) {
    const sec = addSection("Benchmarks");
    for (const id of earnedBenchmarks) {
      const cfg = TUNING.benchmarks[id];
      let bonusText = "";
      if (cfg.globalMult) bonusText = `+${Math.round(cfg.globalMult * 100)}% global`;
      if (cfg.clickMult) bonusText = `+${Math.round(cfg.clickMult * 100)}% click`;
      if (cfg.guacProdMult) bonusText = `+${Math.round(cfg.guacProdMult * 100)}% guac production`;
      if (cfg.guacMult) bonusText = `+${Math.round(cfg.guacMult * 100)}% guac multiplier`;
      if (cfg.wisdomMult) bonusText = `+${Math.round(cfg.wisdomMult * 100)}% wisdom`;
      addRow(sec, cfg.title, bonusText);
    }
  }

  // 5. Distillation
  const mv = state.modelVersion || 0;
  if (mv > 0) {
    const sec = addSection("Distillation");
    addRow(sec, "Model Version", `v${mv}.0`);
    const distBonus = Calc.calcDistillationBonus(mv, TUNING);
    if (distBonus.apsMult !== 1) addRow(sec, "APS Multiplier", `x${distBonus.apsMult.toFixed(1)}`);
    if (distBonus.allProdMult !== 1) addRow(sec, "All Production", `x${distBonus.allProdMult.toFixed(1)}`);
    if (distBonus.clickBaseBonus > 0) addRow(sec, "Base Click Power", `+${distBonus.clickBaseBonus}`);
    if (distBonus.guacProdMult !== 1) addRow(sec, "Guac Production", `x${distBonus.guacProdMult.toFixed(1)}`);
    if (distBonus.costMult !== 1) addRow(sec, "Producer Costs", `x${distBonus.costMult.toFixed(2)}`);
    if (distBonus.startingWisdom > 0) addRow(sec, "Starting Wisdom", `+${distBonus.startingWisdom} per prestige`);
    if (distBonus.multiplierCoeffBonus > 0) addRow(sec, "Guac Mult Coeff", `+${distBonus.multiplierCoeffBonus.toFixed(2)}`);
    if (distBonus.consumeFloorBonus !== 0) addRow(sec, "Consume Floor", `${distBonus.consumeFloorBonus.toFixed(2)}`);
    if (distBonus.wisdomEarnMult !== 1) addRow(sec, "Wisdom Earn Rate", `x${distBonus.wisdomEarnMult.toFixed(1)}`);
    if (distBonus.unlocksFoundationModel) addRow(sec, "Foundation Model", "Unlocked");
  }

  // 6. Hyperparameters
  const hp = state.hyperparams;
  const isDefault = hp.learningRate === "conservative" && hp.batchSize === "small" && hp.regularization === "none";
  if (state.prestigeCount >= 1 && !isDefault) {
    const sec = addSection("Hyperparameters");
    const hpMods = Calc.calcHyperparamModifiers(hp, Date.now(), TUNING);
    const lrCfg = TUNING.hyperparams.learningRate[hp.learningRate];
    const bsCfg = TUNING.hyperparams.batchSize[hp.batchSize];
    const regCfg = TUNING.hyperparams.regularization[hp.regularization];
    addRow(sec, "Learning Rate", `${lrCfg.label} — ${lrCfg.desc}`);
    addRow(sec, "Batch Size", `${bsCfg.label} — ${bsCfg.desc}`);
    addRow(sec, "Regularization", `${regCfg.label} — ${regCfg.desc}`);
    const effects = [];
    if (hpMods.apsMult !== 1) effects.push(`APS x${hpMods.apsMult.toFixed(2)}`);
    if (hpMods.clickMult !== 1) effects.push(`Click x${hpMods.clickMult.toFixed(2)}`);
    if (hpMods.guacConsumeMult !== 1) effects.push(`Guac consume x${hpMods.guacConsumeMult.toFixed(2)}`);
    if (hpMods.globalMult !== 1) effects.push(`Global x${hpMods.globalMult.toFixed(2)}`);
    if (hpMods.costMult !== 1) effects.push(`Cost x${hpMods.costMult.toFixed(2)}`);
    if (hpMods.wisdomMult !== 1) effects.push(`Wisdom x${hpMods.wisdomMult.toFixed(2)}`);
    if (hpMods.freezeGuacMult) effects.push("Guac mult frozen");
    if (effects.length > 0) addRow(sec, "Net Effects", effects.join(", "));
  }

  // If nothing was added, show a message
  if (bonusesModalBody.children.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No active bonuses yet. Keep growing!";
    bonusesModalBody.appendChild(empty);
  }
}

if (bonusesBtn) bonusesBtn.addEventListener("click", openBonusesModal);
if (bonusesCloseBtn) bonusesCloseBtn.addEventListener("click", closeBonusesModal);
if (bonusesModal) bonusesModal.addEventListener("click", (e) => {
  if (e.target === bonusesModal) closeBonusesModal();
});

// --- Hyperparameter Modal ---
const hpModal = document.getElementById("hp-modal");
const hpCloseBtn = document.getElementById("hp-close-btn");
const hpApplyBtn = document.getElementById("hp-apply-btn");
const tuneBtn = document.getElementById("tune-btn");

function openHpModal() {
  // Set radio buttons to current state
  const lrRadio = hpModal.querySelector(`input[name="hp-lr"][value="${state.hyperparams.learningRate}"]`);
  const bsRadio = hpModal.querySelector(`input[name="hp-bs"][value="${state.hyperparams.batchSize}"]`);
  const regRadio = hpModal.querySelector(`input[name="hp-reg"][value="${state.hyperparams.regularization}"]`);
  if (lrRadio) lrRadio.checked = true;
  if (bsRadio) bsRadio.checked = true;
  if (regRadio) regRadio.checked = true;
  hpModal.classList.add("active");
  hpModal.setAttribute("aria-hidden", "false");
}

function closeHpModal() {
  hpModal.classList.remove("active");
  hpModal.setAttribute("aria-hidden", "true");
}

function applyHyperparams() {
  const lr = hpModal.querySelector('input[name="hp-lr"]:checked').value;
  const bs = hpModal.querySelector('input[name="hp-bs"]:checked').value;
  const reg = hpModal.querySelector('input[name="hp-reg"]:checked').value;

  state.hyperparams.learningRate = lr;
  state.hyperparams.batchSize = bs;
  state.hyperparams.regularization = reg;
  state.hyperparams.lastTuneTime = Date.now();
  if (lr === "warmup") {
    state.hyperparams.warmupStartTime = Date.now();
  }

  logLine(`Hyperparams tuned: ${lr} / ${bs} / ${reg}`);
  closeHpModal();
  saveGame();
  updateUI();
}

if (tuneBtn) tuneBtn.addEventListener("click", openHpModal);
if (hpCloseBtn) hpCloseBtn.addEventListener("click", closeHpModal);
if (hpApplyBtn) hpApplyBtn.addEventListener("click", applyHyperparams);
if (hpModal) hpModal.addEventListener("click", (e) => {
  if (e.target === hpModal) closeHpModal();
});

// --- Tab switching ---
function setResearchTab(tabName) {
  const tabs = document.querySelectorAll(".tab-bar .tab");
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
  upgradesListEl.style.display = tabName === "research" ? "" : "none";
  upgradesOwnedListEl.style.display = tabName === "owned" ? "" : "none";
}

document.querySelector(".tab-bar").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) setResearchTab(tab.dataset.tab);
});

// --- Wire Events ---
// Delegated buy listeners — attached once, survive re-renders
producersListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-buy]");
  if (btn) buyProducer(btn.dataset.buy);
});
guacProducersListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-buy]");
  if (btn) buyProducer(btn.dataset.buy);
});
upgradesListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-upgrade]");
  if (btn) buyUpgrade(btn.dataset.upgrade);
});

pickAvocadoBtn.addEventListener("click", pickAvocado);
prestigeBtn.addEventListener("click", prestige);
prestigeRebornBtn.addEventListener("click", confirmPrestige);
prestigeOverlay.addEventListener("click", (e) => {
  if (e.target === prestigeOverlay) closePrestigeOverlay();
});

if (analyzerBtn) analyzerBtn.addEventListener("click", openAnalyzer);

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
  state.totalWisdomEarned = (state.totalWisdomEarned || 0) + 10;
  state.totalWisdomSinceLastDistill = (state.totalWisdomSinceLastDistill || 0) + 10;
  saveGame();
  updateUI();
  logLine("Debug: +10 wisdom");
});

const debugAdd10bAvocadosBtn = document.getElementById("debug-add-10b-avocados-btn");
if (debugAdd10bAvocadosBtn) debugAdd10bAvocadosBtn.addEventListener("click", () => {
  state.avocadoCount += 1e10;
  state.totalAvocadosThisRun += 1e10;
  state.totalAvocadosAllTime += 1e10;
  saveGame();
  updateUI();
  logLine("Debug: +10,000,000,000 avocados");
});

debugModal.addEventListener("click", (e) => {
  if (e.target === debugModal) closeDebug();
});

// --- Init ---
SessionLog.initSession();

const analyzerView = initAnalyzerView({
  onBack: closeAnalyzer,
  captureSnapshot: (reason) => captureStateSnapshot(reason),
});

loadGame();
renderProducerList();
renderBuyQuantitySelector();
renderGuacProducerList();
renderGuacBuyQuantitySelector();
renderUpgradeList();
renderBenchmarks();
updateUI();
captureStateSnapshot("init");
startLoop();
logLine(((state.modelVersion || 0) >= 1 ? "Avocado Intelligence" : "Avocado") + " loaded.");
