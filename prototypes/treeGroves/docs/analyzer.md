# Run Analyzer

The Run Analyzer is a client-side tool for inspecting telemetry logs from TreeGroves runs.

## Open It

1. Load the game.
2. Click **Analyzer** (next to the Debug button in the header).

## Upload Formats

The analyzer accepts:

- NDJSON (one JSON event per line)
- JSON array (`[{...}, {...}]`)
- JSON object with `events` array (`{ "events": [...] }`)

No data is uploaded. Parsing and charting happen locally in your browser.

## What It Shows

- Run metadata (session ID, start/end, duration, version/build when present)
- Summary metrics (final known florins/stone, investments, workers, actions)
- Time-series chart with metric toggles
- Timeline table for key events (with filters)

## Exports

- **Download Normalized Events (JSON)**
- **Download Time Series (CSV)**
