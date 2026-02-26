import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDomLogger } from "./static/js/logger.js";

function makeContainer() {
  const children = [];
  return {
    get children() {
      return children;
    },
    prepend(node) {
      children.unshift(node);
    },
    removeChild(node) {
      const idx = children.indexOf(node);
      if (idx >= 0) children.splice(idx, 1);
      return node;
    },
    get lastChild() {
      return children[children.length - 1];
    },
  };
}

describe("createDomLogger", () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = global.document;
    global.document = {
      createElement() {
        return {
          className: "",
          classList: { add() {} },
          textContent: "",
          dataset: {},
        };
      },
    };
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  it("prepends lines and caps to maxLines", () => {
    const container = makeContainer();
    const log = createDomLogger({ container, maxLines: 2, timestamp: "none" });

    log("one");
    log("two");
    log("three");

    expect(container.children.length).toBe(2);
    expect(container.children[0].textContent).toBe("three");
    expect(container.children[1].textContent).toBe("two");
  });

  it("adds ISO timestamp when configured", () => {
    const container = makeContainer();
    const log = createDomLogger({ container, timestamp: "iso" });

    log("hello");

    expect(container.children[0].textContent).toMatch(/^\[[^\]]+\] hello$/);
    expect(container.children[0].dataset.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("throws when container is missing", () => {
    expect(() => createDomLogger({})).toThrow(/container/i);
  });
});
