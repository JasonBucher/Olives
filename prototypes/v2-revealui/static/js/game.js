// Olives Idle Game: Minimalist System Reset
// Storage constants
const STORAGE_PREFIX = "revealUI_";
const STORAGE_KEY = STORAGE_PREFIX + "gameState";

// Reset tracking
let isResetting = false;
let mainLoopInterval = null;

// State
let oliveCount = 0;
let florinCount = 0;
let oilCount = 0;
let totalOlivesPicked = 0;
let pickersCount = 0;
let pressesCount = 0;
let olivesPerClick = 1;
let pickerRate = 0.2; // olives/sec per picker
let pickerMultiplier = 1.0;
let oliveMarketCapacity = 25;
let oliveSellEfficiency = 0.7;
let oliveSellRate = 5; // olives sold per second
let oilMarketCapacity = 5;
let oilSellEfficiency = 0.7;
let oilSellRate = 1; // oil sold per second
let oilPerPress = 1; // per press per cycle
let oilPressTime = 5.0; // seconds per press cycle
let oilPressCost = 5; // olives per press
let upgrades = {
    hands: false,
    baskets: false,
    connections: false,
    stalls: false,
    spoilage: false
};
let clickTimestamps = [];
const CLICK_OPS_WINDOW = 5.0;

// Market shipment state
let oliveShipmentActive = false;
let oliveShipmentRemaining = 0;
let oliveShipmentTimer = 0;
let oliveShipmentTotal = 0;

let oilShipmentActive = false;
let oilShipmentRemaining = 0;
let oilShipmentTimer = 0;
let oilShipmentTotal = 0;

// Unlock flags
let oliveMarketUnlocked = false;
let pickersUnlocked = false;
let pressesUnlocked = false;
let oilMarketUnlocked = false;

// DOM
const oliveCountEl = document.getElementById('olive-count');
const florinCountEl = document.getElementById('florin-count');
const oilCountEl = document.getElementById('oil-count');
const opsCountEl = document.getElementById('ops-count');
const pickOliveBtn = document.getElementById('pick-olive-btn');
const oliveMarketSection = document.getElementById('olive-market-section');
const oliveMarketCapacityEl = document.getElementById('olive-market-capacity');
const sell10OlivesBtn = document.getElementById('sell-10-olives-btn');
const sell25OlivesBtn = document.getElementById('sell-25-olives-btn');
const sellMaxOlivesBtn = document.getElementById('sell-max-olives-btn');
const oliveShipmentProgress = document.getElementById('olive-shipment-progress');
const oliveShipmentBar = document.getElementById('olive-shipment-bar');
const oliveShipmentCountdown = document.getElementById('olive-shipment-countdown');
const pickerCountEl = document.getElementById('picker-count');
const hirePickerBtn = document.getElementById('hire-picker-btn');
const pickerCostEl = document.getElementById('picker-cost');
const passiveOpsEl = document.getElementById('passive-ops');
const pressCountEl = document.getElementById('press-count');
const buyPressBtn = document.getElementById('buy-press-btn');
const pressCostEl = document.getElementById('press-cost');
const pressOlivesBtn = document.getElementById('press-olives-btn');
const pressProgressContainer = document.getElementById('press-progress-container');
const pressProgressBar = document.getElementById('press-progress-bar');
const pressCountdown = document.getElementById('press-countdown');
const oilMarketSection = document.getElementById('oil-market-section');
const oilMarketCapacityEl = document.getElementById('oil-market-capacity');
const sell5OilBtn = document.getElementById('sell-5-oil-btn');
const sell10OilBtn = document.getElementById('sell-10-oil-btn');
const sellMaxOilBtn = document.getElementById('sell-max-oil-btn');
const oilShipmentProgress = document.getElementById('oil-shipment-progress');
const oilShipmentBar = document.getElementById('oil-shipment-bar');
const oilShipmentCountdown = document.getElementById('oil-shipment-countdown');
const upgradesSection = document.getElementById('upgrades-section');
const upgradeHandsBtn = document.getElementById('upgrade-hands-btn');
const upgradeBasketsBtn = document.getElementById('upgrade-baskets-btn');
const upgradeConnectionsBtn = document.getElementById('upgrade-connections-btn');
const upgradeStallsBtn = document.getElementById('upgrade-stalls-btn');
const upgradeSpoilageBtn = document.getElementById('upgrade-spoilage-btn');

// Debug Panel
const debugButton = document.getElementById('debug-btn');
const debugModal = document.getElementById('debug-modal');
const closeDebugButton = document.getElementById('close-debug');
const resetGameButton = document.getElementById('reset-game-btn');
const addOlivesButton = document.getElementById('add-olives-btn');
const addOilButton = document.getElementById('add-oil-btn');

// --- Utility ---
function saveGame() {
    if (isResetting) return;
    const state = {
        oliveCount, florinCount, oilCount, totalOlivesPicked, pickersCount, pressesCount, olivesPerClick, pickerMultiplier,
        oliveMarketCapacity, oliveSellEfficiency, oliveSellRate, oilMarketCapacity, oilSellEfficiency, oilSellRate, oilPerPress, oilPressTime, oilPressCost,
        upgrades, clickTimestamps,
        oliveShipmentActive, oliveShipmentRemaining, oliveShipmentTimer, oliveShipmentTotal,
        oilShipmentActive, oilShipmentRemaining, oilShipmentTimer, oilShipmentTotal,
        oliveMarketUnlocked, pickersUnlocked, pressesUnlocked, oilMarketUnlocked
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadGame() {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!state) return;
    oliveCount = state.oliveCount || 0;
    florinCount = state.florinCount || 0;
    oilCount = state.oilCount || 0;
    totalOlivesPicked = state.totalOlivesPicked || 0;
    pickersCount = state.pickersCount || 0;
    pressesCount = state.pressesCount || 0;
    olivesPerClick = state.olivesPerClick || 1;
    pickerMultiplier = state.pickerMultiplier || 1.0;
    oliveMarketCapacity = state.oliveMarketCapacity || 25;
    oliveSellEfficiency = state.oliveSellEfficiency || 0.7;
    oliveSellRate = state.oliveSellRate || 5;
    oilMarketCapacity = state.oilMarketCapacity || 5;
    oilSellEfficiency = state.oilSellEfficiency || 0.7;
    oilSellRate = state.oilSellRate || 1;
    oilPerPress = state.oilPerPress || 1;
    oilPressTime = state.oilPressTime || 5.0;
    oilPressCost = state.oilPressCost || 5;
    upgrades = state.upgrades || {hands:false,baskets:false,connections:false,stalls:false,spoilage:false};
    clickTimestamps = state.clickTimestamps || [];
    oliveShipmentActive = state.oliveShipmentActive || false;
    oliveShipmentRemaining = state.oliveShipmentRemaining || 0;
    oliveShipmentTimer = state.oliveShipmentTimer || 0;
    oliveShipmentTotal = state.oliveShipmentTotal || 0;
    oilShipmentActive = state.oilShipmentActive || false;
    oilShipmentRemaining = state.oilShipmentRemaining || 0;
    oilShipmentTimer = state.oilShipmentTimer || 0;
    oilShipmentTotal = state.oilShipmentTotal || 0;
    oliveMarketUnlocked = state.oliveMarketUnlocked || false;
    pickersUnlocked = state.pickersUnlocked || false;
    pressesUnlocked = state.pressesUnlocked || false;
    oilMarketUnlocked = state.oilMarketUnlocked || false;
}

function resetGame() {
    if (!confirm('Are you sure you want to reset the game? All progress will be lost!')) return;
    
    isResetting = true;
    if (mainLoopInterval) clearInterval(mainLoopInterval);
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = window.location.pathname + '?t=' + Date.now();
}

// --- OPS Calculation ---
function getPassiveOPS() {
    return pickersCount * pickerRate * pickerMultiplier;
}
function getClickOPS() {
    const now = Date.now();
    clickTimestamps = clickTimestamps.filter(ts => now - ts < CLICK_OPS_WINDOW * 1000);
    return (clickTimestamps.length / CLICK_OPS_WINDOW) * olivesPerClick;
}
function getTotalOPS() {
    return getPassiveOPS() + getClickOPS();
}

// --- UI Update ---
function updateUI() {
    oliveCountEl.textContent = Math.floor(oliveCount);
    florinCountEl.textContent = Math.floor(florinCount);
    oilCountEl.textContent = Math.floor(oilCount);
    opsCountEl.textContent = getTotalOPS().toFixed(2);
    pickerCountEl.textContent = pickersCount;
    pickerCostEl.textContent = getPickerCost();
    passiveOpsEl.textContent = getPassiveOPS().toFixed(2);
    pressCountEl.textContent = pressesCount;
    pressCostEl.textContent = getPressCost();
    oliveMarketCapacityEl.textContent = oliveMarketCapacity;
    oilMarketCapacityEl.textContent = oilMarketCapacity;

    // Unlocks (controlled by updateVisibility for sections, buttons always visible within their sections)
    if (buyPressBtn) buyPressBtn.style.display = pressesUnlocked ? '' : 'none';
    if (pressOlivesBtn) pressOlivesBtn.style.display = pressesUnlocked ? '' : 'none';
    if (pressCountEl && pressCountEl.parentElement) pressCountEl.parentElement.style.display = pressesUnlocked ? '' : 'none';

    // Olive Market
    if (sell10OlivesBtn) sell10OlivesBtn.disabled = oliveCount < 10 || oliveShipmentActive;
    if (sell25OlivesBtn) sell25OlivesBtn.disabled = oliveCount < 25 || oliveShipmentActive;
    if (sellMaxOlivesBtn) sellMaxOlivesBtn.disabled = oliveCount < 1 || oliveShipmentActive;
    // Oil Market
    if (sell5OilBtn) sell5OilBtn.disabled = oilCount < 5 || oilShipmentActive;
    if (sell10OilBtn) sell10OilBtn.disabled = oilCount < 10 || oilShipmentActive;
    if (sellMaxOilBtn) sellMaxOilBtn.disabled = oilCount < 1 || oilShipmentActive;
    // Labor
    if (hirePickerBtn) hirePickerBtn.disabled = florinCount < getPickerCost();
    // Processing
    if (buyPressBtn) buyPressBtn.disabled = florinCount < getPressCost();
    if (pressOlivesBtn) pressOlivesBtn.disabled = oliveCount < oilPressCost || pressesCount < 1 || pressActive;
    // Upgrades
    if (upgradeHandsBtn) upgradeHandsBtn.disabled = upgrades.hands || florinCount < 10;
    if (upgradeBasketsBtn) upgradeBasketsBtn.disabled = upgrades.baskets || florinCount < 15;
    if (upgradeConnectionsBtn) upgradeConnectionsBtn.disabled = upgrades.connections || florinCount < 12;
    if (upgradeStallsBtn) upgradeStallsBtn.disabled = upgrades.stalls || florinCount < 20;
    if (upgradeSpoilageBtn) upgradeSpoilageBtn.disabled = upgrades.spoilage || florinCount < 18;

    // Progress bars
    if (oliveShipmentActive) {
        oliveShipmentProgress.style.display = '';
        oliveShipmentBar.style.width = ((oliveShipmentTotal - oliveShipmentRemaining) / oliveShipmentTotal * 100) + '%';
        oliveShipmentCountdown.textContent = Math.ceil(oliveShipmentTimer) + 's';
    } else {
        oliveShipmentProgress.style.display = 'none';
        oliveShipmentBar.style.width = '0%';
        oliveShipmentCountdown.textContent = '';
    }
    if (pressActive) {
        pressProgressContainer.style.display = '';
        pressProgressBar.style.width = ((oilPressTime - pressTimer) / oilPressTime * 100) + '%';
        pressCountdown.textContent = Math.ceil(pressTimer) + 's';
    } else {
        pressProgressContainer.style.display = 'none';
        pressProgressBar.style.width = '0%';
        pressCountdown.textContent = '';
    }
    if (oilShipmentActive) {
        oilShipmentProgress.style.display = '';
        oilShipmentBar.style.width = ((oilShipmentTotal - oilShipmentRemaining) / oilShipmentTotal * 100) + '%';
        oilShipmentCountdown.textContent = Math.ceil(oilShipmentTimer) + 's';
    } else {
        oilShipmentProgress.style.display = 'none';
        oilShipmentBar.style.width = '0%';
        oilShipmentCountdown.textContent = '';
    }
}

// --- Game Logic ---
function getPickerCost() {
    return 5 + Math.floor(pickersCount * 3.5);
}
function getPressCost() {
    return 25 + Math.floor(pressesCount * 10);
}

let pressActive = false;
let pressTimer = 0;

function tick(dt) {
    // Passive olives
    oliveCount += getPassiveOPS() * dt;

    // Market unlock
    if (!oliveMarketUnlocked && totalOlivesPicked >= 25) oliveMarketUnlocked = true;
    if (!pickersUnlocked && (florinCount >= 5 || oliveShipmentActive || florinCount > 0)) pickersUnlocked = true;
    if (!pressesUnlocked && florinCount >= 25) pressesUnlocked = true;
    if (!oilMarketUnlocked && oilCount > 0) oilMarketUnlocked = true;

    // Olive shipment
    if (oliveShipmentActive) {
        const sellThisTick = Math.min(oliveSellRate * dt, oliveShipmentRemaining);
        oliveShipmentRemaining -= sellThisTick;
        oliveShipmentTimer -= dt;
        if (oliveShipmentRemaining <= 0 || oliveShipmentTimer <= 0) {
            // Shipment complete
            const sold = Math.floor(oliveShipmentTotal * oliveSellEfficiency);
            const florinsGained = sold; // 1 olive = 1 florin (after efficiency)
            florinCount += florinsGained;
            oliveShipmentActive = false;
            oliveShipmentRemaining = 0;
            oliveShipmentTimer = 0;
            oliveShipmentTotal = 0;
        }
    }

    // Oil shipment
    if (oilShipmentActive) {
        const sellThisTick = Math.min(oilSellRate * dt, oilShipmentRemaining);
        oilShipmentRemaining -= sellThisTick;
        oilShipmentTimer -= dt;
        if (oilShipmentRemaining <= 0 || oilShipmentTimer <= 0) {
            // Shipment complete
            const sold = Math.floor(oilShipmentTotal * oilSellEfficiency);
            const florinsGained = sold * 2; // 1 oil = 2 florins
            florinCount += florinsGained;
            oilShipmentActive = false;
            oilShipmentRemaining = 0;
            oilShipmentTimer = 0;
            oilShipmentTotal = 0;
        }
    }

    // Pressing
    if (pressActive) {
        pressTimer -= dt;
        if (pressTimer <= 0) {
            oilCount += pressesCount * oilPerPress;
            pressActive = false;
            pressTimer = 0;
        }
    }

    updateUI();
    updateVisibility();
    saveGame();
}

// --- Shipment Functions ---
function startOliveShipment(amount) {
    if (oliveShipmentActive || oliveCount < amount) return;
    oliveCount -= amount;
    oliveShipmentActive = true;
    oliveShipmentRemaining = amount;
    oliveShipmentTotal = amount;
    oliveShipmentTimer = 10;
    updateUI();
    saveGame();
}

function startOilShipment(amount) {
    if (oilShipmentActive || oilCount < amount) return;
    oilCount -= amount;
    oilShipmentActive = true;
    oilShipmentRemaining = amount;
    oilShipmentTotal = amount;
    oilShipmentTimer = 12;
    updateUI();
    saveGame();
}

// --- Button Handlers ---
if (pickOliveBtn) {
  pickOliveBtn.onclick = function() {
    oliveCount += olivesPerClick;
    totalOlivesPicked += olivesPerClick;
    clickTimestamps.push(Date.now());
    updateUI();
    updateVisibility();
    saveGame();
  };
}
if (sell10OlivesBtn) sell10OlivesBtn.onclick = function() { startOliveShipment(10); updateVisibility(); };
if (sell25OlivesBtn) sell25OlivesBtn.onclick = function() { startOliveShipment(25); updateVisibility(); };
if (sellMaxOlivesBtn) sellMaxOlivesBtn.onclick = function() { startOliveShipment(Math.min(oliveMarketCapacity, Math.floor(oliveCount))); updateVisibility(); };
if (hirePickerBtn) hirePickerBtn.onclick = function() {
  const cost = getPickerCost();
  if (florinCount < cost) return;
  florinCount -= cost;
  pickersCount++;
  updateUI();
  updateVisibility();
  saveGame();
};
if (buyPressBtn) buyPressBtn.onclick = function() {
  const cost = getPressCost();
  if (florinCount < cost) return;
  florinCount -= cost;
  pressesCount++;
  updateUI();
  updateVisibility();
  saveGame();
};
if (pressOlivesBtn) pressOlivesBtn.onclick = function() {
  if (pressActive || oliveCount < oilPressCost || pressesCount < 1) return;
  oliveCount -= oilPressCost;
  pressActive = true;
  pressTimer = oilPressTime;
  updateUI();
  updateVisibility();
  saveGame();
};
if (sell5OilBtn) sell5OilBtn.onclick = function() { startOilShipment(5); updateVisibility(); };
if (sell10OilBtn) sell10OilBtn.onclick = function() { startOilShipment(10); updateVisibility(); };
if (sellMaxOilBtn) sellMaxOilBtn.onclick = function() { startOilShipment(Math.min(oilMarketCapacity, Math.floor(oilCount))); updateVisibility(); };
if (upgradeHandsBtn) upgradeHandsBtn.onclick = function() {
  if (upgrades.hands || florinCount < 10) return;
  florinCount -= 10;
  upgrades.hands = true;
  olivesPerClick = 2;
  updateUI();
  updateVisibility();
  saveGame();
};
if (upgradeBasketsBtn) upgradeBasketsBtn.onclick = function() {
  if (upgrades.baskets || florinCount < 15) return;
  florinCount -= 15;
  upgrades.baskets = true;
  pickerMultiplier = 1.25;
  updateUI();
  updateVisibility();
  saveGame();
};
if (upgradeConnectionsBtn) upgradeConnectionsBtn.onclick = function() {
  if (upgrades.connections || florinCount < 12) return;
  florinCount -= 12;
  upgrades.connections = true;
  oliveMarketCapacity += 10;
  updateUI();
  updateVisibility();
  saveGame();
};
if (upgradeStallsBtn) upgradeStallsBtn.onclick = function() {
  if (upgrades.stalls || florinCount < 20) return;
  florinCount -= 20;
  upgrades.stalls = true;
  oilMarketCapacity += 5;
  updateUI();
  updateVisibility();
  saveGame();
};
if (upgradeSpoilageBtn) upgradeSpoilageBtn.onclick = function() {
  if (upgrades.spoilage || florinCount < 18) return;
  florinCount -= 18;
  upgrades.spoilage = true;
  oliveSellEfficiency += 0.2;
  oilSellEfficiency += 0.2;
  updateUI();
  updateVisibility();
  saveGame();
};

// --- Section Reveal Logic ---
function updateVisibility() {
  // Market section (outer wrapper)
  const marketSection = document.getElementById('market-section');
  if (marketSection) {
    marketSection.style.display = (totalOlivesPicked >= 25 || oliveMarketUnlocked) ? '' : 'none';
  }
  // Olive Market section (inner - actual sell buttons)
  const oliveMarketSectionInner = document.getElementById('olive-market-section');
  if (oliveMarketSectionInner) {
    oliveMarketSectionInner.style.display = (totalOlivesPicked >= 25 || oliveMarketUnlocked) ? '' : 'none';
  }

  // Labor section
  const laborSection = document.getElementById('labor-section');
  if (laborSection) {
    const oliveShipmentDone = florinCount > 0 || oliveShipmentActive || (typeof oliveShipmentTotal !== 'undefined' && oliveShipmentTotal > 0);
    laborSection.style.display = (florinCount >= 5 || oliveShipmentDone || pickersUnlocked) ? '' : 'none';
  }

  // Processing section
  const processingSection = document.getElementById('processing-section');
  if (processingSection) {
    processingSection.style.display = (florinCount >= 25 || pressesUnlocked) ? '' : 'none';
  }

  // Oil Market section (outer wrapper)
  const oilMarketSectionWrapper = document.getElementById('oilmarket-section');
  if (oilMarketSectionWrapper) {
    oilMarketSectionWrapper.style.display = (oilCount > 0 || pressesCount > 0 || oilMarketUnlocked) ? '' : 'none';
  }
  // Oil Market section (inner - actual sell buttons)
  const oilMarketSectionInner = document.getElementById('oil-market-section');
  if (oilMarketSectionInner) {
    oilMarketSectionInner.style.display = (oilCount > 0 || pressesCount > 0 || oilMarketUnlocked) ? '' : 'none';
  }

  // Upgrades section (outer wrapper)
  const upgradesSectionWrapper = document.getElementById('upgrades-section-wrapper');
  if (upgradesSectionWrapper) {
    upgradesSectionWrapper.style.display = (florinCount >= 10 || oliveMarketUnlocked) ? '' : 'none';
  }
  // Upgrades section (inner - actual upgrade buttons)
  const upgradesSectionInner = document.getElementById('upgrades-section');
  if (upgradesSectionInner) {
    upgradesSectionInner.style.display = (florinCount >= 10 || oliveMarketUnlocked) ? '' : 'none';
  }
}

// --- Main Loop ---
function loadGame() {
    const stateRaw = localStorage.getItem(STORAGE_KEY);
    let state = {};
    if (stateRaw) {
        try { state = JSON.parse(stateRaw); } catch { state = {}; }
    }
    // If missing or empty, set all unlocks/flags to default
    if (!stateRaw || Object.keys(state).length === 0) {
        oliveMarketUnlocked = false;
        pickersUnlocked = false;
        pressesUnlocked = false;
        oilMarketUnlocked = false;
        upgrades = {hands:false,baskets:false,connections:false,stalls:false,spoilage:false};
        oliveShipmentActive = false;
        oliveShipmentRemaining = 0;
        oliveShipmentTimer = 0;
        oliveShipmentTotal = 0;
        oilShipmentActive = false;
        oilShipmentRemaining = 0;
        oilShipmentTimer = 0;
        oilShipmentTotal = 0;
        clickTimestamps = [];
        oliveCount = 0;
        florinCount = 0;
        oilCount = 0;
        totalOlivesPicked = 0;
        pickersCount = 0;
        pressesCount = 0;
        olivesPerClick = 1;
        pickerMultiplier = 1.0;
        oliveMarketCapacity = 25;
        oliveSellEfficiency = 0.7;
        oliveSellRate = 5;
        oilMarketCapacity = 5;
        oilSellEfficiency = 0.7;
        oilSellRate = 1;
        oilPerPress = 1;
        oilPressTime = 5.0;
        oilPressCost = 5;
        // Defensive: ensure all other flags are reset
    } else {
        oliveCount = state.oliveCount || 0;
        florinCount = state.florinCount || 0;
        oilCount = state.oilCount || 0;
        totalOlivesPicked = state.totalOlivesPicked || 0;
        pickersCount = state.pickersCount || 0;
        pressesCount = state.pressesCount || 0;
        olivesPerClick = state.olivesPerClick || 1;
        pickerMultiplier = state.pickerMultiplier || 1.0;
        oliveMarketCapacity = state.oliveMarketCapacity || 25;
        oliveSellEfficiency = state.oliveSellEfficiency || 0.7;
        oliveSellRate = state.oliveSellRate || 5;
        oilMarketCapacity = state.oilMarketCapacity || 5;
        oilSellEfficiency = state.oilSellEfficiency || 0.7;
        oilSellRate = state.oilSellRate || 1;
        oilPerPress = state.oilPerPress || 1;
        oilPressTime = state.oilPressTime || 5.0;
        oilPressCost = state.oilPressCost || 5;
        upgrades = state.upgrades || {hands:false,baskets:false,connections:false,stalls:false,spoilage:false};
        clickTimestamps = state.clickTimestamps || [];
        oliveShipmentActive = state.oliveShipmentActive || false;
        oliveShipmentRemaining = state.oliveShipmentRemaining || 0;
        oliveShipmentTimer = state.oliveShipmentTimer || 0;
        oliveShipmentTotal = state.oliveShipmentTotal || 0;
        oilShipmentActive = state.oilShipmentActive || false;
        oilShipmentRemaining = state.oilShipmentRemaining || 0;
        oilShipmentTimer = state.oilShipmentTimer || 0;
        oilShipmentTotal = state.oilShipmentTotal || 0;
        oliveMarketUnlocked = state.oliveMarketUnlocked || false;
        pickersUnlocked = state.pickersUnlocked || false;
        pressesUnlocked = state.pressesUnlocked || false;
        oilMarketUnlocked = state.oilMarketUnlocked || false;
    }
    updateUI();
    updateVisibility();
}

// Debug Panel
function openDebugPanel() {
    debugModal.classList.add('active');
}

function closeDebugPanel() {
    debugModal.classList.remove('active');
}

function addOlives() {
    oliveCount += 100;
    updateUI();
    saveGame();
}

function addOil() {
    oilCount += 100;
    updateUI();
    saveGame();
}

// Event listeners
debugButton.addEventListener('click', openDebugPanel);
closeDebugButton.addEventListener('click', closeDebugPanel);
resetGameButton.addEventListener('click', resetGame);
addOlivesButton.addEventListener('click', addOlives);
addOilButton.addEventListener('click', addOil);

// Close modal when clicking outside
debugModal.addEventListener('click', (e) => {
    if (e.target === debugModal) {
        closeDebugPanel();
    }
});

// --- Main Game Loop ---
loadGame();

let lastTime = Date.now();
mainLoopInterval = setInterval(function() {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    tick(dt);
}, 100);
