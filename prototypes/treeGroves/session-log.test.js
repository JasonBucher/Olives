import { describe, it, expect } from "vitest";
import { createSessionLog } from "./static/js/sessionLog.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function createTestSessionLog(options = {}) {
  return createSessionLog({
    storage: createMemoryStorage(),
    sessionStorage: createMemoryStorage(),
    writeDebounceMs: 0,
    setTimeoutFn: (fn) => {
      fn();
      return 1;
    },
    clearTimeoutFn: () => {},
    crypto: { randomUUID: () => "test-session-id" },
    ...options,
  });
}

function getParsedLines(logText) {
  return logText
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe("SessionLog", () => {
  it("record() appends an NDJSON line", () => {
    const log = createTestSessionLog();
    log.record("action_start", { action: "harvest" });
    const lines = getParsedLines(log.getText());

    expect(lines).toHaveLength(1);
    expect(lines[0].type).toBe("action_start");
    expect(lines[0].payload).toEqual({ action: "harvest" });
    expect(lines[0].sessionId).toBe("test-session-id");
  });

  it("getText() always ends with a newline", () => {
    const log = createTestSessionLog();
    log.record("action_complete", { action: "press" });

    const text = log.getText();
    expect(text.endsWith("\n")).toBe(true);
  });

  it("trims old lines when maxLines is exceeded", () => {
    const log = createTestSessionLog({ maxLines: 3, maxBytes: 1024 * 1024 });

    log.record("a", {});
    log.record("b", {});
    log.record("c", {});
    log.record("d", {});
    log.record("e", {});

    const lines = getParsedLines(log.getText());
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.some((entry) => entry.type === "log_trimmed")).toBe(true);
  });

  it("includes simMs when available", () => {
    const originalSimMs = globalThis.__tgSimMs;
    globalThis.__tgSimMs = 1234;
    try {
      const log = createTestSessionLog();
      log.record("action_start", { action: "harvest" });
      const lines = getParsedLines(log.getText());
      expect(lines[0].simMs).toBe(1234);
    } finally {
      globalThis.__tgSimMs = originalSimMs;
    }
  });
});
