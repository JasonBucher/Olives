import { describe, it, expect } from "vitest";
import { clamp, formatRate, getDisplayCount, rollWeighted, calcPrestigeMultiplier, canPrestige } from "./static/js/gameCalc.js";

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

describe("calcPrestigeMultiplier", () => {
  const tuning = { prestige: { multiplierPerPrestige: 0.5 } };

  it("returns 1.0 at prestige 0", () => {
    expect(calcPrestigeMultiplier(0, tuning)).toBe(1.0);
  });

  it("returns 1.5 at prestige 1", () => {
    expect(calcPrestigeMultiplier(1, tuning)).toBe(1.5);
  });

  it("returns 2.0 at prestige 2", () => {
    expect(calcPrestigeMultiplier(2, tuning)).toBe(2.0);
  });

  it("scales linearly with prestige count", () => {
    expect(calcPrestigeMultiplier(10, tuning)).toBe(6.0);
  });
});

describe("canPrestige", () => {
  const tuning = { prestige: { unlockThreshold: 1000 } };

  it("returns false below threshold", () => {
    expect(canPrestige(999, tuning)).toBe(false);
  });

  it("returns true at exactly threshold", () => {
    expect(canPrestige(1000, tuning)).toBe(true);
  });

  it("returns true above threshold", () => {
    expect(canPrestige(5000, tuning)).toBe(true);
  });

  it("returns false at zero", () => {
    expect(canPrestige(0, tuning)).toBe(false);
  });
});
