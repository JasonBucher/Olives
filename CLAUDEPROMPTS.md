# Claude Prompts – Prototype Workflow

This file contains **copy/paste prompts** for working with Claude while respecting the project’s prototype structure.

---

## Starting a New Prototype

```
You are helping me spin up a new idle-game prototype in this repository.

Follow the Prototype Spin-Up Checklist and repository rules.

Prototype name: <prototypeName>
Status: EXPERIMENTAL
Focus: <1–2 focus tags>
Intent: <one sentence>

Hard rules:
- Start from /prototypes/prototype-template/
- Create the new prototype at /prototypes/<prototypeName>/
- Do not modify other prototypes

Storage rules (must be consistent across all prototypes):
- Set STORAGE_PREFIX = "<prototypeName>_"
- Set STORAGE_KEY = STORAGE_PREFIX + "gameState"
- Reset removes ONLY STORAGE_KEY
- Never use localStorage.clear() or sessionStorage.clear()
- All saved keys must derive from STORAGE_PREFIX / STORAGE_KEY

Philosophy rails (inherited from template):
- UI is three columns:
  - Left: Capital (meta resources + upgrades / investments)
  - Middle: Estate (production engine)
  - Right: Institutions (market / church / bank)
- Prefer time + outcomes over instant conversion
- Logs explain loss, delay, and causality; they are not cosmetic

Deliverables:
1) Copy the template folder to /prototypes/<prototypeName>/
2) Update title/header text to <prototypeName>
3) Ensure storage prefix/key + reset behavior follow the rules above
4) Create /prototypes/<prototypeName>/INTENT.md with:
   - Core idea (1 paragraph)
   - Column model (short)
   - In-scope / Out-of-scope (bullets)
   - Success criteria (bullets)

Do not add gameplay mechanics unless explicitly asked.
```

## Prototype Spin-Up Checklist (fast)

- [ ] Copy `/prototypes/prototype-template/` → `/prototypes/<name>/`
- [ ] Set `STORAGE_PREFIX = "<name>_"` and `STORAGE_KEY = STORAGE_PREFIX + "gameState"`
- [ ] Reset deletes only `STORAGE_KEY` (never clears all storage)
- [ ] Confirm the 3-column layout contract exists (Capital / Estate / Institutions)
- [ ] Confirm a Log exists and can display messages
- [ ] Create `/prototypes/<name>/INTENT.md`
- [ ] Add prototype metadata to the launcher (if applicable)

## Anti-bloat rule

The prototype-template encodes structure and design rails, not gameplay systems.

Do NOT add to the template:
- shipping logic
- market logic
- upgrade trees
- debt or banking mechanics
- event tables

If a system is large enough to need rules, it belongs in a prototype.
