# Prototypes

This project is structured as a **prototype lab** rather than a single evolving codebase.

Each prototype explores a specific design question (economy loop, UI paradigm, failure mode, etc.).
Prototypes live side-by-side and are never forced to evolve together.

The root of the repository is a **launcher**, not a game.

---

## Folder Structure

```
/
  index.html            # Launcher
  launcher.css
  prototypes/
    <prototype-name>/
      index.html
      static/
        css/style.css
        js/game.js
```

Each prototype is fully self-contained.

---

## Prototype Naming

Each prototype has:
- a folder name
- a storage prefix
- a clear design intent

Examples:
- progressBars
- revealUI
- treesMarket
- institutions

Folder name and storage prefix must match.

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

This guarantees:
- no collisions between prototypes
- safe parallel iteration
- reliable first-play testing

---

## Launcher Responsibilities

The launcher:
- lists all prototypes
- communicates status and focus
- never loads game code

Each prototype entry should include:
- name
- tags (status + focus)
- link to `/prototypes/<name>/`

Example tags:
- Status: EXPERIMENTAL, STABLE, ARCHIVED
- Focus: Progress Bars, Reveal UI, Market Risk, Institutions

---

## Reset Expectations

A prototype reset must:
- return the UI to a visibly minimal starting state
- not affect other prototypes
- allow the first interaction to be obvious

Reset behavior is part of the design, not a debugging afterthought.

---

## Promotion & Archiving

Prototypes are never deleted casually.

When a prototype:
- proves a core loop → it may be promoted to “mainline”
- answers its design question → it may be archived

Archived prototypes remain playable and documented.

---

## Philosophy

Prototypes are disposable.
Insights are not.

Structure exists to support exploration, not constrain it.
