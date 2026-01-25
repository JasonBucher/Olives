// Game state
let oliveCount = 0;
let isHarvesting = false;

// DOM elements
const oliveCountElement = document.getElementById('olive-count');
const harvestButton = document.getElementById('harvest-btn');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');

// Constants
const HARVEST_TIME = 3000; // 3 seconds in milliseconds
const PROGRESS_UPDATE_INTERVAL = 10; // Update progress every 10ms for smooth animation

// Load saved game state
function loadGame() {
    const savedCount = localStorage.getItem('oliveCount');
    if (savedCount) {
        oliveCount = parseInt(savedCount, 10);
        updateOliveDisplay();
    }
}

// Save game state
function saveGame() {
    localStorage.setItem('oliveCount', oliveCount);
}

// Update olive count display
function updateOliveDisplay() {
    oliveCountElement.textContent = oliveCount;
}

// Start harvesting
function startHarvest() {
    if (isHarvesting) return;
    
    isHarvesting = true;
    harvestButton.disabled = true;
    progressContainer.classList.add('active');
    progressBar.style.width = '0%';
    
    const startTime = Date.now();
    
    // Update progress bar smoothly
    const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / HARVEST_TIME) * 100, 100);
        progressBar.style.width = progress + '%';
        
        if (progress >= 100) {
            clearInterval(progressInterval);
            completeHarvest();
        }
    }, PROGRESS_UPDATE_INTERVAL);
}

// Complete harvest and add olive
function completeHarvest() {
    oliveCount++;
    updateOliveDisplay();
    saveGame();
    
    // Reset UI
    setTimeout(() => {
        progressBar.style.width = '0%';
        progressContainer.classList.remove('active');
        isHarvesting = false;
        harvestButton.disabled = false;
    }, 200);
}

// Event listeners
harvestButton.addEventListener('click', startHarvest);

// Initialize game
loadGame();
