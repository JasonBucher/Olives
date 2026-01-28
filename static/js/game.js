// Game state
let oliveCount = 0;
let oilCount = 0;
let harvesterCount = 0;
let pressWorkerCount = 0;
let isHarvesting = false;
let isPressing = false;

// DOM elements
const oliveCountElement = document.getElementById('olive-count');
const oilCountElement = document.getElementById('oil-count');
const harvesterCountElement = document.getElementById('harvester-count');
const pressWorkerCountElement = document.getElementById('press-worker-count');
const harvestButton = document.getElementById('harvest-btn');
const pressButton = document.getElementById('press-btn');
const hireButton = document.getElementById('hire-btn');
const hirePressButton = document.getElementById('hire-press-btn');

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
const HARVESTER_BASE_TIME = 3000; // 3 seconds for first harvester
const HARVESTER_TIME_REDUCTION = 100; // 0.1 seconds per additional harvester
const PRESS_WORKER_BASE_TIME = 5000; // 5 seconds for first press worker
const PRESS_WORKER_TIME_REDUCTION = 100; // 0.1 seconds per additional press worker
const UPDATE_INTERVAL = 100; // Update every 100ms

let harvesterInterval = null;
let pressWorkerInterval = null;

// Load saved game state
function loadGame() {
    const savedOlives = localStorage.getItem('oliveCount');
    const savedOil = localStorage.getItem('oilCount');
    const savedHarvesters = localStorage.getItem('harvesterCount');
    const savedPressWorkers = localStorage.getItem('pressWorkerCount');
    if (savedOlives) {
        oliveCount = parseInt(savedOlives, 10);
    }
    if (savedOil) {
        oilCount = parseInt(savedOil, 10);
    }
    if (savedHarvesters) {
        harvesterCount = parseInt(savedHarvesters, 10);
    }
    if (savedPressWorkers) {
        pressWorkerCount = parseInt(savedPressWorkers, 10);
    }
    updateDisplay();
}

// Save game state
function saveGame() {
    localStorage.setItem('oliveCount', oliveCount);
    localStorage.setItem('oilCount', oilCount);
    localStorage.setItem('harvesterCount', harvesterCount);
    localStorage.setItem('pressWorkerCount', pressWorkerCount);
}

// Update displays
function updateDisplay() {
    oliveCountElement.textContent = oliveCount;
    oilCountElement.textContent = oilCount;
    harvesterCountElement.textContent = harvesterCount;
    pressWorkerCountElement.textContent = pressWorkerCount;
    
    // Update timing info
    if (harvesterCount > 0) {
        const time = (getHarvesterTime() / 1000).toFixed(1);
        harvesterTimingElement.textContent = `(${time}s, -0.1s per harvester)`;
    } else {
        harvesterTimingElement.textContent = '(3.0s base, -0.1s per harvester)';
    }
    
    if (pressWorkerCount > 0) {
        const time = (getPressWorkerTime() / 1000).toFixed(1);
        pressWorkerTimingElement.textContent = `(${time}s, -0.1s per worker)`;
    } else {
        pressWorkerTimingElement.textContent = '(5.0s base, -0.1s per worker)';
    }
    
    // Update button states
    pressButton.disabled = isPressing || oliveCount < PRESS_COST;
    hireButton.disabled = oilCount < HARVESTER_COST;
    hirePressButton.disabled = oilCount < PRESS_WORKER_COST;
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
        
        // Check if press workers can now start with new olives
        if (pressWorkerCount > 0 && !pressWorkerInterval && oliveCount >= PRESS_COST) {
            startPressWorkerGeneration();
        }
    }, 200);
}

// Start pressing oil
function startPress() {
    if (isPressing || oliveCount < PRESS_COST) return;
    
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
    updateDisplay();
    saveGame();
    
    setTimeout(() => {
        oilProgressBar.style.width = '0%';
        oilProgressContainer.classList.remove('active');
        oilCountdown.classList.remove('active');
        isPressing = false;
        updateDisplay(); // Re-check button state
    }, 200);
}

// Hire olive harvester
function hireHarvester() {
    if (oilCount < HARVESTER_COST) return;
    
    oilCount -= HARVESTER_COST;
    harvesterCount++;
    updateDisplay();
    saveGame();
    
    // Start or restart harvester generation
    startHarvesterGeneration();
}

// Calculate harvester generation time
function getHarvesterTime() {
    if (harvesterCount === 0) return 0;
    // 2 seconds base, minus 0.1s per additional harvester
    return HARVESTER_BASE_TIME - ((harvesterCount - 1) * HARVESTER_TIME_REDUCTION);
}

// Start passive olive generation from harvesters
function startHarvesterGeneration() {
    // Clear any existing interval
    if (harvesterInterval) {
        clearInterval(harvesterInterval);
        harvesterInterval = null;
    }
    
    if (harvesterCount === 0) {
        harvesterProgressContainer.classList.remove('active');
        harvesterCountdown.classList.remove('active');
        return;
    }
    
    const generationTime = getHarvesterTime();
    harvesterProgressContainer.classList.add('active');
    harvesterCountdown.classList.add('active');
    harvesterProgressBar.style.width = '0%';
    
    const startTime = Date.now();
    
    harvesterInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / generationTime) * 100, 100);
        const timeLeft = Math.max(0, (generationTime - elapsed) / 1000);
        
        harvesterProgressBar.style.width = progress + '%';
        harvesterCountdown.textContent = timeLeft.toFixed(1);
        
        if (progress >= 100) {
            // Generate an olive
            oliveCount++;
            updateDisplay();
            saveGame();
            
            // Check if press workers can now start with new olives
            if (pressWorkerCount > 0 && !pressWorkerInterval && oliveCount >= PRESS_COST) {
                startPressWorkerGeneration();
            }
            
            // Restart the generation cycle
            clearInterval(harvesterInterval);
            startHarvesterGeneration();
        }
    }, UPDATE_INTERVAL);
}

// Hire press worker
function hirePressWorker() {
    if (oilCount < PRESS_WORKER_COST) return;
    
    oilCount -= PRESS_WORKER_COST;
    pressWorkerCount++;
    updateDisplay();
    saveGame();
    
    // Start or restart press worker generation
    startPressWorkerGeneration();
}

// Calculate press worker generation time
function getPressWorkerTime() {
    if (pressWorkerCount === 0) return 0;
    // 5 seconds base, minus 0.1s per additional press worker
    return PRESS_WORKER_BASE_TIME - ((pressWorkerCount - 1) * PRESS_WORKER_TIME_REDUCTION);
}

// Start passive oil generation from press workers
function startPressWorkerGeneration() {
    // Clear any existing interval
    if (pressWorkerInterval) {
        clearInterval(pressWorkerInterval);
        pressWorkerInterval = null;
    }
    
    if (pressWorkerCount === 0) {
        pressWorkerProgressContainer.classList.remove('active');
        pressWorkerCountdown.classList.remove('active');
        return;
    }
    
    // Check if we have enough olives to start production
    if (oliveCount < PRESS_COST) {
        pressWorkerProgressContainer.classList.remove('active');
        pressWorkerCountdown.classList.remove('active');
        return;
    }
    
    // Consume olives to start production
    oliveCount -= PRESS_COST;
    updateDisplay();
    saveGame();
    
    const generationTime = getPressWorkerTime();
    pressWorkerProgressContainer.classList.add('active');
    pressWorkerCountdown.classList.add('active');
    pressWorkerProgressBar.style.width = '0%';
    
    const startTime = Date.now();
    
    pressWorkerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / generationTime) * 100, 100);
        const timeLeft = Math.max(0, (generationTime - elapsed) / 1000);
        
        pressWorkerProgressBar.style.width = progress + '%';
        pressWorkerCountdown.textContent = timeLeft.toFixed(1);
        
        if (progress >= 100) {
            // Generate oil
            oilCount++;
            updateDisplay();
            saveGame();
            
            // Restart the generation cycle
            clearInterval(pressWorkerInterval);
            startPressWorkerGeneration();
        }
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
        harvesterCount = 0;
        pressWorkerCount = 0;
        isHarvesting = false;
        isPressing = false;
        
        // Clear all intervals
        if (harvesterInterval) {
            clearInterval(harvesterInterval);
            harvesterInterval = null;
        }
        if (pressWorkerInterval) {
            clearInterval(pressWorkerInterval);
            pressWorkerInterval = null;
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
        
        // Restart generation systems
        startHarvesterGeneration();
        startPressWorkerGeneration();
    }
}

function addOlives() {
    oliveCount += 100;
    updateDisplay();
    saveGame();
    
    // Check if press workers can now start
    if (pressWorkerCount > 0 && !pressWorkerInterval && oliveCount >= PRESS_COST) {
        startPressWorkerGeneration();
    }
}

function addOil() {
    oilCount += 100;
    updateDisplay();
    saveGame();
}

// Event listeners
harvestButton.addEventListener('click', startHarvest);
pressButton.addEventListener('click', startPress);
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
startHarvesterGeneration();
startPressWorkerGeneration();
