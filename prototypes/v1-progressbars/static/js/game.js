// Game state
let oliveCount = 0;
let oilCount = 0;
let florinCount = 0;
let harvesterCount = 0;
let pressWorkerCount = 0;
let bankingHouseEstablished = false;
let pressStrain = 0; // 0..100
let isHarvesting = false;
let isPressing = false;
let harvesterProgress = 0;     // 0..1 progress toward producing 1 olive
let pressWorkerProgress = 0;   // 0..1 progress toward producing 1 press operation
let automationInterval = null;
let autoPressReserved = false; // true if we've already paid olives for the current auto press

// DOM elements
const oliveCountElement = document.getElementById('olive-count');
const oilCountElement = document.getElementById('oil-count');
const florinCountElement = document.getElementById('florin-count');
const harvesterCountElement = document.getElementById('harvester-count');
const pressWorkerCountElement = document.getElementById('press-worker-count');
const harvestButton = document.getElementById('harvest-btn');
const pressButton = document.getElementById('press-btn');
const sellOilButton = document.getElementById('sell-oil-btn');
const sellOlivesButton = document.getElementById('sell-olives-btn');
const hireButton = document.getElementById('hire-btn');
const hirePressButton = document.getElementById('hire-press-btn');
const establishBankingButton = document.getElementById('establish-banking-btn');
const bankingStatusElement = document.getElementById('banking-status');
const pressStrainFill = document.getElementById('press-strain-fill');
const pressStrainText = document.getElementById('press-strain-text');
const repairPressingButton = document.getElementById('repair-pressing-btn');

const oliveProgressContainer = document.getElementById('olive-progress-container');
const oliveProgressBar = document.getElementById('olive-progress-bar');
const oliveCountdown = document.getElementById('olive-countdown');

const oilProgressContainer = document.getElementById('oil-progress-container');
const oilProgressBar = document.getElementById('oil-progress-bar');
const oilCountdown = document.getElementById('oil-countdown');

const harvesterProgressContainer = document.getElementById('harvester-progress-container');
const harvesterProgressBar = document.getElementById('harvester-progress-bar');
const harvesterCountdown = document.getElementById('harvester-countdown');

const pressWorkerProgressContainer = document.getElementById('press-worker-progress-container');
const pressWorkerProgressBar = document.getElementById('press-worker-progress-bar');
const pressWorkerCountdown = document.getElementById('press-worker-countdown');

const harvesterTimingElement = document.getElementById('harvester-timing');
const pressWorkerTimingElement = document.getElementById('press-worker-timing');

// Constants
const HARVEST_TIME = 3000; // 3 seconds
const PRESS_TIME = 5000; // 5 seconds
const PRESS_COST = 3; // olives
const HARVESTER_COST = 5; // oil
const PRESS_WORKER_COST = 10; // oil
const BANKING_HOUSE_COST = 25; // florins
const HARVESTER_RATE_PER_SEC = 0.10;     // each harvester produces 0.10 olives/sec (1 olive per 10s)
const PRESS_WORKER_RATE_PER_SEC = 0.05;  // each press worker does 0.05 presses/sec (1 press per 20s)
const UPDATE_INTERVAL = 100; // Update every 100ms
const PRESS_STRAIN_MAX = 100;
const STRAIN_PER_OIL = 0.3333; // ~300 oil to reach 100
const REPAIR_COST_FLORINS = 5;
const OIL_SELL_COST = 3; // 3 oil -> 1 florin
const OLIVE_SELL_COST = 10; // 10 olives -> 1 florin (worse rate, deadlock escape)
const BREAKDOWN_RISK_START = 70; // risk starts at 70% strain
const BREAKDOWN_PMAX = 0.08; // 8% chance per oil at 100% strain
const BREAKDOWN_ENABLED = true;

// Load saved game state
function loadGame() {
    const savedOlives = localStorage.getItem('oliveCount');
    const savedOil = localStorage.getItem('oilCount');
    const savedFlorins = localStorage.getItem('florinCount');
    const savedHarvesters = localStorage.getItem('harvesterCount');
    const savedPressWorkers = localStorage.getItem('pressWorkerCount');
    const savedBankingHouse = localStorage.getItem('bankingHouseEstablished');
    const savedPressStrain = localStorage.getItem('pressStrain');
    if (savedOlives) {
        oliveCount = parseInt(savedOlives, 10);
    }
    if (savedOil) {
        oilCount = parseInt(savedOil, 10);
    }
    if (savedFlorins) {
        florinCount = parseInt(savedFlorins, 10);
    }
    if (savedHarvesters) {
        harvesterCount = parseInt(savedHarvesters, 10);
    }
    if (savedPressWorkers) {
        pressWorkerCount = parseInt(savedPressWorkers, 10);
    }
    if (savedBankingHouse === 'true') {
        bankingHouseEstablished = true;
    }
    if (savedPressStrain) {
        pressStrain = parseFloat(savedPressStrain);
    }
    updateDisplay();
}

// Save game state
function saveGame() {
    localStorage.setItem('oliveCount', oliveCount);
    localStorage.setItem('oilCount', oilCount);
    localStorage.setItem('florinCount', florinCount);
    localStorage.setItem('harvesterCount', harvesterCount);
    localStorage.setItem('pressWorkerCount', pressWorkerCount);
    localStorage.setItem('bankingHouseEstablished', bankingHouseEstablished);
    localStorage.setItem('pressStrain', pressStrain);
}

// Update displays
function updateDisplay() {
    oliveCountElement.textContent = oliveCount;
    oilCountElement.textContent = oilCount;
    florinCountElement.textContent = florinCount;
    harvesterCountElement.textContent = harvesterCount;
    pressWorkerCountElement.textContent = pressWorkerCount;
    
    // Update timing info
    if (harvesterCount > 0) {
        const timePerOlive = 1 / (harvesterCount * HARVESTER_RATE_PER_SEC);
        harvesterTimingElement.textContent = `(${timePerOlive.toFixed(2)}s per olive)`;
    } else {
        harvesterTimingElement.textContent = '(10.00s per olive base)';
    }
    
    if (pressWorkerCount > 0) {
        const timePerPress = 1 / (pressWorkerCount * PRESS_WORKER_RATE_PER_SEC);
        pressWorkerTimingElement.textContent = `(${timePerPress.toFixed(2)}s per press)`;
    } else {
        pressWorkerTimingElement.textContent = '(20.00s per press base)';
    }
    
    // Update strain UI
    pressStrain = Math.max(0, Math.min(PRESS_STRAIN_MAX, pressStrain));
    pressStrainFill.style.width = `${pressStrain}%`;
    pressStrainText.textContent = `${Math.floor(pressStrain)}%`;
    
    // Add danger styling at 85%+
    if (pressStrain >= 85) {
        pressStrainFill.classList.add('danger');
        pressStrainText.classList.add('danger');
    } else {
        pressStrainFill.classList.remove('danger');
        pressStrainText.classList.remove('danger');
    }
    
    // Update button states
    pressButton.disabled = isPressing || oliveCount < PRESS_COST || pressStrain >= PRESS_STRAIN_MAX;
    sellOilButton.disabled = oilCount < OIL_SELL_COST;
    sellOlivesButton.disabled = oliveCount < OLIVE_SELL_COST;
    hireButton.disabled = oilCount < HARVESTER_COST;
    hirePressButton.disabled = oilCount < PRESS_WORKER_COST;
    repairPressingButton.disabled = pressStrain <= 0 || florinCount < REPAIR_COST_FLORINS;
    
    // Banking house button and status
    if (bankingHouseEstablished) {
        establishBankingButton.style.display = 'none';
        bankingStatusElement.style.display = 'block';
    } else {
        establishBankingButton.style.display = 'inline-block';
        establishBankingButton.disabled = florinCount < BANKING_HOUSE_COST;
        bankingStatusElement.style.display = 'none';
    }
}

// Start harvesting olives
function startHarvest() {
    if (isHarvesting) return;
    
    isHarvesting = true;
    harvestButton.disabled = true;
    oliveProgressContainer.classList.add('active');
    oliveCountdown.classList.add('active');
    oliveProgressBar.style.width = '0%';
    
    const startTime = Date.now();
    
    const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / HARVEST_TIME) * 100, 100);
        const timeLeft = Math.max(0, (HARVEST_TIME - elapsed) / 1000);
        
        oliveProgressBar.style.width = progress + '%';
        oliveCountdown.textContent = timeLeft.toFixed(1);
        
        if (progress >= 100) {
            clearInterval(progressInterval);
            completeHarvest();
        }
    }, UPDATE_INTERVAL);
}

// Helper: calculate breakdown probability based on current strain
function getBreakdownProbability() {
    if (!BREAKDOWN_ENABLED || pressStrain < BREAKDOWN_RISK_START) {
        return 0;
    }
    
    const s = pressStrain / 100; // 0..1
    const t = Math.max(0, Math.min(1, (s - 0.70) / 0.30)); // clamp to 0..1
    return (t * t) * BREAKDOWN_PMAX; // quadratic ramp
}

// Helper: trigger press breakdown (force strain to max, stop pressing)
function triggerPressBreakdown() {
    pressStrain = PRESS_STRAIN_MAX;
    
    // Reset automated press state
    autoPressReserved = false;
    pressWorkerProgress = 0;
    
    // Hide automated press UI
    pressWorkerProgressContainer.classList.remove('active');
    pressWorkerCountdown.classList.remove('active');
    pressWorkerProgressBar.style.width = '0%';
    
    updateDisplay();
    saveGame();
}

// Helper: add strain when oil is produced, with breakdown risk
// Returns true if breakdown occurred (caller should stop producing more oil)
function addPressStrainForOilProduced(oilProduced) {
    for (let i = 0; i < oilProduced; i++) {
        // Increase strain for this oil
        pressStrain += STRAIN_PER_OIL;
        pressStrain = Math.min(PRESS_STRAIN_MAX, pressStrain);
        
        // Check for breakdown risk (only if not already at max)
        if (pressStrain >= BREAKDOWN_RISK_START && pressStrain < PRESS_STRAIN_MAX) {
            const breakdownChance = getBreakdownProbability();
            if (Math.random() < breakdownChance) {
                triggerPressBreakdown();
                return true; // breakdown occurred
            }
        }
    }
    return false; // no breakdown
}

// Complete harvest
function completeHarvest() {
    oliveCount++;
    updateDisplay();
    saveGame();
    
    setTimeout(() => {
        oliveProgressBar.style.width = '0%';
        oliveProgressContainer.classList.remove('active');
        oliveCountdown.classList.remove('active');
        isHarvesting = false;
        harvestButton.disabled = false;
    }, 200);
}

// Start pressing oil
function startPress() {
    if (isPressing || oliveCount < PRESS_COST || pressStrain >= PRESS_STRAIN_MAX) return;
    
    // Deduct olives
    oliveCount -= PRESS_COST;
    updateDisplay();
    saveGame();
    
    isPressing = true;
    pressButton.disabled = true;
    oilProgressContainer.classList.add('active');
    oilCountdown.classList.add('active');
    oilProgressBar.style.width = '0%';
    
    const startTime = Date.now();
    
    const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / PRESS_TIME) * 100, 100);
        const timeLeft = Math.max(0, (PRESS_TIME - elapsed) / 1000);
        
        oilProgressBar.style.width = progress + '%';
        oilCountdown.textContent = timeLeft.toFixed(1);
        
        if (progress >= 100) {
            clearInterval(progressInterval);
            completePress();
        }
    }, UPDATE_INTERVAL);
}

// Complete oil pressing
function completePress() {
    oilCount++;
    const brokeDown = addPressStrainForOilProduced(1);
    updateDisplay();
    saveGame();
    
    setTimeout(() => {
        oilProgressBar.style.width = '0%';
        oilProgressContainer.classList.remove('active');
        oilCountdown.classList.remove('active');
        isPressing = false;
        updateDisplay(); // Re-check button state (may be disabled if breakdown occurred)
    }, 200);
}

// Sell oil for florins
function sellOil() {
    if (oilCount < OIL_SELL_COST) return;
    
    oilCount -= OIL_SELL_COST;
    florinCount += 1;
    updateDisplay();
    saveGame();
}

// Sell olives for florins (deadlock escape hatch)
function sellOlives() {
    if (oliveCount < OLIVE_SELL_COST) return;
    
    oliveCount -= OLIVE_SELL_COST;
    florinCount += 1;
    updateDisplay();
    saveGame();
}

// Repair pressing (reduce strain)
function repairPressing() {
    if (florinCount < REPAIR_COST_FLORINS || pressStrain <= 0) return;
    
    florinCount -= REPAIR_COST_FLORINS;
    pressStrain = 0;
    updateDisplay();
    saveGame();
}

// Establish banking house
function establishBankingHouse() {
    if (florinCount < BANKING_HOUSE_COST || bankingHouseEstablished) return;
    
    florinCount -= BANKING_HOUSE_COST;
    bankingHouseEstablished = true;
    updateDisplay();
    saveGame();
}

// Hire olive harvester
function hireHarvester() {
    if (oilCount < HARVESTER_COST) return;
    
    oilCount -= HARVESTER_COST;
    harvesterCount++;
    updateDisplay();
    saveGame();
}

// Hire press worker
function hirePressWorker() {
    if (oilCount < PRESS_WORKER_COST) return;
    
    oilCount -= PRESS_WORKER_COST;
    pressWorkerCount++;
    updateDisplay();
    saveGame();
}

// Start automation loop for rate-based generation
function startAutomationLoop() {
    if (automationInterval) clearInterval(automationInterval);

    automationInterval = setInterval(() => {
        const dt = UPDATE_INTERVAL / 1000;

        // ---- Harvesters: generate olives by rate ----
        const oliveRate = harvesterCount * HARVESTER_RATE_PER_SEC; // olives/sec
        if (oliveRate > 0) {
            harvesterProgress += oliveRate * dt;

            const producedOlives = Math.floor(harvesterProgress);
            if (producedOlives > 0) {
                oliveCount += producedOlives;
                harvesterProgress -= producedOlives;
                saveGame();
            }

            // UI
            harvesterProgressContainer.classList.add('active');
            harvesterCountdown.classList.add('active');
            harvesterProgressBar.style.width = `${Math.min(harvesterProgress * 100, 100)}%`;

            const secondsLeft = (1 - harvesterProgress) / oliveRate;
            harvesterCountdown.textContent = secondsLeft.toFixed(1);
        } else {
            harvesterProgressContainer.classList.remove('active');
            harvesterCountdown.classList.remove('active');
            harvesterProgressBar.style.width = '0%';
        }
        
        // ---- Press workers: SINGLE press, cost paid at start, speed scales with workers ----
        const pressRate = pressWorkerCount * PRESS_WORKER_RATE_PER_SEC; // presses/sec

        if (pressRate <= 0) {
            // No workers
            pressWorkerProgress = 0;
            autoPressReserved = false;
            pressWorkerProgressContainer.classList.remove('active');
            pressWorkerCountdown.classList.remove('active');
            pressWorkerProgressBar.style.width = '0%';
        } else {
            // If not currently pressing, try to start a new press
            if (!autoPressReserved) {
                if (pressStrain >= PRESS_STRAIN_MAX) {
                    // Can't press: strain maxed out
                    pressWorkerProgress = 0;
                    autoPressReserved = false;
                    pressWorkerProgressContainer.classList.remove('active');
                    pressWorkerCountdown.classList.remove('active');
                    pressWorkerProgressBar.style.width = '0%';
                } else if (oliveCount >= PRESS_COST) {
                    oliveCount -= PRESS_COST;       // PAY COST UP FRONT
                    autoPressReserved = true;
                    pressWorkerProgress = 0;
                    saveGame();
                } else {
                    // Idle: not enough olives
                    pressWorkerProgress = 0;
                    pressWorkerProgressContainer.classList.remove('active');
                    pressWorkerCountdown.classList.remove('active');
                    pressWorkerProgressBar.style.width = '0%';
                    // Do not proceed further this tick
                    // commented this out to make the loop easier to reason about
                    // updateDisplay();
                    // return;
                }
            }

            // Advance progress for the active press
            pressWorkerProgress += pressRate * dt;

            // Handle completion(s) — supports dt spikes cleanly
            let brokeDown = false;
            while (pressWorkerProgress >= 1.0 && !brokeDown) {
                // Complete one press
                oilCount += 1;
                pressWorkerProgress -= 1.0;
                autoPressReserved = false;
                
                // Add strain and check for breakdown
                brokeDown = addPressStrainForOilProduced(1);
                if (brokeDown) {
                    // Breakdown occurred - stop processing
                    break;
                }

                // Check strain before starting next press
                if (pressStrain >= PRESS_STRAIN_MAX) {
                    // Can't continue: strain maxed
                    pressWorkerProgress = 0;
                    break;
                }

                // Immediately try to start the next press if we can afford it
                if (oliveCount >= PRESS_COST) {
                    oliveCount -= PRESS_COST;
                    autoPressReserved = true;
                } else {
                    // Can't continue pressing
                    pressWorkerProgress = 0;
                    break;
                }
            }

            saveGame();

            // UI
            if (autoPressReserved) {
                pressWorkerProgressContainer.classList.add('active');
                pressWorkerCountdown.classList.add('active');
                pressWorkerProgressBar.style.width =
                    `${Math.min(pressWorkerProgress * 100, 100)}%`;

                const secondsLeft = (1 - pressWorkerProgress) / pressRate;
                pressWorkerCountdown.textContent = secondsLeft.toFixed(1);
            } else {
                pressWorkerProgressContainer.classList.remove('active');
                pressWorkerCountdown.classList.remove('active');
                pressWorkerProgressBar.style.width = '0%';
            }
        }

        updateDisplay();
    }, UPDATE_INTERVAL);
}

// Debug Panel
const debugButton = document.getElementById('debug-btn');
const debugModal = document.getElementById('debug-modal');
const closeDebugButton = document.getElementById('close-debug');
const resetGameButton = document.getElementById('reset-game-btn');
const addOlivesButton = document.getElementById('add-olives-btn');
const addOilButton = document.getElementById('add-oil-btn');

function openDebugPanel() {
    debugModal.classList.add('active');
}

function closeDebugPanel() {
    debugModal.classList.remove('active');
}

function resetGame() {
    if (confirm('Are you sure you want to reset the game? All progress will be lost!')) {
        // Clear localStorage
        localStorage.clear();
        
        // Reset all game state
        oliveCount = 0;
        oilCount = 0;
        florinCount = 0;
        harvesterCount = 0;
        pressWorkerCount = 0;
        bankingHouseEstablished = false;
        pressStrain = 0;
        isHarvesting = false;
        isPressing = false;
        harvesterProgress = 0;
        pressWorkerProgress = 0;
        autoPressReserved = false;
        
        // Clear automation interval
        if (automationInterval) {
            clearInterval(automationInterval);
            automationInterval = null;
        }
        
        // Reset UI
        oliveProgressContainer.classList.remove('active');
        oliveCountdown.classList.remove('active');
        oliveProgressBar.style.width = '0%';
        
        oilProgressContainer.classList.remove('active');
        oilCountdown.classList.remove('active');
        oilProgressBar.style.width = '0%';
        
        harvesterProgressContainer.classList.remove('active');
        harvesterCountdown.classList.remove('active');
        harvesterProgressBar.style.width = '0%';
        
        pressWorkerProgressContainer.classList.remove('active');
        pressWorkerCountdown.classList.remove('active');
        pressWorkerProgressBar.style.width = '0%';
        
        harvestButton.disabled = false;
        
        // Update display
        updateDisplay();
        
        // Close debug panel
        closeDebugPanel();
        
        // Restart automation
        startAutomationLoop();
    }
}

function addOlives() {
    oliveCount += 100;
    updateDisplay();
    saveGame();
}

function addOil() {
    oilCount += 100;
    updateDisplay();
    saveGame();
}

// Event listeners
harvestButton.addEventListener('click', startHarvest);
pressButton.addEventListener('click', startPress);
sellOilButton.addEventListener('click', sellOil);
sellOlivesButton.addEventListener('click', sellOlives);
repairPressingButton.addEventListener('click', repairPressing);
establishBankingButton.addEventListener('click', establishBankingHouse);
hireButton.addEventListener('click', hireHarvester);
hirePressButton.addEventListener('click', hirePressWorker);

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

// Initialize game
loadGame();
updateDisplay();
startAutomationLoop();
