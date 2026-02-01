# Claude Prompts – Prototype Workflow

This file contains **copy/paste prompts** for working with Claude while respecting the project’s prototype structure.

---

## Starting a New Prototype

```
You are helping me spin up a new idle-game prototype.

Follow the Prototype Spin-Up Checklist and repository rules.

Prototype name: <prototypeName>
Status: EXPERIMENTAL
Focus: <1–2 focus tags>
Intent: <one sentence>

Rules:
- Start from /prototype-template/
- Rename STORAGE_PREFIX to "<prototypeName>_"
- Keep STORAGE_KEY = STORAGE_PREFIX + "gameState"
- Reset removes only STORAGE_KEY
- Never clear all localStorage

Do not modify other prototypes.
```
