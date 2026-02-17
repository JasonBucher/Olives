import SessionLog from "../sessionLog.js";

const METRIC_DEFS = [
  { key: "florins", label: "Florins", color: "#3b7bff", digits: 2 },
  { key: "stone", label: "Stone", color: "#cbd5e1", digits: 0 },
  { key: "investmentsPurchasedCount", label: "Investments", color: "#f59e0b", digits: 0 },
  { key: "workersTotal", label: "Workers Total", color: "#34d399", digits: 0 },
  { key: "olives", label: "Olives", color: "#84cc16", digits: 0 },
  { key: "oliveOil", label: "Olive Oil", color: "#fb923c", digits: 2 },
];

const TIMELINE_FILTERS = {
  key: (row) => row.isKeyEvent,
  all: () => true,
  purchases: (row) => row.type === "purchase_investment" || row.type === "hire_worker" || row.type === "hire_manager",
  actions: (row) => row.type === "action_complete" || row.type === "action_interrupted" || row.type === "action_start",
  transitions: (row) => row.type === "era_transition" || (row.type === "action_complete" && row.action === "move_to_city"),
};

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseDateMs(value) {
  if (value == null) return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateTime(ms) {
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
}

function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatValue(value, digits = 0) {
  if (!Number.isFinite(value)) return "metric unavailable";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function toEventArrayFromObject(parsedObject) {
  if (Array.isArray(parsedObject?.events)) return parsedObject.events;
  if (Array.isArray(parsedObject?.logs)) return parsedObject.logs;
  return [parsedObject];
}

function parseNdjson(text) {
  const lines = text.split(/\r?\n/);
  const rawEvents = [];
  let invalidLines = 0;
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      rawEvents.push(JSON.parse(trimmed));
    } catch {
      invalidLines += 1;
    }
  });
  return { rawEvents, invalidLines, format: "ndjson" };
}

export function parseTelemetryText(text) {
  const rawText = String(text || "");
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("The uploaded file is empty.");
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) throw new Error("Expected JSON array.");
      return { rawEvents: parsed, invalidLines: 0, format: "json-array" };
    } catch {
      return parseNdjson(rawText);
    }
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return { rawEvents: toEventArrayFromObject(parsed), invalidLines: 0, format: "json-object" };
    } catch {
      return parseNdjson(rawText);
    }
  }

  return parseNdjson(rawText);
}

function findTimestampLikeField(input, depth = 0) {
  if (!isPlainObject(input) || depth > 2) return null;
  const keys = Object.keys(input);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = input[key];
    const lower = key.toLowerCase();
    if (lower.includes("timestamp") || lower === "t" || lower.endsWith("time") || lower.endsWith("at")) {
      const num = toFiniteNumber(value);
      if (num != null) return num;
      const parsedDate = parseDateMs(value);
      if (parsedDate != null) return parsedDate;
    }
  }
  for (let i = 0; i < keys.length; i++) {
    const nested = findTimestampLikeField(input[keys[i]], depth + 1);
    if (nested != null) return nested;
  }
  return null;
}

function extractEventMs(rawEvent, payload) {
  const numericCandidates = [
    rawEvent.ms,
    rawEvent.timestampMs,
    rawEvent.timeMs,
    rawEvent.ts,
    payload.ms,
    payload.timestampMs,
    payload.timeMs,
    payload.ts,
  ];
  for (let i = 0; i < numericCandidates.length; i++) {
    const n = toFiniteNumber(numericCandidates[i]);
    if (n != null) return n;
  }

  const dateCandidates = [
    rawEvent.t,
    rawEvent.tIso,
    rawEvent.timestamp,
    rawEvent.time,
    rawEvent.createdAt,
    payload.t,
    payload.tIso,
    payload.timestamp,
    payload.time,
  ];
  for (let i = 0; i < dateCandidates.length; i++) {
    const parsed = parseDateMs(dateCandidates[i]);
    if (parsed != null) return parsed;
  }

  return findTimestampLikeField(rawEvent);
}

function extractEventType(rawEvent) {
  const type = rawEvent.type ?? rawEvent.eventType ?? rawEvent.name ?? rawEvent.event ?? "unknown";
  return String(type || "unknown");
}

function extractPayload(rawEvent) {
  if (isPlainObject(rawEvent.payload)) return rawEvent.payload;
  if (isPlainObject(rawEvent.data)) return rawEvent.data;

  const payload = {};
  Object.keys(rawEvent).forEach((key) => {
    if (key === "type" || key === "eventType" || key === "name" || key === "event") return;
    if (key === "ms" || key === "t" || key === "tIso" || key === "timestamp") return;
    if (key === "sessionId") return;
    payload[key] = rawEvent[key];
  });
  return payload;
}

export function normalizeTelemetryEvents(rawEvents) {
  const normalized = [];
  let invalidEvents = 0;

  (Array.isArray(rawEvents) ? rawEvents : []).forEach((rawEvent) => {
    if (!isPlainObject(rawEvent)) {
      invalidEvents += 1;
      return;
    }

    const payload = extractPayload(rawEvent);
    const ms = extractEventMs(rawEvent, payload);
    if (!Number.isFinite(ms)) {
      invalidEvents += 1;
      return;
    }

    const tIsoCandidate = rawEvent.t ?? rawEvent.tIso ?? payload.t ?? payload.tIso ?? new Date(ms).toISOString();
    const tIsoParsed = parseDateMs(tIsoCandidate);
    const tIso = tIsoParsed != null ? new Date(tIsoParsed).toISOString() : new Date(ms).toISOString();

    normalized.push({
      tIso,
      ms: Number(ms),
      type: extractEventType(rawEvent),
      payload,
      sessionId: rawEvent.sessionId ?? payload.sessionId ?? null,
      rawEvent,
    });
  });

  normalized.sort((a, b) => a.ms - b.ms);
  return { events: normalized, invalidEvents };
}

export function buildAnalysisFromText(text) {
  const rawText = String(text || "");
  if (!rawText.trim()) {
    const emptyAnalysis = computeRunAnalysis([]);
    return {
      analysis: emptyAnalysis,
      parsed: { rawEvents: [], invalidLines: 0, format: "empty" },
      normalized: { events: [], invalidEvents: 0 },
    };
  }

  const parsed = parseTelemetryText(rawText);
  const normalized = normalizeTelemetryEvents(parsed.rawEvents);
  const analysis = computeRunAnalysis(normalized.events);
  return { analysis, parsed, normalized };
}

export function buildLiveAnalysis() {
  return buildAnalysisFromText(SessionLog.getText());
}

export function buildFileAnalysis(fileText) {
  return buildAnalysisFromText(fileText);
}

function createMetricState() {
  return { value: 0, known: false };
}

function applyMetricAbsolute(metric, nextValue) {
  const value = toFiniteNumber(nextValue);
  if (value == null) return;
  metric.value = value;
  metric.known = true;
}

function applyMetricDelta(metric, deltaValue) {
  const delta = toFiniteNumber(deltaValue);
  if (delta == null) return;
  if (!metric.known) {
    metric.value = 0;
    metric.known = true;
  }
  metric.value += delta;
}

function applyAbsoluteOrDelta(metric, payload) {
  applyMetricAbsolute(metric, payload.after);
  applyMetricAbsolute(metric, payload.value);
  applyMetricAbsolute(metric, payload.current);
  applyMetricAbsolute(metric, payload.total);
  if (!metric.known) {
    applyMetricDelta(metric, payload.delta);
  }
}

function normalizeResourceName(resource) {
  return String(resource || "").toLowerCase().replace(/[\s-]+/g, "_");
}

function toMetricKeyFromResource(resourceName) {
  if (!resourceName) return null;
  if (resourceName.includes("florin")) return "florins";
  if (resourceName.includes("stone")) return "stone";
  if (resourceName.includes("oil")) return "oliveOil";
  if (resourceName.includes("olive")) return "olives";
  return null;
}

function maybeApplyAbsoluteMetrics(metrics, payload) {
  applyMetricAbsolute(metrics.florins, payload.florins);
  applyMetricAbsolute(metrics.florins, payload.florinCount);
  applyMetricAbsolute(metrics.stone, payload.stone);
  applyMetricAbsolute(metrics.olives, payload.olives);
  applyMetricAbsolute(metrics.olives, payload.harvestedOlives);
  applyMetricAbsolute(metrics.oliveOil, payload.oliveOil);
  applyMetricAbsolute(metrics.oliveOil, payload.oliveOilCount);
}

function extractActionName(event) {
  return String(event.payload?.action || event.payload?.type || "unknown");
}

function compactEventDetails(event) {
  const payload = event.payload || {};
  if (event.type === "purchase_investment") {
    const title = payload.title || payload.id || "investment";
    return `${title} purchased`;
  }
  if (event.type === "hire_worker" || event.type === "hire_manager") {
    const workerType = payload.workerType || payload.managerType || "worker";
    const count = Number.isFinite(Number(payload.count)) ? ` (#${payload.count})` : "";
    return `${workerType}${count}`;
  }
  if (event.type === "action_complete" || event.type === "action_interrupted" || event.type === "action_start") {
    const action = payload.action || "action";
    const parts = [];
    if (Number.isFinite(Number(payload.amount))) parts.push(`amount ${payload.amount}`);
    if (Number.isFinite(Number(payload.collected))) parts.push(`collected ${payload.collected}`);
    if (Number.isFinite(Number(payload.output))) parts.push(`output ${payload.output}`);
    if (payload.outcome) parts.push(`outcome ${payload.outcome}`);
    return `${action}${parts.length ? ` (${parts.join(", ")})` : ""}`;
  }
  if (event.type === "era_transition") {
    return `era ${payload.fromEra ?? "?"} → ${payload.toEra ?? payload.era ?? "?"}`;
  }
  if (event.type === "analyzer_marker") {
    const label = String(payload.label || "Snapshot");
    return `📌 Snapshot: ${label}`;
  }

  const keys = Object.keys(payload).slice(0, 3);
  if (!keys.length) return "—";
  return keys.map((key) => `${key}=${String(payload[key])}`).join(", ");
}

function isKeyEvent(event) {
  return (
    event.type === "purchase_investment" ||
    event.type === "hire_worker" ||
    event.type === "hire_manager" ||
    event.type === "action_complete" ||
    event.type === "action_interrupted" ||
    event.type === "analyzer_marker" ||
    event.type === "era_transition" ||
    (event.type === "action_complete" && event.payload?.action === "move_to_city")
  );
}

export function computeRunAnalysis(events) {
  const orderedEvents = (Array.isArray(events) ? events : [])
    .slice()
    .sort((a, b) => a.ms - b.ms);
  if (!orderedEvents.length) {
    return {
      events: [],
      points: [],
      timelineRows: [],
      metadata: null,
      summary: null,
      availableMetrics: {},
    };
  }

  const state = {
    florins: 0,
    stone: 0,
    olives: 0,
    oliveOil: 0,
    investments: 0,
    workersByType: {},
    workersTotal: 0,
  };
  const known = {
    florins: false,
    stone: false,
    olives: false,
    oliveOil: false,
  };
  let actionsCompletedTotal = 0;
  const actionsByType = {};
  let era = null;
  const timelineRows = [];
  const points = [];

  const runStartMs = orderedEvents.reduce((min, event) => Math.min(min, event.ms), orderedEvents[0].ms);
  const runEndMs = orderedEvents.reduce((max, event) => Math.max(max, event.ms), orderedEvents[0].ms);
  const pushPoint = (ms) => {
    points.push({
      ms,
      tRelSec: (ms - runStartMs) / 1000,
      florins: known.florins ? state.florins : null,
      stone: known.stone ? state.stone : null,
      olives: known.olives ? state.olives : null,
      oliveOil: known.oliveOil ? state.oliveOil : null,
      investmentsPurchasedCount: state.investments,
      workersTotal: state.workersTotal,
      actionsCompletedTotal,
    });
  };
  pushPoint(runStartMs);

  orderedEvents.forEach((event) => {
    const payload = isPlainObject(event.payload) ? event.payload : {};
    const type = String(event.type || "unknown");
    let shouldEmitPoint = false;

    if (type === "currency_delta") {
      const currencyName = normalizeResourceName(payload.currency || payload.resource);
      if (currencyName === "florins" || currencyName.includes("florin")) {
        const before = state.florins;
        const after = toFiniteNumber(payload.after);
        if (after != null) {
          state.florins = after;
          known.florins = true;
        } else {
          const delta = toFiniteNumber(payload.delta);
          if (delta != null) {
            state.florins += delta;
            known.florins = true;
          }
        }
        shouldEmitPoint = shouldEmitPoint || state.florins !== before;
      }
    }

    if (type === "resource_delta") {
      const resourceName = normalizeResourceName(payload.resource || payload.name);
      const delta = toFiniteNumber(payload.delta);
      const after = toFiniteNumber(payload.after);
      const applyResourceDelta = (metricKey) => {
        const before = state[metricKey];
        if (after != null) {
          state[metricKey] = after;
        } else if (delta != null) {
          state[metricKey] += delta;
        } else {
          return false;
        }
        known[metricKey] = true;
        return state[metricKey] !== before;
      };
      if (resourceName === "stone") {
        shouldEmitPoint = applyResourceDelta("stone") || shouldEmitPoint;
      } else if (resourceName === "harvested_olives") {
        shouldEmitPoint = applyResourceDelta("olives") || shouldEmitPoint;
      } else if (resourceName === "olive_oil") {
        shouldEmitPoint = applyResourceDelta("oliveOil") || shouldEmitPoint;
      }
    }

    if (type === "purchase_investment") {
      state.investments += 1;
      shouldEmitPoint = true;
    }

    if (type === "hire_worker" || type === "hire_manager") {
      const workerType = String(payload.workerType || payload.managerType || "unknown");
      const previousCount = state.workersByType[workerType] || 0;
      const count = toFiniteNumber(payload.count);
      state.workersByType[workerType] = count != null ? count : (previousCount + 1);
      state.workersTotal = Object.values(state.workersByType).reduce((acc, next) => acc + next, 0);
      shouldEmitPoint = shouldEmitPoint || state.workersByType[workerType] !== previousCount;
    }

    if (type === "action_complete") {
      actionsCompletedTotal += 1;
      const action = extractActionName(event);
      actionsByType[action] = (actionsByType[action] || 0) + 1;
      if (action === "move_to_city") {
        era = 2;
      }
    }

    if (type === "era_transition") {
      const eraValue = toFiniteNumber(payload.toEra ?? payload.era);
      if (eraValue != null) era = eraValue;
    }
    if (toFiniteNumber(payload.era) != null) {
      era = toFiniteNumber(payload.era);
    }

    if (isKeyEvent(event)) {
      timelineRows.push({
        ms: event.ms,
        tIso: event.tIso,
        tRelSec: (event.ms - runStartMs) / 1000,
        type: event.type,
        action: extractActionName(event),
        details: compactEventDetails(event),
        isKeyEvent: true,
        event,
      });
    } else {
      timelineRows.push({
        ms: event.ms,
        tIso: event.tIso,
        tRelSec: (event.ms - runStartMs) / 1000,
        type: event.type,
        action: extractActionName(event),
        details: compactEventDetails(event),
        isKeyEvent: false,
        event,
      });
    }

    if (shouldEmitPoint || type === "analyzer_marker") {
      pushPoint(event.ms);
    }
  });

  const sessionStart = orderedEvents.find((event) => event.type === "session_start");
  const sessionId = sessionStart?.sessionId || orderedEvents.find((event) => !!event.sessionId)?.sessionId || "unknown";
  const version = sessionStart?.payload?.version || "unknown";
  const build = sessionStart?.payload?.build || "unknown";
  // Temporary sanity check used during patch verification; keep disabled to avoid console noise.
  // console.log("[analyzer] series points", points.length, "first", points[0], "last", points[points.length - 1]);

  return {
    events: orderedEvents,
    points,
    timelineRows,
    metadata: {
      sessionId,
      runStartMs,
      runEndMs,
      durationMs: Math.max(0, runEndMs - runStartMs),
      version,
      build,
    },
    summary: {
      finalFlorins: known.florins ? state.florins : null,
      finalStone: known.stone ? state.stone : null,
      finalOlives: known.olives ? state.olives : null,
      finalOliveOil: known.oliveOil ? state.oliveOil : null,
      investmentsPurchasedCount: state.investments,
      workersByType: state.workersByType,
      workersTotal: state.workersTotal,
      actionsCompletedTotal,
      actionsByType,
      era,
    },
    availableMetrics: {
      florins: known.florins,
      stone: known.stone,
      investmentsPurchasedCount: true,
      workersTotal: true,
      olives: known.olives,
      oliveOil: known.oliveOil,
    },
  };
}

function downloadTextFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildTimeseriesCsv(points) {
  const headers = [
    "tRelSec",
    "ms",
    "florins",
    "stone",
    "investmentsPurchasedCount",
    "workersTotal",
    "olives",
    "oliveOil",
    "actionsCompletedTotal",
  ];
  const rows = [headers.join(",")];
  points.forEach((point) => {
    rows.push([
      Number(point.tRelSec || 0).toFixed(3),
      point.ms ?? "",
      point.florins ?? "",
      point.stone ?? "",
      point.investmentsPurchasedCount ?? "",
      point.workersTotal ?? "",
      point.olives ?? "",
      point.oliveOil ?? "",
      point.actionsCompletedTotal ?? "",
    ].join(","));
  });
  return rows.join("\n");
}

function formatChartTime(seconds) {
  return formatDurationMs(seconds * 1000);
}

function buildPolylinePoints(points, key, scales) {
  return points
    .filter((point) => Number.isFinite(point[key]))
    .map((point) => `${scales.x(point.tRelSec)},${scales.y(point[key])}`)
    .join(" ");
}

function nearestPointIndex(points, targetSec) {
  if (!points.length) return -1;
  let bestIndex = 0;
  let bestDistance = Math.abs(points[0].tRelSec - targetSec);
  for (let i = 1; i < points.length; i++) {
    const distance = Math.abs(points[i].tRelSec - targetSec);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function createSvgEl(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, String(value));
  });
  return el;
}

export function initAnalyzerView(options = {}) {
  const fileInput = document.getElementById("analyzer-file-input");
  const uploadBtn = document.getElementById("analyzer-upload-btn");
  const snapshotBtn = document.getElementById("analyzer-snapshot-btn");
  const sourceLiveEl = document.getElementById("analyzer-source-live");
  const sourceFileEl = document.getElementById("analyzer-source-file");
  const loadedFilenameEl = document.getElementById("analyzer-loaded-filename");
  const statusEl = document.getElementById("analyzer-status");
  const metaSessionIdEl = document.getElementById("analyzer-meta-session-id");
  const metaStartEl = document.getElementById("analyzer-meta-start");
  const metaEndEl = document.getElementById("analyzer-meta-end");
  const metaDurationEl = document.getElementById("analyzer-meta-duration");
  const metaVersionEl = document.getElementById("analyzer-meta-version");
  const metaBuildEl = document.getElementById("analyzer-meta-build");
  const summaryFlorinsEl = document.getElementById("analyzer-summary-florins");
  const summaryStoneEl = document.getElementById("analyzer-summary-stone");
  const summaryInvestmentsEl = document.getElementById("analyzer-summary-investments");
  const summaryWorkersEl = document.getElementById("analyzer-summary-workers");
  const summaryActionsEl = document.getElementById("analyzer-summary-actions");
  const summaryEraEl = document.getElementById("analyzer-summary-era");
  const timelineFilterEl = document.getElementById("analyzer-timeline-filter");
  const timelineBodyEl = document.getElementById("analyzer-timeline-body");
  const chartWrapEl = document.getElementById("analyzer-chart-wrap");
  const chartSvgEl = document.getElementById("analyzer-chart-svg");
  const chartEmptyEl = document.getElementById("analyzer-chart-empty");
  const chartTooltipEl = document.getElementById("analyzer-chart-tooltip");
  const seriesControlsEl = document.getElementById("analyzer-series-controls");
  const downloadNormalizedBtn = document.getElementById("analyzer-download-normalized-btn");
  const downloadTimeseriesBtn = document.getElementById("analyzer-download-timeseries-btn");

  if (!fileInput || !uploadBtn || !statusEl || !chartWrapEl || !chartSvgEl || !timelineBodyEl) {
    return {
      notifyVisible: () => {},
    };
  }

  let currentAnalysis = null;
  let enabledMetricKeys = new Set();
  let currentSource = "live";
  let lastUploadedText = "";
  let lastUploadedFilename = "";

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.style.color = isError ? "#ff9f43" : "";
  }

  function updateSourceControls() {
    const hasFile = !!lastUploadedText;
    if (sourceFileEl) {
      sourceFileEl.disabled = !hasFile;
      sourceFileEl.checked = currentSource === "file" && hasFile;
    }
    if (sourceLiveEl) {
      sourceLiveEl.checked = currentSource !== "file";
    }
    if (loadedFilenameEl) {
      loadedFilenameEl.textContent = hasFile ? lastUploadedFilename : "none";
    }
    if (snapshotBtn) {
      snapshotBtn.disabled = currentSource !== "live";
    }
  }

  function updateMetadata(analysis) {
    const metadata = analysis?.metadata;
    metaSessionIdEl.textContent = metadata?.sessionId || "unknown";
    metaStartEl.textContent = metadata ? formatDateTime(metadata.runStartMs) : "—";
    metaEndEl.textContent = metadata ? formatDateTime(metadata.runEndMs) : "—";
    metaDurationEl.textContent = metadata ? formatDurationMs(metadata.durationMs) : "—";
    metaVersionEl.textContent = metadata?.version || "unknown";
    metaBuildEl.textContent = metadata?.build || "unknown";
  }

  function updateSummary(analysis) {
    const summary = analysis?.summary;
    summaryFlorinsEl.textContent = summary ? formatValue(summary.finalFlorins, 2) : "—";
    summaryStoneEl.textContent = summary ? formatValue(summary.finalStone, 0) : "—";
    summaryInvestmentsEl.textContent = summary ? String(summary.investmentsPurchasedCount || 0) : "0";
    summaryWorkersEl.textContent = summary ? String(summary.workersTotal || 0) : "0";
    summaryActionsEl.textContent = summary ? String(summary.actionsCompletedTotal || 0) : "0";
    summaryEraEl.textContent = summary?.era != null ? String(summary.era) : "unknown";
  }

  function renderTimeline() {
    const filter = timelineFilterEl.value || "key";
    const filterFn = TIMELINE_FILTERS[filter] || TIMELINE_FILTERS.key;
    const rows = (currentAnalysis?.timelineRows || []).filter(filterFn);
    timelineBodyEl.innerHTML = "";

    if (!rows.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="4" class="muted">No events match this filter.</td>`;
      timelineBodyEl.appendChild(row);
      return;
    }

    const runStartMs = currentAnalysis?.metadata?.runStartMs || rows[0].ms;
    rows.forEach((rowData) => {
      const row = document.createElement("tr");
      const elapsed = formatDurationMs(Math.max(0, rowData.ms - runStartMs));
      row.innerHTML = `
        <td>${elapsed}</td>
        <td>${formatDateTime(rowData.ms)}</td>
        <td>${rowData.type}</td>
        <td>${rowData.details}</td>
      `;
      timelineBodyEl.appendChild(row);
    });
  }

  function renderSeriesControls() {
    const available = currentAnalysis?.availableMetrics || {};
    if (!enabledMetricKeys.size) {
      METRIC_DEFS.forEach((def) => {
        if (available[def.key] && ["florins", "stone", "investmentsPurchasedCount"].includes(def.key)) {
          enabledMetricKeys.add(def.key);
        }
      });
      if (!enabledMetricKeys.size) {
        METRIC_DEFS.forEach((def) => {
          if (available[def.key]) enabledMetricKeys.add(def.key);
        });
      }
    }

    seriesControlsEl.innerHTML = "";
    METRIC_DEFS.forEach((def) => {
      const id = `series-${def.key}`;
      const wrapper = document.createElement("label");
      wrapper.className = "analyzer-series-item";
      wrapper.htmlFor = id;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = id;
      checkbox.checked = enabledMetricKeys.has(def.key);
      checkbox.disabled = !available[def.key];
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) enabledMetricKeys.add(def.key);
        else enabledMetricKeys.delete(def.key);
        renderChart();
      });

      const swatch = document.createElement("span");
      swatch.className = "analyzer-series-swatch";
      swatch.style.background = def.color;

      const text = document.createElement("span");
      text.textContent = def.label;
      if (!available[def.key]) {
        text.classList.add("muted");
      }

      wrapper.appendChild(checkbox);
      wrapper.appendChild(swatch);
      wrapper.appendChild(text);
      seriesControlsEl.appendChild(wrapper);
    });
  }

  function renderChart() {
    const analysis = currentAnalysis;
    const points = analysis?.points || [];
    const runStartMs = analysis?.metadata?.runStartMs || points[0]?.ms || 0;
    const markerEvents = (analysis?.events || [])
      .filter((event) => event.type === "analyzer_marker")
      .map((event) => ({
        tRelSec: Math.max(0, (event.ms - runStartMs) / 1000),
        label: String(event.payload?.label || "Snapshot"),
      }));
    chartSvgEl.innerHTML = "";
    chartTooltipEl.classList.add("is-hidden");

    if (!points.length) {
      chartEmptyEl.textContent = "No time-series points available.";
      chartEmptyEl.classList.remove("is-hidden");
      return;
    }

    const activeDefs = METRIC_DEFS.filter((def) => enabledMetricKeys.has(def.key));
    if (!activeDefs.length) {
      chartEmptyEl.textContent = "Enable at least one metric to draw the chart.";
      chartEmptyEl.classList.remove("is-hidden");
      return;
    }

    const values = [];
    activeDefs.forEach((def) => {
      points.forEach((point) => {
        if (Number.isFinite(point[def.key])) values.push(point[def.key]);
      });
    });
    if (!values.length) {
      chartEmptyEl.textContent = "Selected metrics are unavailable for this log.";
      chartEmptyEl.classList.remove("is-hidden");
      return;
    }
    chartEmptyEl.classList.add("is-hidden");

    const rect = chartWrapEl.getBoundingClientRect();
    const width = Math.max(500, Math.floor(rect.width) - 2);
    const height = 320;
    const padding = { left: 56, right: 18, top: 18, bottom: 36 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const minX = 0;
    const maxX = Math.max(1, Number(points[points.length - 1].tRelSec) || 1);
    const minY = Math.min(...values);
    const maxY = Math.max(...values);
    const yPad = maxY === minY ? Math.max(1, Math.abs(maxY) * 0.1) : (maxY - minY) * 0.08;
    const domainMinY = minY - yPad;
    const domainMaxY = maxY + yPad;

    const scales = {
      x: (value) => padding.left + ((value - minX) / (maxX - minX)) * plotWidth,
      y: (value) => padding.top + (1 - ((value - domainMinY) / (domainMaxY - domainMinY))) * plotHeight,
    };

    chartSvgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    chartSvgEl.setAttribute("width", String(width));
    chartSvgEl.setAttribute("height", String(height));

    chartSvgEl.appendChild(createSvgEl("rect", {
      x: padding.left,
      y: padding.top,
      width: plotWidth,
      height: plotHeight,
      fill: "rgba(255,255,255,0.01)",
      stroke: "rgba(255,255,255,0.08)",
      "stroke-width": 1,
      rx: 4,
    }));

    for (let i = 0; i <= 4; i++) {
      const ratio = i / 4;
      const yValue = domainMaxY - (domainMaxY - domainMinY) * ratio;
      const y = scales.y(yValue);
      chartSvgEl.appendChild(createSvgEl("line", {
        x1: padding.left,
        y1: y,
        x2: width - padding.right,
        y2: y,
        stroke: "rgba(255,255,255,0.08)",
        "stroke-width": 1,
      }));
      const label = createSvgEl("text", {
        x: padding.left - 8,
        y: y + 4,
        fill: "rgba(170,176,192,0.9)",
        "font-size": 11,
        "text-anchor": "end",
      });
      label.textContent = yValue.toFixed(Math.abs(yValue) >= 100 ? 0 : 2);
      chartSvgEl.appendChild(label);
    }

    for (let i = 0; i <= 4; i++) {
      const ratio = i / 4;
      const xValue = maxX * ratio;
      const x = scales.x(xValue);
      chartSvgEl.appendChild(createSvgEl("line", {
        x1: x,
        y1: padding.top,
        x2: x,
        y2: height - padding.bottom,
        stroke: "rgba(255,255,255,0.06)",
        "stroke-width": 1,
      }));
      const label = createSvgEl("text", {
        x,
        y: height - 12,
        fill: "rgba(170,176,192,0.9)",
        "font-size": 11,
        "text-anchor": "middle",
      });
      label.textContent = formatChartTime(xValue);
      chartSvgEl.appendChild(label);
    }

    markerEvents.forEach((marker) => {
      const x = scales.x(Math.min(maxX, Math.max(minX, marker.tRelSec)));
      chartSvgEl.appendChild(createSvgEl("line", {
        x1: x,
        y1: padding.top,
        x2: x,
        y2: height - padding.bottom,
        stroke: "rgba(255, 208, 0, 0.45)",
        "stroke-width": 1,
        "stroke-dasharray": "4 4",
      }));
    });

    activeDefs.forEach((def) => {
      const pointsString = buildPolylinePoints(points, def.key, scales);
      if (!pointsString) return;
      chartSvgEl.appendChild(createSvgEl("polyline", {
        points: pointsString,
        fill: "none",
        stroke: def.color,
        "stroke-width": 2.2,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }));
    });

    const hoverLine = createSvgEl("line", {
      x1: padding.left,
      y1: padding.top,
      x2: padding.left,
      y2: height - padding.bottom,
      stroke: "rgba(255,255,255,0.35)",
      "stroke-width": 1,
      visibility: "hidden",
    });
    chartSvgEl.appendChild(hoverLine);

    const overlay = createSvgEl("rect", {
      x: padding.left,
      y: padding.top,
      width: plotWidth,
      height: plotHeight,
      fill: "transparent",
      "pointer-events": "all",
    });
    chartSvgEl.appendChild(overlay);

    const onPointerLeave = () => {
      hoverLine.setAttribute("visibility", "hidden");
      chartTooltipEl.classList.add("is-hidden");
    };

    const onPointerMove = (evt) => {
      const pt = evt.target.ownerSVGElement.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      const cursor = pt.matrixTransform(chartSvgEl.getScreenCTM().inverse());
      const clampedX = Math.min(Math.max(cursor.x, padding.left), width - padding.right);
      const targetSec = ((clampedX - padding.left) / plotWidth) * maxX;
      const index = nearestPointIndex(points, targetSec);
      if (index < 0) {
        onPointerLeave();
        return;
      }
      const point = points[index];
      const x = scales.x(point.tRelSec);
      hoverLine.setAttribute("x1", x);
      hoverLine.setAttribute("x2", x);
      hoverLine.setAttribute("visibility", "visible");

      const lines = [`<strong>${formatChartTime(point.tRelSec)}</strong>`];
      activeDefs.forEach((def) => {
        const value = point[def.key];
        if (!Number.isFinite(value)) return;
        lines.push(`<span style="color:${def.color}">${def.label}: ${value.toFixed(def.digits)}</span>`);
      });
      if (markerEvents.length) {
        let nearestMarker = markerEvents[0];
        let markerDistance = Math.abs(nearestMarker.tRelSec - point.tRelSec);
        for (let i = 1; i < markerEvents.length; i++) {
          const distance = Math.abs(markerEvents[i].tRelSec - point.tRelSec);
          if (distance < markerDistance) {
            nearestMarker = markerEvents[i];
            markerDistance = distance;
          }
        }
        const markerTolerance = Math.max(0.4, maxX * 0.015);
        if (markerDistance <= markerTolerance) {
          lines.push(`<span style="color:#ffd166">📌 ${nearestMarker.label}</span>`);
        }
      }
      chartTooltipEl.innerHTML = lines.join("<br />");
      chartTooltipEl.style.left = `${Math.min(width - 170, Math.max(10, x + 10))}px`;
      chartTooltipEl.style.top = `${padding.top + 8}px`;
      chartTooltipEl.classList.remove("is-hidden");
    };

    overlay.addEventListener("mousemove", onPointerMove);
    overlay.addEventListener("mouseleave", onPointerLeave);
  }

  function applyAnalysisResult(analysis) {
    currentAnalysis = analysis;
    updateMetadata(analysis);
    updateSummary(analysis);
    renderSeriesControls();
    renderChart();
    renderTimeline();
    downloadNormalizedBtn.disabled = !analysis?.events?.length;
    downloadTimeseriesBtn.disabled = !analysis?.points?.length;
  }

  function buildStatusMessage(prefix, buildResult) {
    return `${prefix}${buildResult.normalized.events.length} events (${buildResult.parsed.format}).` +
      (buildResult.parsed.invalidLines ? ` Ignored ${buildResult.parsed.invalidLines} invalid line(s).` : "") +
      (buildResult.normalized.invalidEvents ? ` Skipped ${buildResult.normalized.invalidEvents} invalid event(s).` : "");
  }

  function renderFromSource(mode = currentSource) {
    if (mode === "file" && !lastUploadedText) {
      currentSource = "live";
      updateSourceControls();
      return renderFromSource("live");
    }

    try {
      const buildResult = mode === "live"
        ? buildLiveAnalysis()
        : buildFileAnalysis(lastUploadedText);
      currentSource = mode;
      applyAnalysisResult(buildResult.analysis);
      updateSourceControls();
      setStatus(mode === "live"
        ? buildStatusMessage("Current Run: ", buildResult)
        : buildStatusMessage(`Loaded File (${lastUploadedFilename}): `, buildResult));
    } catch (error) {
      console.error("Analyzer render failed", error);
      setStatus(`Failed to analyze ${mode === "live" ? "current run" : "loaded file"}: ${error?.message || "unknown error"}`, true);
    }
  }

  async function handleUpload() {
    const file = fileInput.files?.[0];
    if (!file) {
      setStatus("Select a .json or .ndjson file first.", true);
      return;
    }

    try {
      const text = await file.text();
      lastUploadedText = text;
      lastUploadedFilename = file.name || "uploaded";
      currentSource = "file";
      updateSourceControls();
      renderFromSource("file");
    } catch (error) {
      console.error("Analyzer upload failed", error);
      setStatus(`Failed to parse file: ${error?.message || "unknown error"}`, true);
    }
  }

  function handleSnapshotPoint() {
    if (currentSource !== "live") return;
    const inputLabel = window.prompt("Snapshot label (optional)", "Snapshot");
    if (inputLabel == null) return;
    const label = String(inputLabel || "").trim() || "Snapshot";
    const payload = { label, view: "analyzer" };
    if (typeof options.getLiveSnapshotPayload === "function") {
      const extra = options.getLiveSnapshotPayload();
      if (isPlainObject(extra)) {
        Object.keys(extra).forEach((key) => {
          if (extra[key] !== undefined) payload[key] = extra[key];
        });
      }
    }
    SessionLog.record("analyzer_marker", payload);
    renderFromSource("live");
  }

  uploadBtn.addEventListener("click", handleUpload);
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) {
      setStatus(`Ready to parse ${file.name}.`);
    }
  });
  timelineFilterEl.addEventListener("change", renderTimeline);
  if (sourceLiveEl) {
    sourceLiveEl.addEventListener("change", () => {
      if (sourceLiveEl.checked) renderFromSource("live");
    });
  }
  if (sourceFileEl) {
    sourceFileEl.addEventListener("change", () => {
      if (sourceFileEl.checked) renderFromSource("file");
    });
  }
  if (snapshotBtn) {
    snapshotBtn.addEventListener("click", handleSnapshotPoint);
  }

  downloadNormalizedBtn.addEventListener("click", () => {
    if (!currentAnalysis?.events?.length) return;
    downloadTextFile(
      "run-analyzer-normalized-events.json",
      JSON.stringify(currentAnalysis.events.map((event) => ({
        tIso: event.tIso,
        ms: event.ms,
        type: event.type,
        payload: event.payload,
        sessionId: event.sessionId,
      })), null, 2),
      "application/json"
    );
  });

  downloadTimeseriesBtn.addEventListener("click", () => {
    if (!currentAnalysis?.points?.length) return;
    downloadTextFile("run-analyzer-timeseries.csv", buildTimeseriesCsv(currentAnalysis.points), "text/csv");
  });

  window.addEventListener("resize", () => {
    if (currentAnalysis?.points?.length) {
      renderChart();
    }
  });

  updateSourceControls();

  return {
    notifyVisible() {
      currentSource = "live";
      updateSourceControls();
      renderFromSource("live");
    },
  };
}
