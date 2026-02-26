import SessionLog from "../sessionLog.js";

const SERIES = [
  { key: "avocadoCount", label: "Avocados", color: "#7dbf47" },
  { key: "aps", label: "APS", color: "#3b82f6" },
  { key: "guacCount", label: "Guac", color: "#f59e0b" },
  { key: "wisdom", label: "Wisdom", color: "#a855f7" },
  { key: "prestigeCount", label: "Prestige", color: "#ef4444" },
];

const FILTERS = {
  key: (e) => ["purchase_producer", "purchase_upgrade", "prestige", "distill", "snapshot_marker"].includes(e.type),
  all: () => true,
  purchases: (e) => e.type === "purchase_producer" || e.type === "purchase_upgrade",
  progression: (e) => e.type === "state_snapshot" || e.type === "prestige" || e.type === "distill",
};

function parseDateMs(value) {
  if (value == null) return null;
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTelemetryText(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      // fall through
    }
  }

  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj?.events)) return obj.events;
      if (Array.isArray(obj?.logs)) return obj.logs;
      return [obj];
    } catch {
      // fall through
    }
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function normalizeEvents(events) {
  return (Array.isArray(events) ? events : [])
    .map((event) => {
      const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
      const ms = parseDateMs(event.ms ?? event.t ?? payload.ms ?? payload.t);
      if (!Number.isFinite(ms)) return null;
      const simMsCandidate = Number(event.simMs ?? payload.simMs);
      return {
        ...event,
        payload,
        ms,
        simMs: Number.isFinite(simMsCandidate) ? simMsCandidate : null,
        type: String(event.type || "unknown"),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.ms - b.ms);
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "00:00";
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return `${keys.join(",")}\n${rows.map((r) => keys.map((k) => esc(r[k])).join(",")).join("\n")}`;
}

function downloadText(filename, text, type = "application/octet-stream") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function initAnalyzerView({ onBack, captureSnapshot }) {
  const backBtn = document.getElementById("analyzer-back-btn");
  const fileInput = document.getElementById("analyzer-file-input");
  const uploadBtn = document.getElementById("analyzer-upload-btn");
  const snapshotBtn = document.getElementById("analyzer-snapshot-btn");
  const sourceLiveEl = document.getElementById("analyzer-source-live");
  const sourceFileEl = document.getElementById("analyzer-source-file");
  const loadedFilenameEl = document.getElementById("analyzer-loaded-filename");
  const statusEl = document.getElementById("analyzer-status");
  const timelineFilterEl = document.getElementById("analyzer-timeline-filter");
  const timelineEl = document.getElementById("analyzer-timeline-body");
  const controlsEl = document.getElementById("analyzer-series-controls");
  const svg = document.getElementById("analyzer-chart-svg");
  const emptyEl = document.getElementById("analyzer-chart-empty");
  const downloadNormalizedBtn = document.getElementById("analyzer-download-normalized-btn");
  const downloadTimeseriesBtn = document.getElementById("analyzer-download-timeseries-btn");

  const metaSessionEl = document.getElementById("analyzer-meta-session-id");
  const metaStartEl = document.getElementById("analyzer-meta-start");
  const metaEndEl = document.getElementById("analyzer-meta-end");
  const metaDurationEl = document.getElementById("analyzer-meta-duration");
  const metaVersionEl = document.getElementById("analyzer-meta-version");
  const metaBuildEl = document.getElementById("analyzer-meta-build");
  const summaryAvocados = document.getElementById("analyzer-summary-avocados");
  const summaryGuac = document.getElementById("analyzer-summary-guac");
  const summaryWisdom = document.getElementById("analyzer-summary-wisdom");
  const summaryPrestige = document.getElementById("analyzer-summary-prestige");
  const summaryEvents = document.getElementById("analyzer-summary-events");

  let events = [];
  const enabled = new Set(SERIES.map((s) => s.key));
  let loadedFilename = "";

  function getRunElapsed(event, start) {
    return (event.simMs ?? event.ms) - start;
  }

  function renderTimeline() {
    if (!events.length) {
      timelineEl.innerHTML = '<tr><td colspan="4" class="muted">No events loaded.</td></tr>';
      return;
    }
    const filter = FILTERS[timelineFilterEl?.value] || FILTERS.key;
    const rows = events.filter(filter).slice(-250).reverse();
    const start = events[0].simMs ?? events[0].ms;

    timelineEl.innerHTML = rows
      .map((event) => `<tr><td>${formatDuration(getRunElapsed(event, start))}</td><td>${new Date(event.ms).toLocaleTimeString()}</td><td>${event.type}</td><td>${JSON.stringify(event.payload || {})}</td></tr>`)
      .join("");
    if (!rows.length) {
      timelineEl.innerHTML = '<tr><td colspan="4" class="muted">No events for this filter.</td></tr>';
    }
  }

  function snapshotSeriesRows() {
    return events.filter((event) => event.type === "state_snapshot");
  }

  function renderChart() {
    const samples = snapshotSeriesRows();
    if (!samples.length) {
      emptyEl.classList.remove("is-hidden");
      svg.innerHTML = "";
      return;
    }
    emptyEl.classList.add("is-hidden");

    const w = 900;
    const h = 280;
    const pad = 24;
    const t0 = samples[0].simMs ?? samples[0].ms;
    const t1 = samples[samples.length - 1].simMs ?? samples[samples.length - 1].ms;
    const maxY = Math.max(1, ...samples.flatMap((sample) => Array.from(enabled).map((key) => Number(sample.payload?.[key] || 0))));

    const paths = SERIES.filter((series) => enabled.has(series.key)).map((series) => {
      const d = samples.map((sample, i) => {
        const t = sample.simMs ?? sample.ms;
        const x = pad + ((t - t0) / Math.max(1, t1 - t0)) * (w - pad * 2);
        const y = h - pad - (Number(sample.payload?.[series.key] || 0) / maxY) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(" ");
      return `<path d="${d}" fill="none" stroke="${series.color}" stroke-width="2" />`;
    }).join("\n");

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = `<rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>${paths}`;
  }

  function renderControls() {
    controlsEl.innerHTML = SERIES.map((series) => `
      <label class="analyzer-series-item">
        <input type="checkbox" data-key="${series.key}" ${enabled.has(series.key) ? "checked" : ""} />
        <span class="analyzer-series-swatch" style="background:${series.color}"></span>${series.label}
      </label>
    `).join("");

    controlsEl.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) enabled.add(input.dataset.key);
        else enabled.delete(input.dataset.key);
        renderChart();
      });
    });
  }

  function updateMetadata() {
    const start = events[0];
    const end = events[events.length - 1];
    const sessionStart = events.find((event) => event.type === "session_start");
    const startMs = start?.ms;
    const endMs = end?.ms;
    const startSimMs = start?.simMs ?? startMs;
    const endSimMs = end?.simMs ?? endMs;

    metaSessionEl.textContent = start?.sessionId || "—";
    metaStartEl.textContent = Number.isFinite(startMs) ? new Date(startMs).toLocaleString() : "—";
    metaEndEl.textContent = Number.isFinite(endMs) ? new Date(endMs).toLocaleString() : "—";
    metaDurationEl.textContent = formatDuration((endSimMs || 0) - (startSimMs || 0));
    metaVersionEl.textContent = sessionStart?.payload?.version || "—";
    metaBuildEl.textContent = sessionStart?.payload?.build || "—";
  }

  function updateSummary() {
    const lastSnapshot = [...events].reverse().find((event) => event.type === "state_snapshot")?.payload || {};
    summaryAvocados.textContent = Number(lastSnapshot.avocadoCount || 0).toLocaleString();
    summaryGuac.textContent = Number(lastSnapshot.guacCount || 0).toLocaleString();
    summaryWisdom.textContent = Number(lastSnapshot.wisdom || 0).toLocaleString();
    summaryPrestige.textContent = Number(lastSnapshot.prestigeCount || 0).toLocaleString();
    summaryEvents.textContent = Number(events.length || 0).toLocaleString();
  }

  function apply(rawEvents) {
    events = normalizeEvents(rawEvents);
    updateMetadata();
    updateSummary();
    renderTimeline();
    renderChart();
    if (downloadNormalizedBtn) downloadNormalizedBtn.disabled = !events.length;
    if (downloadTimeseriesBtn) downloadTimeseriesBtn.disabled = !snapshotSeriesRows().length;
  }

  function loadLive() {
    sourceLiveEl.checked = true;
    apply(parseTelemetryText(SessionLog.getText()));
    statusEl.textContent = `Loaded current run (${events.length} events).`;
  }

  uploadBtn?.addEventListener("click", () => {
    const file = fileInput?.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      loadedFilename = file.name;
      sourceFileEl.disabled = false;
      sourceFileEl.checked = true;
      loadedFilenameEl.textContent = loadedFilename;
      apply(parseTelemetryText(text));
      statusEl.textContent = `Loaded ${file.name} (${events.length} events).`;
    });
  });

  sourceLiveEl?.addEventListener("change", () => {
    if (sourceLiveEl.checked) loadLive();
  });

  sourceFileEl?.addEventListener("change", () => {
    if (sourceFileEl.checked && loadedFilename) {
      statusEl.textContent = `Viewing loaded file: ${loadedFilename}.`;
    }
  });

  timelineFilterEl?.addEventListener("change", renderTimeline);

  snapshotBtn?.addEventListener("click", () => {
    if (typeof captureSnapshot === "function") captureSnapshot("analyzer_snapshot");
    loadLive();
    statusEl.textContent = `Snapshot captured (${events.length} events).`;
  });

  downloadNormalizedBtn?.addEventListener("click", () => {
    downloadText("avocado-normalized-events.json", JSON.stringify(events, null, 2), "application/json");
  });

  downloadTimeseriesBtn?.addEventListener("click", () => {
    const rows = snapshotSeriesRows().map((event) => ({
      ms: event.ms,
      simMs: event.simMs ?? "",
      ...event.payload,
    }));
    downloadText("avocado-timeseries.csv", toCsv(rows), "text/csv");
  });

  backBtn?.addEventListener("click", () => onBack?.());
  renderControls();

  return {
    notifyVisible() {
      loadLive();
    },
  };
}
