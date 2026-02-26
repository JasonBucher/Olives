const DEFAULT_STORAGE_KEY = "ai_session_log_v1";
const DEFAULT_SESSION_STORAGE_KEY = "ai_session_log_session_id_v1";
const DEFAULT_MAX_LINES = 20000;
const DEFAULT_WRITE_DEBOUNCE_MS = 250;

function getStorage(name) {
  try {
    return globalThis?.[name] ?? null;
  } catch {
    return null;
  }
}

function generateSessionId() {
  if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getSimMs() {
  const value = Number(globalThis?.__aiSimMs ?? globalThis?.window?.__aiSimMs);
  return Number.isFinite(value) ? value : null;
}

function createEntry(type, payload, sessionId) {
  const entry = {
    t: new Date().toISOString(),
    ms: Date.now(),
    sessionId,
    type,
    payload,
  };
  const simMs = getSimMs();
  if (simMs != null) entry.simMs = simMs;
  return entry;
}

export function createSessionLog(options = {}) {
  const storage = options.storage ?? getStorage("localStorage");
  const sessionStorage = options.sessionStorage ?? getStorage("sessionStorage");
  const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
  const sessionStorageKey = options.sessionStorageKey || DEFAULT_SESSION_STORAGE_KEY;
  const maxLines = Number.isFinite(options.maxLines) ? Math.max(100, Math.floor(options.maxLines)) : DEFAULT_MAX_LINES;
  const writeDebounceMs = Number.isFinite(options.writeDebounceMs)
    ? Math.max(0, Math.floor(options.writeDebounceMs))
    : DEFAULT_WRITE_DEBOUNCE_MS;

  let lines = [];
  let sessionId = null;
  let persistTimer = null;

  function resolveSessionId() {
    const existing = sessionStorage?.getItem?.(sessionStorageKey);
    if (existing) return existing;
    const next = generateSessionId();
    try { sessionStorage?.setItem?.(sessionStorageKey, next); } catch {}
    return next;
  }

  function persistNow() {
    try {
      storage?.setItem?.(storageKey, JSON.stringify({ sessionId, lines }));
    } catch {}
  }

  function schedulePersist() {
    if (!globalThis?.setTimeout || !globalThis?.clearTimeout || writeDebounceMs === 0) {
      persistNow();
      return;
    }
    if (persistTimer != null) globalThis.clearTimeout(persistTimer);
    persistTimer = globalThis.setTimeout(() => {
      persistTimer = null;
      persistNow();
    }, writeDebounceMs);
  }

  function loadPersisted() {
    try {
      const raw = storage?.getItem?.(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.sessionId === sessionId && Array.isArray(parsed.lines)) {
        lines = parsed.lines.filter((line) => typeof line === "string");
      }
    } catch {
      lines = [];
    }
  }

  function record(type, payload = {}) {
    if (!type) return;
    lines.push(JSON.stringify(createEntry(type, payload, sessionId)));
    while (lines.length > maxLines) lines.shift();
    schedulePersist();
  }

  function initSession(metadata = {}) {
    record("session_start", {
      version: metadata.version || "unknown",
      build: metadata.build || "unknown",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
      userAgent: globalThis?.navigator?.userAgent || "unknown",
    });
  }

  function flush() {
    if (persistTimer != null && globalThis?.clearTimeout) {
      globalThis.clearTimeout(persistTimer);
      persistTimer = null;
    }
    persistNow();
  }

  sessionId = resolveSessionId();
  loadPersisted();

  if (typeof window !== "undefined" && window?.addEventListener) {
    window.addEventListener("beforeunload", flush);
  }

  return {
    initSession,
    record,
    getText: () => `${lines.join("\n")}\n`,
    getStats: () => ({ sessionId, lineCount: lines.length, approxBytes: new Blob(lines).size }),
    clear() {
      lines = [];
      flush();
    },
    flush,
    getSessionId: () => sessionId,
  };
}

const SessionLog = createSessionLog();
export default SessionLog;
