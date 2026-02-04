# Tree Groves Prototype - Unit Tests

## Overview

This prototype now includes unit tests for the harvest outcome weight calculation logic. The tests protect against "probability drift" by ensuring:
1. Weight conservation (sum remains ~1.0)
2. Interrupted outcome stability (unchanged at 0.10)
3. Non-negative weights in all scenarios

## Setup

### Prerequisites

You need Node.js installed on your system. If you don't have it:

**macOS:**
```bash
# Using Homebrew
brew install node

# Or download from https://nodejs.org/
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install nodejs npm

# Or download from https://nodejs.org/
```

**Windows:**
Download and install from https://nodejs.org/

### Installing Test Dependencies

Once Node.js is installed, navigate to the prototype directory and install dependencies:

```bash
cd /Users/jasonbucher/dev/IdleGame1/prototypes/treeGroves
npm install
```

This installs Vitest, a fast unit test framework for JavaScript.

## Running Tests

### Run tests once

```bash
npm test
```

This runs all tests and shows the results.

### Watch mode (for development)

```bash
npm run test:watch
```

This runs tests continuously, re-running them whenever you save changes to test files or source code. Press `q` to quit.

## Files Added/Changed

### New Files:
- **package.json** - Defines test scripts and Vitest dependency
- **vitest.config.js** - Vitest configuration
- **test-utils.js** - Exports pure function for testing
- **harvest-weights.test.js** - Unit tests for harvest weight math
- **.gitignore** - Excludes node_modules and coverage from git

### Modified Files:
- **static/js/game.js** - Added `computeHarvestOutcomeWeights()` pure function, refactored `startHarvest()` to use it

## Test Coverage

The test suite includes:

### Conservation Tests (6 tests)
Verify that weight sum remains ~1.0 across various scenarios:
- 0 harvesters, no upgrades
- 5 harvesters, no upgrades
- 10 harvesters with arborist
- 5 harvesters with multiple upgrades
- Edge cases with all upgrades

### Interrupted Stability Tests (4 tests)
Confirm that `interrupted_short` weight stays exactly 0.10:
- With varying harvester counts (0, 5, 10)
- With arborist active
- With all upgrades enabled

### Non-Negative Tests (5 tests)
Ensure all weights are >= 0:
- Various harvester counts
- Different upgrade combinations
- Extreme case (20 harvesters, all upgrades)

### Specific Weight Adjustment Tests (4 tests)
Validate expected behavior:
- Poor weight increases with more harvesters
- Arborist reduces poor weight increase
- Arborist increases efficient weight
- standardized_tools upgrade reduces poor weight

## Understanding the Pure Function

The refactored code extracts harvest weight logic into `computeHarvestOutcomeWeights()`:

```javascript
computeHarvestOutcomeWeights({ 
  outcomes,        // Base harvest outcomes
  harvesterCount,  // Number of harvesters
  arboristIsActive, // Whether arborist is hired
  upgrades         // Object with upgrade flags
})
```

**Benefits:**
- No DOM access or global state reads
- Easy to test in isolation
- Clear input/output contract
- Same logic used by game and tests

## Development Workflow

1. Make changes to the harvest weight logic in `test-utils.js`
2. Update the same logic in `game.js` (keep them in sync)
3. Run `npm run test:watch` to see if tests pass
4. Add new tests for new scenarios
5. Game remains playable as a static prototype (tests are dev-only)

## Notes

- Tests run in Node.js environment (no browser needed)
- The game itself still runs as a static HTML page
- No bundler or build step required for the game
- Tests use the same logic as the game through the exported pure function
