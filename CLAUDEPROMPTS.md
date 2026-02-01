# Claude Prompts – Prototype Workflow

This file contains **copy/paste prompts** for working with Claude while respecting the project’s prototype structure.

Always follow this flow.

---

## 0. Starting a New Prototype (Mandatory First Prompt)

Use this before asking Claude to write or modify any code.

```
You are helping me spin up a new idle-game prototype.

Follow the Prototype Spin-Up Checklist.

Prototype name: <prototypeName>
Status: EXPERIMENTAL
Focus: <1–2 focus tags>
Intent (one sentence): <what this prototype is exploring>

The prototype must:
- live in /prototypes/<prototypeName>/
- be fully isolated from other prototypes
- use a single STORAGE_KEY derived from STORAGE_PREFIX
- never use localStorage.clear()

Do not modify other prototypes or the launcher unless explicitly asked.
```

---

## 1. Create Prototype Scaffold

```
Create a new prototype scaffold.

Actions:
- Create folder /prototypes/<prototypeName>/
- Copy an existing working prototype as a base
- Ensure index.html, static/js/game.js, static/css/style.css exist
- Fix asset paths to be relative to the prototype folder

Do not change gameplay yet.
Return updated files only.
```

---

## 2. Enforce Storage Isolation

```
Standardize storage for this prototype.

In static/js/game.js:
- Define:
  const STORAGE_PREFIX = "<prototypeName>_";
  const STORAGE_KEY = STORAGE_PREFIX + "gameState";

- Use STORAGE_KEY for all save/load logic
- Reset must remove only STORAGE_KEY
- Do not use localStorage.clear() or sessionStorage.clear()

Do not change gameplay logic.
Return updated game.js only.
```

---

## 3. Add Prototype to Launcher

```
Update the launcher to include this prototype.

- Add a link to /prototypes/<prototypeName>/
- Add tags for status and focus
- Keep launcher styling consistent
- Do not change other prototype links

Return updated launcher files only.
```

---

## 4. Modify Gameplay Within a Prototype

```
Modify gameplay ONLY inside /prototypes/<prototypeName>/.

Do not:
- change other prototypes
- change storage conventions
- touch the launcher

Describe changes clearly and minimally.
```

---

## 5. Reset & First-Play Verification

```
Verify reset behavior.

Confirm:
- Reset clears only this prototype’s state
- UI returns to minimal first-play state
- Other prototypes retain their saves

If issues are found, fix reset logic only.
```

---

## 6. Refactor Warning Prompt (Use Sparingly)

```
This request involves a structural refactor.

Before proceeding:
- Explain what will be changed
- Confirm which files will be modified
- Confirm no cross-prototype impact

Wait for approval before making changes.
```

---

## 7. Archive or Promote a Prototype

```
Update prototype status.

- Change tag to ARCHIVED or STABLE
- Do not delete files
- Update launcher labels only

No gameplay changes.
```

---

## Reminder

If Claude:
- removes isolation
- clears all storage
- merges prototypes
- modifies root index.html without instruction

Stop and correct immediately.

Consistency > cleverness.
