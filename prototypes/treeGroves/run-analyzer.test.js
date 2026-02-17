import { describe, it, expect } from "vitest";
import {
  parseTelemetryText,
  normalizeTelemetryEvents,
  computeRunAnalysis,
} from "./static/js/views/analyzerView.js";

describe("Run Analyzer parsing", () => {
  it("parses NDJSON lines", () => {
    const rawText = [
      '{"t":"2026-02-17T00:00:00.000Z","ms":1000,"sessionId":"s1","type":"session_start","payload":{"version":"v1","build":"b1"}}',
      '{"t":"2026-02-17T00:00:01.000Z","ms":2000,"sessionId":"s1","type":"currency_delta","payload":{"currency":"florins","delta":10}}',
    ].join("\n");

    const parsed = parseTelemetryText(rawText);
    const normalized = normalizeTelemetryEvents(parsed.rawEvents);
    const analysis = computeRunAnalysis(normalized.events);

    expect(parsed.format).toBe("ndjson");
    expect(normalized.events.length).toBe(2);
    expect(analysis.metadata.sessionId).toBe("s1");
    expect(analysis.summary.finalFlorins).toBe(10);
  });

  it("parses JSON array", () => {
    const rawText = JSON.stringify([
      { ms: 1000, type: "session_start", payload: {} },
      { ms: 2500, type: "resource_delta", payload: { resource: "stone", delta: 4 } },
    ]);

    const parsed = parseTelemetryText(rawText);
    const normalized = normalizeTelemetryEvents(parsed.rawEvents);
    const analysis = computeRunAnalysis(normalized.events);

    expect(parsed.format).toBe("json-array");
    expect(analysis.summary.finalStone).toBe(4);
  });

  it("parses JSON object with events array", () => {
    const rawText = JSON.stringify({
      events: [
        { ms: 1000, type: "session_start", payload: { version: "treeGroves" } },
        { ms: 2000, type: "purchase_investment", payload: { id: "harvest_baskets" } },
      ],
    });

    const parsed = parseTelemetryText(rawText);
    const normalized = normalizeTelemetryEvents(parsed.rawEvents);
    const analysis = computeRunAnalysis(normalized.events);

    expect(parsed.format).toBe("json-object");
    expect(analysis.summary.investmentsPurchasedCount).toBe(1);
    expect(analysis.points.length).toBe(2);
  });

  it("treats analyzer markers as key timeline events", () => {
    const rawText = JSON.stringify([
      { ms: 1000, type: "session_start", payload: { version: "treeGroves" } },
      { ms: 2000, type: "analyzer_marker", payload: { label: "Checkpoint A" } },
    ]);

    const parsed = parseTelemetryText(rawText);
    const normalized = normalizeTelemetryEvents(parsed.rawEvents);
    const analysis = computeRunAnalysis(normalized.events);

    const markerRow = analysis.timelineRows.find((row) => row.type === "analyzer_marker");
    expect(markerRow).toBeTruthy();
    expect(markerRow.isKeyEvent).toBe(true);
    expect(markerRow.details).toContain("Checkpoint A");
  });
});
