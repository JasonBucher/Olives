import { describe, it, expect } from "vitest";
import {
  clamp,
  formatRate,
  getClickYield,
  getDisplayCount,
  getPressResult,
  getScaledCost,
  getSellValue,
  rollWeighted,
} from "./static/js/gameCalc.js";

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps below min", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps above max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("formatRate", () => {
  it("formats integers without decimal", () => {
    expect(formatRate(3)).toBe("3");
  });

  it("trims trailing zero from whole-number floats", () => {
    expect(formatRate(3.0)).toBe("3");
  });

  it("keeps one decimal when meaningful", () => {
    expect(formatRate(2.7)).toBe("2.7");
  });

  it("rounds to one decimal place", () => {
    expect(formatRate(1.35)).toBe("1.4");
  });
});

describe("getDisplayCount", () => {
  it("floors fractional values", () => {
    expect(getDisplayCount(3.7)).toBe(3);
  });

  it("returns integers unchanged", () => {
    expect(getDisplayCount(5)).toBe(5);
  });
});

describe("rollWeighted", () => {
  it("returns first outcome when all weights are zero", () => {
    const outcomes = [{ weight: 0, id: "a" }, { weight: 0, id: "b" }];
    expect(rollWeighted(outcomes).id).toBe("a");
  });

  it("returns the only positive-weight outcome", () => {
    const outcomes = [{ weight: 0, id: "a" }, { weight: 1, id: "b" }];
    expect(rollWeighted(outcomes).id).toBe("b");
  });
});

describe("template economy helpers", () => {
  it("computes click yield with one-shot and repeatable bonuses", () => {
    expect(getClickYield(1, false, 0, 1)).toBe(1);
    expect(getClickYield(1, true, 2, 1)).toBe(4);
  });

  it("computes repeatable costs", () => {
    expect(getScaledCost(20, 0, 18)).toBe(20);
    expect(getScaledCost(20, 3, 18)).toBe(74);
  });

  it("returns invalid press result when olives are insufficient", () => {
    expect(getPressResult(3, 5, 1)).toEqual({ olivesSpent: 0, oilMade: 0, canPress: false });
  });

  it("returns valid press result when olives are sufficient", () => {
    expect(getPressResult(8, 5, 1)).toEqual({ olivesSpent: 5, oilMade: 1, canPress: true });
  });

  it("computes sell value with multiplier", () => {
    expect(getSellValue(4, 4, 1.5)).toBe(24);
  });
});
