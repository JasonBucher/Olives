# Prototype Template

Starting point for new idle game prototypes. Copy this folder, rename `STORAGE_PREFIX`, and start building.

## Quick start
1. Copy this folder into `prototypes/<prototypeName>/`
2. In `static/js/game.js`, rename `STORAGE_PREFIX` to `"<prototypeName>_"`
3. Update the `<title>` in `index.html`
4. `npm install` to set up testing

## Systems

### Centralized Tuning (`static/js/tuning.js`)
Single `TUNING` object holds every balance-relevant number. The rule: **zero hardcoded game numbers anywhere else**. When you add a new mechanic, add its constants here first, then reference `TUNING.x.y` in game code. This makes rebalancing a one-file job.

### Pure Calculations (`static/js/gameCalc.js`)
All math and formatting lives here as pure functions — explicit arguments, no DOM access, no side effects. This is the "testable layer." Starter utilities included: `clamp`, `rollWeighted`, `formatRate`, `getDisplayCount`. When you add game logic (production rates, cost curves, conversion math), put the calculation here and call it from `game.js`.

### Investment Registry (`static/js/investments.js`)
Flat array of purchasable upgrades. Each entry follows a documented contract:
```
{ id, title, group, cost(), isUnlocked(), isOwned(), canPurchase(), purchase(), effectLines() }
```
One example investment (`sharper_pick`) is included to show the shape. For repeatable upgrades, use the `baseCost + level * costScale` pattern and track state as `${id}Level`. The registry drives both the purchase logic and the UI display — add entries here, render them in `game.js`.

### Persisted State Allowlist (`game.js`)
State is split into persistent (saved to localStorage) and transient (click timestamps, UI flags). Three pieces enforce this:
- **`PERSISTED_STATE_KEYS`** — the allowlist. Only these keys are written to / read from storage.
- **`createDefaultState()`** — factory for a fresh state object. Every key lives here. Add new state here AND to the allowlist if it should persist.
- **`buildPersistedState()` / `pickPersistedState()`** — filter state through the allowlist on save and load.

This prevents localStorage bloat and avoids loading stale transient data on reload.

### ES Modules
All JS files use `import`/`export`. The HTML loads `game.js` with `<script type="module">`. This keeps each system in its own file and enables tree-shaking by test runners.

### Vitest Testing (`gameCalc.test.js`, `logger.test.js`)
Tests import directly from module files and run with `vitest`. Starter tests cover calc utilities plus the shared DOM logger helper. The pattern: every pure function in `gameCalc.js` gets a corresponding test, and reusable UI helpers (like logging) get focused module tests with lightweight mocks.

```
npm test           # single run
npm run test:watch # watch mode
```

## Built-in infrastructure
- **Storage isolation** — `STORAGE_PREFIX` scopes localStorage so prototypes never collide
- **Safe reset** — `isResetting` flag prevents the main loop interval from re-saving state after a reset
- **Debug modal** — +100 resources buttons and a reset button, wired up and ready
- **Event log** — Uses shared `createDomLogger` helper (timestamped, capped at 60 lines, newest on top)

## File map
| File | Role |
|------|------|
| `static/js/tuning.js` | Balance constants |
| `static/js/gameCalc.js` | Pure math/formatting functions |
| `static/js/investments.js` | Upgrade registry |
| `static/js/logger.js` | Reusable DOM log writer (line cap, timestamps, optional colors, `data-ts`) |
| `static/js/game.js` | Main loop, state, DOM, save/load |
| `static/css/style.css` | Dark theme, 3-column grid layout |
| `gameCalc.test.js` | Unit tests for calc functions |
| `logger.test.js` | Unit tests for reusable logger helper |
| `index.html` | 3-column UI shell |
| `INTENT.md` | Design philosophy |
