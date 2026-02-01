# Prototypes

This project is structured as a **prototype lab** rather than a single evolving codebase.

Each prototype explores a specific design question (economy loop, UI paradigm, failure mode, etc.).
Prototypes live side-by-side and are never forced to evolve together.

The repository root is a **launcher**, not a game.

---

## Folder Structure

```
/
  index.html            # Launcher
  launcher.css
  prototype-template/   # Canonical starting point for new prototypes
  prototypes/
    <prototypeName>/
      index.html
      static/
        css/style.css
        js/game.js
```

Each prototype is fully self-contained.

---

## Prototype Naming

Each prototype has:
- a **folder name**
- a **storage prefix**
- a **clear design intent**

Examples:
- progressBars
- revealUI
- treesMarket
- institutions

Folder name and storage prefix must match exactly.

---

## Prototype Template (Required)

All new prototypes MUST start from `prototype-template/`.

Do not start from scratch.
Do not fork an old prototype unless you are explicitly testing regression behavior.

The template guarantees:
- correct save / load behavior
- safe reset logic
- storage isolation
- debug + logging utilities

When creating a new prototype:
1. Copy `prototype-template/` → `prototypes/<prototypeName>/`
2. Rename `STORAGE_PREFIX` in `static/js/game.js` to `<prototypeName>_`
3. Leave `STORAGE_KEY = STORAGE_PREFIX + "gameState"` unchanged

---

## Storage Rules (Non-Negotiable)

Every prototype must follow the same storage pattern:

```js
const STORAGE_PREFIX = "<prototypeName>_";
const STORAGE_KEY = STORAGE_PREFIX + "gameState";
```

Rules:
- All game state is saved under `STORAGE_KEY`
- No prototype may call:
  - `localStorage.clear()`
  - `sessionStorage.clear()`
- Reset removes **only** its own `STORAGE_KEY`
- Reset must reload with cache-bust

```js
localStorage.removeItem(STORAGE_KEY);
window.location.href = window.location.pathname + "?t=" + Date.now();
```

---

## Launcher Responsibilities

The launcher:
- lists all prototypes
- communicates **status** and **focus**
- never loads game code

Each prototype entry should include:
- name
- tags (status + focus)
- link to `/prototypes/<prototypeName>/`

---

## Philosophy

Prototypes are disposable.
Insights are not.
