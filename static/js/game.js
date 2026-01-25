// Game state
let oliveCount = 0;
let oilCount = 0;
let harvesterCount = 0;
let isHarvesting = false;
let isPressing = false;

// DOM elements
const oliveCountElement = document.getElementById('olive-count');
const oilCountElement = document.getElementById('oil-count');
const harvesterCountElement = document.getElementById('harvester-count');
const harvestButton = document.getElementById('harvest-btn');
const pressButton = document.getElementById('press-btn');
const hireButton = document.getElementById('hire-btn');

const oliveProgressContainer = document.getElementById('olive-progress-container');
const oliveProgressBar = document.getElementById('olive-progress-bar');
const oliveCountdown = document.getElementById('olive-countdown');

const oilProgressContainer = document.getElementById('oil-progress-container');
const oilProgressBar = document.getElementById('oil-progress-bar');
const oilCountdown = document.getElementById('oil-countdown');

// Constants
const HARVEST_TIME = 3000; // 3 seconds
const PRESS_TIME = 5000; // 5 seconds
const PRESS_COST = 3; // olives
const HARVESTER_COST = 10; // oil
const UPDATE_INTERVAL = 100; // Update every 100ms

// Load saved game state
function loadGame() {
    const savedOlives = localStorage.getItem('oliveCount');
    const savedOil = localStorage.getItem('oilCount');
    const savedHarvesters = localStorage.getItem('harvesterCount');
    if (savedOlives) {
        oliveCount = parseInt(savedOlives, 10);
    }
    if (savedOil) {
        oilCount = parseInt(savedOil, 10);
    }
    if (savedHarvesters) {
        harvesterCount = parseInt(savedHarvesters, 10);
    }
    updateDisplay();
}

// Save game state
function saveGame() {
    localStorage.setItem('oliveCount', oliveCount);
    localStorage.setItem('oilCount', oilCount);
    localStorage.setItem('harvesterCount', harvesterCount);
}

// Update displays
function updateDisplay() {
    oliveCountElement.textContent = oliveCount;
    oilCountElement.textContent = oilCount;
    harvesterCountElement.textContent = harvesterCount;
    
    // Update button states
    pressButton.disabled = isPressing || oliveCount < PRESS_COST;
    hireButton.disabled = oilCount < HARVESTER_COST;
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
        
        // Auto-harvest if we have harvesters
        checkAutoHarvest();
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
    
    // Start auto-harvesting if not already harvesting
    checkAutoHarvest();
}

// Check if we should auto-harvest
function checkAutoHarvest() {
    if (harvesterCount > 0 && !isHarvesting) {
        startHarvest();
    }
}

// Event listeners
harvestButton.addEventListener('click', startHarvest);
pressButton.addEventListener('click', startPress);
hireButton.addEventListener('click', hireHarvester);

// Initialize game
loadGame();
updateDisplay();
checkAutoHarvest();
