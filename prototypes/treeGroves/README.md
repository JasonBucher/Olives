# Prototype Template

This folder is a starting point for new prototypes.

## How to use
1. Copy this folder into `prototypes/<prototypeName>/`
2. In `static/js/game.js`, rename:
   - STORAGE_PREFIX to "<prototypeName>_"
   - (STORAGE_KEY auto-derives from prefix)
3. Update the title in `index.html` if desired.

## Guarantees
- Storage is isolated by STORAGE_PREFIX + STORAGE_KEY
- Reset only clears this prototype's storage
- Reset is safe against interval re-saving state
- Includes a minimal Debug modal and event log

## What to add next
- New resources and UI sections
- Passive production (use dt in main loop)
- Unlock / reveal logic
- Market shipments, pressing, failures, etc.
