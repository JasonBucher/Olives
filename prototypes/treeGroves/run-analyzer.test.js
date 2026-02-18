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

  it("accumulates schema deltas into non-flat balances with frequent points", () => {
    const rawText = [
      '{"t":"2026-02-17T17:10:54.200Z","ms":1771348254200,"sessionId":"s1","type":"session_start","payload":{"version":"treeGroves"}}',
      '{"t":"2026-02-17T17:11:16.893Z","ms":1771348276893,"sessionId":"s1","type":"resource_delta","payload":{"resource":"harvested_olives","delta":10,"reason":"harvest_complete","outcome":"normal"}}',
      '{"t":"2026-02-17T17:11:19.546Z","ms":1771348279546,"sessionId":"s1","type":"resource_delta","payload":{"resource":"harvested_olives","delta":-3,"reason":"press_start"}}',
      '{"t":"2026-02-17T17:11:22.693Z","ms":1771348282693,"sessionId":"s1","type":"resource_delta","payload":{"resource":"olive_oil","delta":1,"reason":"press_complete"}}',
      '{"t":"2026-02-17T17:11:32.493Z","ms":1771348292493,"sessionId":"s1","type":"resource_delta","payload":{"resource":"stone","delta":4,"reason":"quarry_complete"}}',
      '{"t":"2026-02-17T17:11:37.963Z","ms":1771348297963,"sessionId":"s1","type":"resource_delta","payload":{"resource":"olive_oil","delta":-5,"reason":"ship_olive_oil_start"}}',
      '{"t":"2026-02-17T17:11:50.005Z","ms":1771348310005,"sessionId":"s1","type":"hire_worker","payload":{"workerType":"cultivator","count":1,"cost":8}}',
      '{"t":"2026-02-17T17:11:50.005Z","ms":1771348310005,"sessionId":"s1","type":"currency_delta","payload":{"currency":"florins","delta":-8,"reason":"hire_worker","workerType":"cultivator"}}',
      '{"t":"2026-02-17T17:12:25.219Z","ms":1771348345219,"sessionId":"s1","type":"purchase_investment","payload":{"id":"harvest_baskets","title":"Harvest Baskets","group":"upgrade","florinsSpent":20,"stoneSpent":3}}',
      '{"t":"2026-02-17T17:22:41.126Z","ms":1771348961126,"sessionId":"s1","type":"currency_delta","payload":{"currency":"florins","delta":90,"reason":"premium_buyer"}}',
    ].join("\n");

    const parsed = parseTelemetryText(rawText);
    const normalized = normalizeTelemetryEvents(parsed.rawEvents);
    const analysis = computeRunAnalysis(normalized.events);

    expect(analysis.summary.finalFlorins).toBe(82);
    expect(analysis.summary.finalStone).toBe(4);
    expect(analysis.summary.finalOlives).toBe(7);
    expect(analysis.summary.finalOliveOil).toBe(-4);
    expect(analysis.summary.investmentsPurchasedCount).toBe(1);
    expect(analysis.summary.workersTotal).toBe(1);
    expect(analysis.points.length).toBeGreaterThan(5);

    const first = analysis.points[0];
    const last = analysis.points[analysis.points.length - 1];
    expect(first.florins).not.toBe(last.florins);
    expect(first.olives).not.toBe(last.olives);
    expect(first.oliveOil).not.toBe(last.oliveOil);
  });

  it("tracks market olives and market olive oil balances from resource deltas", () => {
    const rawText = [
      '{"ms":1000,"type":"session_start","payload":{"version":"treeGroves"}}',
      '{"ms":2000,"type":"resource_delta","payload":{"resource":"market_olives","delta":12,"reason":"ship_olives_complete"}}',
      '{"ms":3000,"type":"resource_delta","payload":{"resource":"market_olive_oil","delta":5,"reason":"ship_olive_oil_complete"}}',
      '{"ms":4000,"type":"resource_delta","payload":{"resource":"market_olives","delta":-3,"reason":"market_sale"}}',
      '{"ms":5000,"type":"resource_delta","payload":{"resource":"market_olive_oil","delta":-2,"reason":"market_sale"}}',
    ].join("\n");

    const parsed = parseTelemetryText(rawText);
    const normalized = normalizeTelemetryEvents(parsed.rawEvents);
    const analysis = computeRunAnalysis(normalized.events);

    expect(analysis.summary.finalMarketOlives).toBe(9);
    expect(analysis.summary.finalMarketOliveOil).toBe(3);
    expect(analysis.availableMetrics.marketOlives).toBe(true);
    expect(analysis.availableMetrics.marketOliveOil).toBe(true);

    const last = analysis.points[analysis.points.length - 1];
    expect(last.marketOlives).toBe(9);
    expect(last.marketOliveOil).toBe(3);
  });

  it("uses simMs for relative chart timing when available", () => {
    const rawText = [
      '{"ms":1000,"simMs":0,"type":"session_start","payload":{"version":"treeGroves"}}',
      '{"ms":2000,"simMs":1000,"type":"currency_delta","payload":{"currency":"florins","delta":5}}',
      '{"ms":28802000,"simMs":2000,"type":"currency_delta","payload":{"currency":"florins","delta":5}}',
    ].join("\n");

    const parsed = parseTelemetryText(rawText);
    const normalized = normalizeTelemetryEvents(parsed.rawEvents);
    const analysis = computeRunAnalysis(normalized.events);

    const last = analysis.points[analysis.points.length - 1];
    expect(last.tRelSec).toBe(2);
    expect(analysis.metadata.durationMs).toBe(2000);
  });
});
