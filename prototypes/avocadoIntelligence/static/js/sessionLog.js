// Session telemetry logger — persists event lines to localStorage.
//
// Uses AVO_session_log (localStorage) and AVO_session_id (sessionStorage)
// to follow the project's STORAGE_PREFIX convention.
//
// Usage:
//   import SessionLog from "./sessionLog.js";
//   SessionLog.initSession({ version: "1.0" });
//   SessionLog.record("state_snapshot", { avocadoCount: 42 });
//   SessionLog.getText();   // NDJSON string
//   SessionLog.getStats();  // { sessionId, lineCount, approxBytes }

const STORAGE_KEY = "AVO_session_log";
const SESSION_ID_KEY = "AVO_session_id";
const MAX_LINES = 20_000;
const DEBOUNCE_MS = 250;

function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSessionLog() {
  let sessionId = "";
  let lines = [];
  let writeTimer = null;
  let dirty = false;

  // Restore session ID from sessionStorage (survives tab reload)
  const storedId = sessionStorage.getItem(SESSION_ID_KEY);
  if (storedId) {
    sessionId = storedId;
    // Try to recover lines from previous page load in same session
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sessionId === sessionId && Array.isArray(parsed.lines)) {
          lines = parsed.lines;
        }
      }
    } catch { /* ignore corrupt data */ }
  } else {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  function persist() {
    if (!dirty) return;
    dirty = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, lines }));
    } catch { /* storage full — silently drop */ }
  }

  function schedulePersist() {
    dirty = true;
    if (writeTimer) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      persist();
    }, DEBOUNCE_MS);
  }

  // Flush on page unload
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => persist());
  }

  return {
    /** Record a session_start event with optional metadata. */
    initSession(metadata = {}) {
      this.record("session_start", {
        version: metadata.version || "avocadoIntelligence",
        timezone: Intl?.DateTimeFormat?.().resolvedOptions?.()?.timeZone,
        userAgent: navigator?.userAgent?.slice(0, 120),
        ...metadata,
      });
    },

    /** Append an event to the log. */
    record(type, payload = {}) {
      const entry = JSON.stringify({
        t: new Date().toISOString(),
        ms: Date.now(),
        sessionId,
        type,
        payload,
      });
      lines.push(entry);
      // Trim from front if over limit
      if (lines.length > MAX_LINES) {
        lines = lines.slice(lines.length - MAX_LINES);
      }
      schedulePersist();
    },

    /** Return all lines as newline-delimited JSON text. */
    getText() {
      return lines.join("\n");
    },

    /** Return summary stats. */
    getStats() {
      const text = lines.join("\n");
      return {
        sessionId,
        lineCount: lines.length,
        approxBytes: new Blob([text]).size,
      };
    },

    getSessionId() {
      return sessionId;
    },

    /** Immediately write pending data to storage. */
    flush() {
      if (writeTimer) {
        clearTimeout(writeTimer);
        writeTimer = null;
      }
      dirty = true;
      persist();
    },

    /** Clear all lines (does not start a new session). */
    clear() {
      lines = [];
      dirty = true;
      persist();
    },
  };
}

const SessionLog = createSessionLog();
export default SessionLog;
export { createSessionLog };
