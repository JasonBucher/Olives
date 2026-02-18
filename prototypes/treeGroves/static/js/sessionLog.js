const DEFAULT_STORAGE_KEY = "tg_session_log_v1";
const DEFAULT_SESSION_STORAGE_KEY = "tg_session_log_session_id_v1";
const DEFAULT_MAX_LINES = 20000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_WRITE_DEBOUNCE_MS = 250;

function getStorage(name) {
  try {
    return globalThis?.[name] ?? null;
  } catch {
    return null;
  }
}

function generateSessionId(cryptoImpl = globalThis?.crypto) {
  if (cryptoImpl && typeof cryptoImpl.randomUUID === "function") {
    return cryptoImpl.randomUUID();
  }
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function byteLengthOf(text, encoder) {
  if (encoder) return encoder.encode(text).length;
  return String(text).length;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${parts.join(",")}}`;
}

function checksumHex(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function computeTuningHash(tuning) {
  if (!isPlainObject(tuning) && !Array.isArray(tuning)) return "unknown";
  try {
    return checksumHex(stableStringify(tuning));
  } catch {
    return "unknown";
  }
}

function parsePersisted(raw) {
  if (!raw || typeof raw !== "string") return null;

  try {
    const parsed = JSON.parse(raw);
    if (isPlainObject(parsed) && Array.isArray(parsed.lines)) {
      return {
        sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : null,
        lines: parsed.lines.filter((line) => typeof line === "string" && line.length > 0),
      };
    }
    if (Array.isArray(parsed)) {
      return {
        sessionId: null,
        lines: parsed.filter((line) => typeof line === "string" && line.length > 0),
      };
    }
  } catch {
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return { sessionId: null, lines };
  }

  return null;
}

function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  } catch {
    return "unknown";
  }
}

function getUserAgent() {
  try {
    return globalThis?.navigator?.userAgent || "unknown";
  } catch {
    return "unknown";
  }
}

function getSimMs() {
  try {
    const raw = globalThis?.__tgSimMs ?? globalThis?.window?.__tgSimMs;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function createBaseEntry(type, payload, sessionId) {
  const entry = {
    t: new Date().toISOString(),
    ms: Date.now(),
    sessionId,
    type,
    payload: isPlainObject(payload) ? payload : {},
  };
  const simMs = getSimMs();
  if (simMs != null) {
    entry.simMs = simMs;
  }
  return entry;
}

export function createSessionLog(options = {}) {
  const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
  const sessionStorageKey = options.sessionStorageKey || DEFAULT_SESSION_STORAGE_KEY;
  const maxLines = Number.isFinite(options.maxLines) ? Math.max(1, Math.floor(options.maxLines)) : DEFAULT_MAX_LINES;
  const maxBytes = Number.isFinite(options.maxBytes) ? Math.max(256, Math.floor(options.maxBytes)) : DEFAULT_MAX_BYTES;
  const writeDebounceMs = Number.isFinite(options.writeDebounceMs)
    ? Math.max(0, Math.floor(options.writeDebounceMs))
    : DEFAULT_WRITE_DEBOUNCE_MS;

  const storage = options.storage ?? getStorage("localStorage");
  const sessionStorage = options.sessionStorage ?? getStorage("sessionStorage");
  const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  const setTimeoutFn = options.setTimeoutFn || globalThis.setTimeout?.bind(globalThis) || null;
  const clearTimeoutFn = options.clearTimeoutFn || globalThis.clearTimeout?.bind(globalThis) || null;

  let sessionId = null;
  let lines = [];
  let approxBytes = 0;
  let persistTimerId = null;
  let hasSessionStart = false;

  function recalcBytes() {
    approxBytes = lines.reduce((sum, line) => sum + byteLengthOf(line, encoder) + 1, 0);
  }

  function trimToLimits() {
    let droppedLines = 0;
    while ((lines.length > maxLines || approxBytes > maxBytes) && lines.length > 0) {
      const removed = lines.shift();
      approxBytes -= byteLengthOf(removed, encoder) + 1;
      droppedLines += 1;
    }
    return droppedLines;
  }

  function persistNow() {
    if (!storage || typeof storage.setItem !== "function") return;
    try {
      storage.setItem(storageKey, JSON.stringify({ sessionId, lines }));
    } catch (error) {
      console.warn("SessionLog: failed to persist log", error);
    }
  }

  function schedulePersist() {
    if (!setTimeoutFn || !clearTimeoutFn) {
      persistNow();
      return;
    }
    if (persistTimerId != null) {
      clearTimeoutFn(persistTimerId);
    }
    persistTimerId = setTimeoutFn(() => {
      persistTimerId = null;
      persistNow();
    }, writeDebounceMs);
  }

  function appendLine(line, { suppressTrimEvent = false } = {}) {
    lines.push(line);
    approxBytes += byteLengthOf(line, encoder) + 1;

    const droppedLines = trimToLimits();
    if (droppedLines > 0 && !suppressTrimEvent) {
      const trimLine = JSON.stringify(createBaseEntry("log_trimmed", { droppedLines }, sessionId));
      appendLine(trimLine, { suppressTrimEvent: true });
    }
  }

  function resolveSessionId() {
    const existingSessionId = sessionStorage?.getItem?.(sessionStorageKey);
    if (existingSessionId && typeof existingSessionId === "string") {
      return existingSessionId;
    }
    const nextId = generateSessionId(options.crypto);
    try {
      sessionStorage?.setItem?.(sessionStorageKey, nextId);
    } catch {
      // Ignore session storage write failures.
    }
    return nextId;
  }

  function loadPersistedState() {
    if (!storage || typeof storage.getItem !== "function") return;
    const raw = storage.getItem(storageKey);
    const persisted = parsePersisted(raw);
    if (!persisted) return;
    if (!persisted.sessionId || persisted.sessionId !== sessionId) {
      lines = [];
      approxBytes = 0;
      return;
    }
    lines = persisted.lines;
    recalcBytes();
    trimToLimits();
  }

  function record(type, payload = {}) {
    if (typeof type !== "string" || type.length === 0) return null;
    const line = JSON.stringify(createBaseEntry(type, payload, sessionId));
    appendLine(line);
    schedulePersist();
    return line;
  }

  function initSession(metadata = {}) {
    if (hasSessionStart) return;
    hasSessionStart = true;
    record("session_start", {
      version: typeof metadata.version === "string" && metadata.version ? metadata.version : "unknown",
      build: typeof metadata.build === "string" && metadata.build ? metadata.build : "unknown",
      timezone: getTimeZone(),
      userAgent: getUserAgent(),
      tuningHash: computeTuningHash(metadata.tuning),
    });
  }

  function getText() {
    return `${lines.join("\n")}\n`;
  }

  function getStats() {
    return {
      sessionId,
      lineCount: lines.length,
      approxBytes,
    };
  }

  function flush() {
    if (persistTimerId != null && clearTimeoutFn) {
      clearTimeoutFn(persistTimerId);
      persistTimerId = null;
    }
    persistNow();
  }

  sessionId = resolveSessionId();
  loadPersistedState();

  if (typeof window !== "undefined" && window && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", flush);
  }

  return {
    initSession,
    record,
    getText,
    getStats,
    flush,
    getSessionId: () => sessionId,
  };
}

const SessionLog = createSessionLog();

export default SessionLog;
