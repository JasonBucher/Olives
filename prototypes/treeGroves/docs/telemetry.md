# Session Telemetry (NDJSON)

This prototype now records a silent session telemetry log for balancing and progression analysis.

## What the file contains

Each line is one JSON object (NDJSON format):

- `t`: ISO timestamp
- `ms`: epoch milliseconds
- `sessionId`: current session identifier
- `type`: event type (for example `action_start`, `action_complete`, `purchase_investment`, `hire_worker`, `roll_result`)
- `payload`: game-only event details (resources, outcomes, costs, quantities, etc.)

No personal input fields, email addresses, or IP addresses are logged.

## How to download it

1. Reach **Era 2** (City screen).
2. Open the **Session Log** panel.
3. Click **Download Session Log (.ndjson)**.

The file name includes the session ID and timestamp to make sharing/debugging easier.

## Local storage key

Session log data is stored at:

- `tg_session_log_v1`
