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
- **static/js/harvestWeights.js** - Shared pure module for harvest weight logic
- **test-utils.js** - Re-exports shared functions for tests
- **harvest-weights.test.js** - Unit tests for harvest weight math
- **.gitignore** - Excludes node_modules and coverage from git

### Modified Files:
- **static/js/game.js** - Imports and uses shared `computeHarvestOutcomeWeights()` function
- **index.html** - Loads game.js as ES module (`type="module"`)

## Architecture

The harvest weight calculation logic is now **shared** between the game and tests:

```
static/js/harvestWeights.js  (source of truth)
       ↓                ↓
   game.js          test-utils.js → harvest-weights.test.js
```

This ensures tests always exercise the **exact same implementation** the game uses, eliminating the risk of false confidence from divergent implementations.

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

The harvest weight logic is now centralized in [static/js/harvestWeights.js](static/js/harvestWeights.js):

```javascript
import { computeHarvestOutcomeWeights } from './harvestWeights.js';
import { TUNING } from './static/js/tuning.js';

computeHarvestOutcomeWeights({ 
  outcomes: TUNING.harvest.outcomes, // Base harvest outcomes
  harvesterCount,  // Number of harvesters
  arboristIsActive, // Whether arborist is hired
  upgrades,        // Object with upgrade flags
  tuning: TUNING.harvest, // Shared tuning constants
})
```

**Benefits:**
- **Single source of truth** - one implementation used by both game and tests
- No DOM access or global state reads
- Easy to test in isolation
- Clear input/output contract
- Tests verify the actual game logic, not a copy

## Development Workflow

1. Edit harvest weight logic in **static/js/harvestWeights.js** (single source of truth)
2. Run `npm run test:watch` to see if tests pass
3. Add new tests for new scenarios in **harvest-weights.test.js**
4. Both game and tests automatically use the updated logic
5. Game remains playable as a static prototype (ES modules work natively in modern browsers)

## Notes

- Tests run in Node.js environment (no browser needed)
- The game runs as ES modules in the browser (no bundler required)
- Modern browsers natively support ES modules with `type="module"`
- Tests use the same logic as the game through the shared module
- **No risk of test/game divergence** - both import from harvestWeights.js
