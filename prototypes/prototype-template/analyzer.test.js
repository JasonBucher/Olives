import { describe, it, expect } from "vitest";
import {
  parseTelemetryText,
  normalizeEvents,
  computeRunAnalysis,
} from "./static/js/views/analyzerView.js";

// ---------------------------------------------------------------------------
// parseTelemetryText
// ---------------------------------------------------------------------------
describe("parseTelemetryText", () => {
  it("returns empty for blank input", () => {
    const r = parseTelemetryText("");
    expect(r.events).toHaveLength(0);
    expect(r.format).toBe("empty");
  });

  it("parses a JSON array", () => {
    const text = JSON.stringify([
      { ms: 1000, type: "a", payload: {} },
      { ms: 2000, type: "b", payload: {} },
    ]);
    const r = parseTelemetryText(text);
    expect(r.format).toBe("json_array");
    expect(r.events).toHaveLength(2);
    expect(r.invalidLines).toBe(0);
  });

  it("parses a JSON object with events array", () => {
    const text = JSON.stringify({
      events: [
        { ms: 100, type: "x", payload: {} },
      ],
    });
    const r = parseTelemetryText(text);
    expect(r.format).toBe("json_object");
    expect(r.events).toHaveLength(1);
  });

  it("parses a JSON object with logs array", () => {
    const text = JSON.stringify({
      logs: [
        { ms: 100, type: "x", payload: {} },
      ],
    });
    const r = parseTelemetryText(text);
    expect(r.format).toBe("json_object");
    expect(r.events).toHaveLength(1);
  });

  it("wraps a single JSON object", () => {
    const text = JSON.stringify({ ms: 500, type: "solo", payload: {} });
    const r = parseTelemetryText(text);
    expect(r.format).toBe("json_object");
    expect(r.events).toHaveLength(1);
  });

  it("parses NDJSON lines", () => {
    const lines = [
      JSON.stringify({ ms: 1000, type: "a", payload: {} }),
      JSON.stringify({ ms: 2000, type: "b", payload: {} }),
      JSON.stringify({ ms: 3000, type: "c", payload: {} }),
    ];
    const r = parseTelemetryText(lines.join("\n"));
    expect(r.format).toBe("ndjson");
    expect(r.events).toHaveLength(3);
    expect(r.invalidLines).toBe(0);
  });

  it("counts invalid NDJSON lines", () => {
    const text = `${JSON.stringify({ ms: 1000, type: "a" })}\nBAD LINE\n${JSON.stringify({ ms: 2000, type: "b" })}`;
    const r = parseTelemetryText(text);
    expect(r.events).toHaveLength(2);
    expect(r.invalidLines).toBe(1);
  });

  it("skips empty lines in NDJSON", () => {
    const text = `${JSON.stringify({ ms: 1000, type: "a" })}\n\n\n${JSON.stringify({ ms: 2000, type: "b" })}`;
    const r = parseTelemetryText(text);
    expect(r.events).toHaveLength(2);
    expect(r.invalidLines).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeEvents
// ---------------------------------------------------------------------------
describe("normalizeEvents", () => {
  it("extracts ms from event.ms", () => {
    const result = normalizeEvents([{ ms: 5000, type: "test", payload: { x: 1 } }]);
    expect(result).toHaveLength(1);
    expect(result[0].ms).toBe(5000);
    expect(result[0].type).toBe("test");
  });

  it("falls back to parsing event.t as ISO date", () => {
    const t = "2026-01-15T10:30:00.000Z";
    const result = normalizeEvents([{ t, type: "test", payload: {} }]);
    expect(result).toHaveLength(1);
    expect(result[0].ms).toBe(new Date(t).getTime());
  });

  it("drops events without a valid timestamp", () => {
    const result = normalizeEvents([
      { type: "no_ts", payload: {} },
      { ms: NaN, type: "bad_ts", payload: {} },
      { ms: 100, type: "good", payload: {} },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("good");
  });

  it("sorts events by ms", () => {
    const result = normalizeEvents([
      { ms: 3000, type: "c" },
      { ms: 1000, type: "a" },
      { ms: 2000, type: "b" },
    ]);
    expect(result.map(e => e.type)).toEqual(["a", "b", "c"]);
  });

  it("handles eventType and name as type fallbacks", () => {
    const result = normalizeEvents([
      { ms: 100, eventType: "via_eventType" },
      { ms: 200, name: "via_name" },
    ]);
    expect(result[0].type).toBe("via_eventType");
    expect(result[1].type).toBe("via_name");
  });

  it("uses data as payload fallback", () => {
    const result = normalizeEvents([
      { ms: 100, type: "test", data: { val: 42 } },
    ]);
    expect(result[0].payload).toEqual({ val: 42 });
  });
});

// ---------------------------------------------------------------------------
// computeRunAnalysis
// ---------------------------------------------------------------------------
describe("computeRunAnalysis", () => {
  it("returns empty analysis for no events", () => {
    const r = computeRunAnalysis([]);
    expect(r.points).toHaveLength(0);
    expect(r.timelineRows).toHaveLength(0);
    expect(r.metadata.durationMs).toBe(0);
  });

  it("extracts points from state_snapshot events with spread payload", () => {
    const events = normalizeEvents([
      { ms: 1000, type: "state_snapshot", payload: { oliveCount: 10, ops: 1, reason: "tick" } },
      { ms: 2000, type: "purchase", payload: { kind: "upgrade", id: "sharper_pick", title: "Sharper Pick" } },
      { ms: 3000, type: "state_snapshot", payload: { oliveCount: 50, ops: 5, reason: "tick" } },
    ]);
    const r = computeRunAnalysis(events);
    expect(r.points).toHaveLength(2);
    expect(r.points[0].oliveCount).toBe(10);
    expect(r.points[1].oliveCount).toBe(50);
    expect(r.points[1].ops).toBe(5);
  });

  it("computes metadata from first and last events", () => {
    const events = normalizeEvents([
      { ms: 1000, type: "state_snapshot", payload: { oliveCount: 0 }, sessionId: "sess-123" },
      { ms: 6000, type: "state_snapshot", payload: { oliveCount: 100 }, sessionId: "sess-123" },
    ]);
    const r = computeRunAnalysis(events);
    expect(r.metadata.sessionId).toBe("sess-123");
    expect(r.metadata.durationMs).toBe(5000);
    expect(r.metadata.runStartMs).toBe(1000);
    expect(r.metadata.runEndMs).toBe(6000);
  });

  it("builds timeline rows and marks key events", () => {
    const events = normalizeEvents([
      { ms: 1000, type: "state_snapshot", payload: { reason: "init" } },
      { ms: 2000, type: "purchase", payload: { kind: "upgrade", id: "sharper_pick", title: "Sharper Pick" } },
      { ms: 3000, type: "prestige", payload: { wisdomGain: 5 } },
    ]);
    const r = computeRunAnalysis(events);
    expect(r.timelineRows).toHaveLength(3);
    expect(r.timelineRows[0].isKey).toBe(true);
    expect(r.timelineRows[1].isKey).toBe(true);
    expect(r.timelineRows[2].isKey).toBe(true);
    expect(r.timelineRows[2].details).toContain("5");
  });

  it("computes summary from last snapshot dynamically", () => {
    const events = normalizeEvents([
      { ms: 1000, type: "state_snapshot", payload: { oliveCount: 10, ops: 0.5 } },
      { ms: 5000, type: "state_snapshot", payload: { oliveCount: 999, ops: 42.3 } },
    ]);
    const r = computeRunAnalysis(events);
    expect(r.summary.oliveCount).toBe(999);
    expect(r.summary.ops).toBe(42.3);
    expect(r.summary.totalSnapshots).toBe(2);
    expect(r.summary.totalEvents).toBe(2);
  });

  it("computes tRelSec relative to first event", () => {
    const events = normalizeEvents([
      { ms: 10000, type: "state_snapshot", payload: { oliveCount: 0 } },
      { ms: 15000, type: "state_snapshot", payload: { oliveCount: 100 } },
    ]);
    const r = computeRunAnalysis(events);
    expect(r.points[0].tRelSec).toBe(0);
    expect(r.points[1].tRelSec).toBe(5);
  });

  it("marks non-key event types as isKey=false", () => {
    const events = normalizeEvents([
      { ms: 1000, type: "session_start", payload: {} },
      { ms: 2000, type: "log_line", payload: {} },
    ]);
    const r = computeRunAnalysis(events);
    expect(r.timelineRows[0].isKey).toBe(false);
    expect(r.timelineRows[1].isKey).toBe(false);
  });

  it("handles distill events in timeline", () => {
    const events = normalizeEvents([
      { ms: 1000, type: "distill", payload: { modelVersion: 2 } },
    ]);
    const r = computeRunAnalysis(events);
    expect(r.timelineRows[0].type).toBe("distill");
    expect(r.timelineRows[0].details).toContain("2");
    expect(r.timelineRows[0].isKey).toBe(true);
  });

  it("excludes ms, tRelSec, and reason from summary", () => {
    const events = normalizeEvents([
      { ms: 1000, type: "state_snapshot", payload: { oliveCount: 50, reason: "tick" } },
    ]);
    const r = computeRunAnalysis(events);
    expect(r.summary.oliveCount).toBe(50);
    expect(r.summary).not.toHaveProperty("reason");
    expect(r.summary).not.toHaveProperty("ms");
    expect(r.summary).not.toHaveProperty("tRelSec");
  });
});

// ---------------------------------------------------------------------------
// End-to-end: parse -> normalize -> analyze
// ---------------------------------------------------------------------------
describe("end-to-end analysis pipeline", () => {
  it("processes NDJSON through the full pipeline", () => {
    const lines = [
      JSON.stringify({ t: "2026-01-15T10:00:00Z", ms: 1000, sessionId: "s1", type: "session_start", payload: { version: "test" } }),
      JSON.stringify({ t: "2026-01-15T10:00:01Z", ms: 2000, sessionId: "s1", type: "state_snapshot", payload: { oliveCount: 0, ops: 0, reason: "init" } }),
      JSON.stringify({ t: "2026-01-15T10:00:05Z", ms: 6000, sessionId: "s1", type: "purchase", payload: { kind: "upgrade", id: "sharper_pick", title: "Sharper Pick", cost: 10 } }),
      JSON.stringify({ t: "2026-01-15T10:00:06Z", ms: 7000, sessionId: "s1", type: "state_snapshot", payload: { oliveCount: 50, ops: 0.2, reason: "tick" } }),
    ];

    const { events } = parseTelemetryText(lines.join("\n"));
    const normalized = normalizeEvents(events);
    const analysis = computeRunAnalysis(normalized);

    expect(analysis.metadata.sessionId).toBe("s1");
    expect(analysis.metadata.durationMs).toBe(6000);
    expect(analysis.points).toHaveLength(2);
    expect(analysis.points[1].oliveCount).toBe(50);
    expect(analysis.points[1].ops).toBe(0.2);
    expect(analysis.summary.oliveCount).toBe(50);
    expect(analysis.timelineRows).toHaveLength(4);
  });
});
