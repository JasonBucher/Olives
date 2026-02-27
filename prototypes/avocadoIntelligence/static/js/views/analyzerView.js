// Run Analyzer — telemetry visualization and export.
//
// Pure functions (parseTelemetryText, normalizeEvents, computeRunAnalysis)
// are exported for testing. The view controller (initAnalyzerView) wires
// the DOM and renders charts/timeline.

import SessionLog from "../sessionLog.js";

// ---------------------------------------------------------------------------
// Pure analysis functions (no DOM)
// ---------------------------------------------------------------------------

/**
 * Parse NDJSON, JSON array, or JSON-object-with-events telemetry text.
 * Returns { events: object[], invalidLines: number, format: string }.
 */
export function parseTelemetryText(text) {
  if (!text || !text.trim()) return { events: [], invalidLines: 0, format: "empty" };

  const trimmed = text.trim();

  // Try JSON array or object first
  if (trimmed[0] === "[" || trimmed[0] === "{") {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return { events: parsed, invalidLines: 0, format: "json_array" };
      }
      if (parsed.events && Array.isArray(parsed.events)) {
        return { events: parsed.events, invalidLines: 0, format: "json_object" };
      }
      if (parsed.logs && Array.isArray(parsed.logs)) {
        return { events: parsed.logs, invalidLines: 0, format: "json_object" };
      }
      // Single object — wrap
      return { events: [parsed], invalidLines: 0, format: "json_object" };
    } catch { /* fall through to NDJSON */ }
  }

  // NDJSON: one JSON per line
  const lines = trimmed.split("\n");
  const events = [];
  let invalidLines = 0;
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    try {
      events.push(JSON.parse(l));
    } catch {
      invalidLines++;
    }
  }
  return { events, invalidLines, format: "ndjson" };
}

/**
 * Normalize raw events to a consistent schema:
 *   { ms, t, type, payload, sessionId, simMs? }
 * Sorts by ms. Drops events without a valid timestamp.
 */
export function normalizeEvents(rawEvents) {
  const out = [];
  for (const ev of rawEvents) {
    const ms = ev.ms ?? (ev.t ? new Date(ev.t).getTime() : null);
    if (!ms || !isFinite(ms)) continue;

    out.push({
      ms,
      t: ev.t || new Date(ms).toISOString(),
      type: ev.type || ev.eventType || ev.name || "unknown",
      payload: ev.payload || ev.data || {},
      sessionId: ev.sessionId || "",
    });
  }
  out.sort((a, b) => a.ms - b.ms);
  return out;
}

/**
 * Build analysis from normalized events.
 * Returns { metadata, summary, points, timelineRows }.
 */
export function computeRunAnalysis(events) {
  if (!events.length) {
    return {
      metadata: { sessionId: "", durationMs: 0 },
      summary: {},
      points: [],
      timelineRows: [],
      giftMarkers: [],
    };
  }

  const first = events[0];
  const last = events[events.length - 1];

  const metadata = {
    sessionId: first.sessionId || "",
    runStartMs: first.ms,
    runEndMs: last.ms,
    durationMs: last.ms - first.ms,
  };

  // Extract time-series points from state_snapshot events
  const points = [];
  for (const ev of events) {
    if (ev.type !== "state_snapshot") continue;
    const p = ev.payload;
    points.push({
      ms: ev.ms,
      tRelSec: (ev.ms - first.ms) / 1000,
      avocadoCount: p.avocadoCount ?? 0,
      aps: p.aps ?? 0,
      guacCount: p.guacCount ?? 0,
      wisdom: p.wisdom ?? 0,
      prestigeCount: p.prestigeCount ?? 0,
    });
  }

  // Extract gift event markers for chart overlay
  // Track spawns and match with clicks by giftId
  const giftSpawns = new Map(); // giftId → { ms, tRelSec }
  const clickedGiftIds = new Set();
  for (const ev of events) {
    if (ev.type === "gift_spawn" && ev.payload.giftId) {
      giftSpawns.set(ev.payload.giftId, {
        ms: ev.ms,
        tRelSec: (ev.ms - first.ms) / 1000,
      });
    }
    if (ev.type === "gift" && ev.payload.giftId) {
      clickedGiftIds.add(ev.payload.giftId);
    }
  }
  const giftMarkers = [];
  for (const [giftId, spawn] of giftSpawns) {
    const clicked = clickedGiftIds.has(giftId);
    // Find the click event for effect details
    const clickEv = clicked ? events.find(e => e.type === "gift" && e.payload.giftId === giftId) : null;
    giftMarkers.push({
      ms: spawn.ms,
      tRelSec: spawn.tRelSec,
      giftId,
      clicked,
      effectId: clickEv?.payload.effectId || "",
      text: clickEv?.payload.text || "",
      negative: !!(clickEv?.payload.negative),
    });
  }

  // Build timeline rows for key events
  const timelineRows = [];
  for (const ev of events) {
    const isKey = [
      "purchase", "prestige", "distill", "state_snapshot", "gift", "gift_spawn", "gift_miss",
    ].includes(ev.type);

    let details = "";
    if (ev.type === "purchase") {
      details = `${ev.payload.title || ev.payload.id} (${ev.payload.kind || ""})`;
    } else if (ev.type === "prestige") {
      details = `+${ev.payload.wisdomGain || 0} wisdom`;
    } else if (ev.type === "distill") {
      details = `v${ev.payload.modelVersion || "?"}`;
    } else if (ev.type === "state_snapshot") {
      details = ev.payload.reason || "";
    } else if (ev.type === "gift") {
      details = `🎁 ✓ ${ev.payload.text || ev.payload.effectId || ""}`;
    } else if (ev.type === "gift_spawn") {
      details = `🎁 spawned (#${ev.payload.giftId || "?"})`;
    } else if (ev.type === "gift_miss") {
      details = `🎁 missed (#${ev.payload.giftId || "?"})`;
    }

    timelineRows.push({
      ms: ev.ms,
      tRelSec: (ev.ms - first.ms) / 1000,
      tIso: ev.t,
      type: ev.type,
      details,
      isKey,
    });
  }

  // Summary from last snapshot
  const lastSnap = points[points.length - 1];
  const summary = lastSnap
    ? {
        finalAvocados: lastSnap.avocadoCount,
        finalGuac: lastSnap.guacCount,
        finalWisdom: lastSnap.wisdom,
        prestigeCount: lastSnap.prestigeCount,
        totalEvents: events.length,
        totalSnapshots: points.length,
      }
    : { totalEvents: events.length, totalSnapshots: 0 };

  return { metadata, summary, points, timelineRows, giftMarkers };
}

// ---------------------------------------------------------------------------
// Chart series config
// ---------------------------------------------------------------------------

const SERIES = [
  { key: "avocadoCount", label: "Avocados", color: "#7dbf47", decimals: 0 },
  { key: "aps",          label: "APS",      color: "#3b82f6", decimals: 1 },
  { key: "guacCount",    label: "Guac",     color: "#f59e0b", decimals: 2 },
  { key: "wisdom",       label: "Wisdom",   color: "#a855f7", decimals: 0 },
  { key: "prestigeCount",label: "Prestige", color: "#ef4444", decimals: 0 },
];

// ---------------------------------------------------------------------------
// View controller (DOM)
// ---------------------------------------------------------------------------

/**
 * Initialize the analyzer view.
 *
 * @param {Object} opts
 * @param {Function} opts.onBack — called when user clicks "Back to Game"
 * @param {Function} opts.captureSnapshot — called to record a manual snapshot
 */
export function initAnalyzerView({ onBack, captureSnapshot }) {
  // --- DOM refs ---
  const backBtn = document.getElementById("analyzer-back-btn");
  const fileInput = document.getElementById("analyzer-file-input");
  const uploadBtn = document.getElementById("analyzer-upload-btn");
  const sourceRadios = document.querySelectorAll('input[name="analyzer-source"]');
  const snapshotBtn = document.getElementById("analyzer-snapshot-btn");
  const downloadJsonBtn = document.getElementById("analyzer-download-json-btn");
  const downloadCsvBtn = document.getElementById("analyzer-download-csv-btn");
  const statusEl = document.getElementById("analyzer-status");

  const metaSessionIdEl = document.getElementById("analyzer-meta-session-id");
  const metaStartEl = document.getElementById("analyzer-meta-start");
  const metaEndEl = document.getElementById("analyzer-meta-end");
  const metaDurationEl = document.getElementById("analyzer-meta-duration");
  const summaryAvocadosEl = document.getElementById("analyzer-summary-avocados");
  const summaryGuacEl = document.getElementById("analyzer-summary-guac");
  const summaryWisdomEl = document.getElementById("analyzer-summary-wisdom");
  const summaryPrestigeEl = document.getElementById("analyzer-summary-prestige");
  const summaryEventsEl = document.getElementById("analyzer-summary-events");

  const chartSvg = document.getElementById("analyzer-chart-svg");
  const chartEmpty = document.getElementById("analyzer-chart-empty");
  const seriesControls = document.getElementById("analyzer-series-controls");

  const timelineFilter = document.getElementById("analyzer-timeline-filter");
  const timelineBody = document.getElementById("analyzer-timeline-body");
  const clearLogBtn = document.getElementById("analyzer-clear-log-btn");

  // --- State ---
  let currentAnalysis = null;
  let fileEvents = null;
  const enabledSeries = new Set(["avocadoCount", "aps"]);

  // --- Source selection ---
  function getSource() {
    for (const r of sourceRadios) {
      if (r.checked) return r.value;
    }
    return "live";
  }

  // --- Load live data ---
  function loadLive() {
    const text = SessionLog.getText();
    const { events, invalidLines, format } = parseTelemetryText(text);
    const normalized = normalizeEvents(events);
    currentAnalysis = computeRunAnalysis(normalized);

    const stats = SessionLog.getStats();
    statusEl.textContent = `Live: ${stats.lineCount} events, ${(stats.approxBytes / 1024).toFixed(1)} KB`;
    downloadJsonBtn.disabled = normalized.length === 0;
    downloadCsvBtn.disabled = currentAnalysis.points.length === 0;
    render();
  }

  // --- Load file data ---
  function loadFile(text) {
    const { events, invalidLines } = parseTelemetryText(text);
    const normalized = normalizeEvents(events);
    fileEvents = normalized;
    currentAnalysis = computeRunAnalysis(normalized);

    statusEl.textContent = `File: ${normalized.length} events${invalidLines ? ` (${invalidLines} invalid lines)` : ""}`;
    // Enable file radio
    const fileRadio = document.querySelector('input[name="analyzer-source"][value="file"]');
    if (fileRadio) {
      fileRadio.disabled = false;
      fileRadio.checked = true;
    }
    downloadJsonBtn.disabled = normalized.length === 0;
    downloadCsvBtn.disabled = currentAnalysis.points.length === 0;
    render();
  }

  // --- Render all ---
  function render() {
    if (!currentAnalysis) return;
    renderMetadata();
    renderSummary();
    renderChart();
    renderTimeline();
  }

  // --- Metadata ---
  function renderMetadata() {
    const m = currentAnalysis.metadata;
    metaSessionIdEl.textContent = m.sessionId || "-";
    metaStartEl.textContent = m.runStartMs ? new Date(m.runStartMs).toLocaleString() : "-";
    metaEndEl.textContent = m.runEndMs ? new Date(m.runEndMs).toLocaleString() : "-";
    metaDurationEl.textContent = formatDuration(m.durationMs || 0);
  }

  // --- Summary ---
  function renderSummary() {
    const s = currentAnalysis.summary;
    summaryAvocadosEl.textContent = fmtNum(s.finalAvocados);
    summaryGuacEl.textContent = fmtNum(s.finalGuac);
    summaryWisdomEl.textContent = s.finalWisdom ?? "-";
    summaryPrestigeEl.textContent = s.prestigeCount ?? "-";
    summaryEventsEl.textContent = s.totalEvents ?? 0;
  }

  // --- Chart ---
  function renderChart() {
    const pts = currentAnalysis.points;
    if (!pts.length) {
      chartSvg.innerHTML = "";
      chartEmpty.style.display = "";
      return;
    }
    chartEmpty.style.display = "none";

    const W = 900, H = 280, PAD = 40;
    const plotW = W - PAD * 2, plotH = H - PAD * 2;
    const t0 = pts[0].tRelSec, t1 = pts[pts.length - 1].tRelSec;
    const tSpan = t1 - t0 || 1;

    // Compute max Y across enabled series
    let maxY = 0;
    for (const pt of pts) {
      for (const s of SERIES) {
        if (enabledSeries.has(s.key)) {
          maxY = Math.max(maxY, pt[s.key] || 0);
        }
      }
    }
    if (maxY === 0) maxY = 1;

    // Build SVG paths
    let paths = "";
    for (const s of SERIES) {
      if (!enabledSeries.has(s.key)) continue;
      let d = "";
      for (let i = 0; i < pts.length; i++) {
        const x = PAD + ((pts[i].tRelSec - t0) / tSpan) * plotW;
        const y = H - PAD - ((pts[i][s.key] || 0) / maxY) * plotH;
        d += i === 0 ? `M${x},${y}` : `L${x},${y}`;
      }
      paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" />`;
    }

    // Axis labels
    let labels = "";
    // Y-axis: 0 and max
    labels += `<text x="${PAD - 4}" y="${H - PAD + 4}" text-anchor="end" fill="${CSS_MUTED}" font-size="10">0</text>`;
    labels += `<text x="${PAD - 4}" y="${PAD + 4}" text-anchor="end" fill="${CSS_MUTED}" font-size="10">${fmtCompact(maxY)}</text>`;
    // X-axis: start and end
    labels += `<text x="${PAD}" y="${H - PAD + 16}" text-anchor="start" fill="${CSS_MUTED}" font-size="10">${formatElapsed(t0)}</text>`;
    labels += `<text x="${W - PAD}" y="${H - PAD + 16}" text-anchor="end" fill="${CSS_MUTED}" font-size="10">${formatElapsed(t1)}</text>`;

    // Grid lines
    let grid = "";
    grid += `<line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${H - PAD}" stroke="rgba(255,255,255,0.08)" />`;
    grid += `<line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="rgba(255,255,255,0.08)" />`;
    // Horizontal midline
    const midY = PAD + plotH / 2;
    grid += `<line x1="${PAD}" y1="${midY}" x2="${W - PAD}" y2="${midY}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="4,4" />`;
    labels += `<text x="${PAD - 4}" y="${midY + 4}" text-anchor="end" fill="${CSS_MUTED}" font-size="10">${fmtCompact(maxY / 2)}</text>`;

    // Gift event vertical lines
    let giftLines = "";
    const markers = currentAnalysis.giftMarkers || [];
    for (const m of markers) {
      const x = PAD + ((m.tRelSec - t0) / tSpan) * plotW;
      const color = m.clicked ? (m.negative ? "#e06c75" : "#e8a438") : "#555";
      const opacity = m.clicked ? "0.6" : "0.3";
      giftLines += `<line x1="${x}" y1="${PAD}" x2="${x}" y2="${H - PAD}" stroke="${color}" stroke-width="1" stroke-dasharray="4,2" opacity="${opacity}" />`;
      giftLines += `<text x="${x}" y="${PAD - 4}" text-anchor="middle" fill="${color}" font-size="10">🎁</text>`;
      if (m.clicked) {
        giftLines += `<text x="${x}" y="${PAD - 14}" text-anchor="middle" fill="#7ec87e" font-size="10">✓</text>`;
      }
    }

    chartSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    chartSvg.innerHTML = `${grid}${giftLines}${paths}${labels}`;
  }

  // --- Series controls ---
  function buildSeriesControls() {
    seriesControls.innerHTML = "";
    for (const s of SERIES) {
      const label = document.createElement("label");
      label.className = "analyzer-series-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = enabledSeries.has(s.key);
      cb.addEventListener("change", () => {
        if (cb.checked) enabledSeries.add(s.key);
        else enabledSeries.delete(s.key);
        renderChart();
      });
      const swatch = document.createElement("span");
      swatch.className = "analyzer-series-swatch";
      swatch.style.background = s.color;
      label.appendChild(cb);
      label.appendChild(swatch);
      label.appendChild(document.createTextNode(` ${s.label}`));
      seriesControls.appendChild(label);
    }
  }

  // --- Timeline ---
  function renderTimeline() {
    if (!currentAnalysis) return;
    const filter = timelineFilter.value;
    const rows = currentAnalysis.timelineRows;
    timelineBody.innerHTML = "";

    for (const row of rows) {
      if (filter === "key" && !row.isKey) continue;
      if (filter === "purchases" && row.type !== "purchase") continue;
      if (filter === "gifts" && !["gift", "gift_spawn", "gift_miss"].includes(row.type)) continue;
      if (filter === "progression" && !["state_snapshot", "prestige", "distill"].includes(row.type)) continue;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatElapsed(row.tRelSec)}</td>
        <td>${row.type}</td>
        <td>${escHtml(row.details)}</td>
      `;
      timelineBody.appendChild(tr);
    }
  }

  // --- Downloads ---
  function downloadJson() {
    if (!currentAnalysis) return;
    const data = {
      metadata: currentAnalysis.metadata,
      summary: currentAnalysis.summary,
      events: currentAnalysis.timelineRows,
    };
    downloadTextFile("avocado-analysis.json", JSON.stringify(data, null, 2), "application/json");
  }

  function downloadCsv() {
    if (!currentAnalysis || !currentAnalysis.points.length) return;
    const headers = ["tRelSec", "ms", "avocadoCount", "aps", "guacCount", "wisdom", "prestigeCount"];
    const rows = currentAnalysis.points.map(p => headers.map(h => p[h] ?? ""));
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    downloadTextFile("avocado-timeseries.csv", csv, "text/csv");
  }

  // --- Events ---
  if (backBtn) backBtn.addEventListener("click", () => onBack());

  if (uploadBtn) uploadBtn.addEventListener("click", () => {
    const file = fileInput?.files?.[0];
    if (!file) { statusEl.textContent = "No file selected."; return; }
    const reader = new FileReader();
    reader.onload = () => loadFile(reader.result);
    reader.readAsText(file);
  });

  for (const r of sourceRadios) {
    r.addEventListener("change", () => {
      if (getSource() === "live") loadLive();
      else if (fileEvents) {
        currentAnalysis = computeRunAnalysis(fileEvents);
        render();
      }
    });
  }

  if (snapshotBtn) snapshotBtn.addEventListener("click", () => {
    if (captureSnapshot) captureSnapshot("analyzer");
    // Small delay to let the record persist, then reload
    setTimeout(() => { if (getSource() === "live") loadLive(); }, 100);
  });

  if (downloadJsonBtn) downloadJsonBtn.addEventListener("click", downloadJson);
  if (downloadCsvBtn) downloadCsvBtn.addEventListener("click", downloadCsv);
  if (timelineFilter) timelineFilter.addEventListener("change", renderTimeline);

  if (clearLogBtn) clearLogBtn.addEventListener("click", () => {
    if (!confirm("Clear the session log? This cannot be undone.")) return;
    SessionLog.clear();
    loadLive();
  });

  buildSeriesControls();

  // --- Public API ---
  return {
    /** Called when analyzer screen becomes visible. */
    notifyVisible() {
      if (getSource() === "live") loadLive();
      else render();
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CSS_MUTED = "#8fa896";

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function formatElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtNum(v) {
  if (v == null) return "-";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function fmtCompact(v) {
  if (v >= 1e21) return (v / 1e21).toFixed(1) + "Sx";
  if (v >= 1e18) return (v / 1e18).toFixed(1) + "Qi";
  if (v >= 1e15) return (v / 1e15).toFixed(1) + "Qa";
  if (v >= 1e12) return (v / 1e12).toFixed(1) + "T";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(0);
}

function escHtml(s) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function downloadTextFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
