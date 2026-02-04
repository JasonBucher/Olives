# Tree Groves Prototype

Idle game prototype focused on olive harvesting, workers, upgrades, and market mechanics.

## Running Locally

**Important:** This prototype uses ES6 modules (`import` statements), which don't work when opening `index.html` directly in a browser (file:// protocol). You must serve it over HTTP.

### Option 1: Using npm (recommended)
```bash
npm run serve
```
Then open: **http://localhost:8000**

### Option 2: Using Python directly
```bash
python3 -m http.server 8000
```
Then open: **http://localhost:8000**

### Option 3: Using any static server
Any HTTP server pointed at this directory will work. For example:
```bash
npx serve
```

## Why ES6 Modules?

The game and unit tests share the same harvest weight calculation logic via ES6 modules. This ensures:
- Single source of truth for game math
- Tests validate the exact code that runs in the game
- No risk of divergent implementations

ES6 modules require HTTP/HTTPS for security reasons, which is why file:// doesn't work.

## Development

### Running Tests
```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode
```

### Project Structure
- `index.html` - Main game page
- `static/js/game.js` - Game logic (imports from harvestWeights.js)
- `static/js/harvestWeights.js` - Shared harvest calculation logic
- `harvest-weights.test.js` - Unit tests for harvest weights
- `test-utils.js` - Test utilities that re-export shared functions

## Storage

- Storage is isolated by `treeGroves_` prefix
- Reset only clears this prototype's storage
- Game state is auto-saved on changes

## GitHub Pages

This prototype works on GitHub Pages since it's served over HTTPS.

## Features

- **Grove**: Trees grow olives automatically (capped by capacity)
- **Harvesting**: Manual harvest with probabilistic outcomes (poor/normal/efficient/interrupted)
- **Workers**: Hire harvesters to increase batch size and speed
- **Managers**: Hire arborist to improve harvest quality and reduce poor outcomes
- **Upgrades**: 5 harvest improvements (tools, training, picking technique, equipment, quality control)
- **Market**: Ship olives to market for florins
- **Unit Tests**: 19 tests covering harvest weight calculations
