# Prototype Template

This folder is a starting point for new prototypes.

## How to use
1. Copy this folder into `prototypes/<prototypeName>/`
2. In `static/js/game.js`, rename:
   - STORAGE_PREFIX to "<prototypeName>_"
   - (STORAGE_KEY auto-derives from prefix)
3. Update the title in `index.html` if desired.

## File overview
- `static/js/game.js` — Main loop, state, DOM wiring, save/load
- `static/js/tuning.js` — All balance constants (zero hardcoded numbers elsewhere)
- `static/js/gameCalc.js` — Pure calculation functions (no DOM, no side effects, explicit args)
- `static/js/investments.js` — Investment registry with documented contract shape
- `gameCalc.test.js` — Example tests for the calc module

## Guarantees
- Storage is isolated by STORAGE_PREFIX + STORAGE_KEY
- Only keys in `PERSISTED_STATE_KEYS` are saved — transient state (click timestamps, etc.) is excluded
- Reset only clears this prototype's storage
- Reset is safe against interval re-saving state
- Includes a minimal Debug modal and event log

## Testing
```
npm install
npm test           # single run
npm run test:watch # watch mode
```

## What to add next
- New resources and UI sections
- Passive production (use dt in main loop)
- Unlock / reveal logic
- Market shipments, pressing, failures, etc.
- New investments in the `INVESTMENTS` array
- New pure functions in `gameCalc.js` (with tests)
