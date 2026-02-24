import { describe, it, expect } from "vitest";
import {
  clamp, formatRate, getDisplayCount, rollWeighted, canPrestige,
  formatNumber, calcProducerCost, calcProducerUnitRate,
  calcTotalAps, calcClickPower, calcWisdomEarned, calcWisdomBonus,
} from "./static/js/gameCalc.js";

// --- Shared test tuning (mirrors real TUNING shape, pinned values) ---
const tuning = {
  production: { baseClickYield: 1, tickMs: 200 },
  producers: {
    sapling:     { baseCost: 10,    costGrowth: 1.15, baseRate: 0.2 },
    orchard_row: { baseCost: 100,   costGrowth: 1.15, baseRate: 1 },
    drone:       { baseCost: 1100,  costGrowth: 1.15, baseRate: 8 },
    guac_lab:    { baseCost: 12000, costGrowth: 1.15, baseRate: 47 },
  },
  upgrades: {
    strong_thumb:       { cost: 100,  unlockAt: 0, clickMult: 2 },
    iron_thumb:         { cost: 500,  unlockAt: 0, clickMult: 2 },
    efficient_saplings: { cost: 1000, unlockAt: 10, producerId: "sapling", prodMult: 2 },
    drip_irrigation:    { cost: 5000, unlockAt: 5,  producerId: "orchard_row", prodMult: 2 },
    global_boost_1:     { cost: 10000, unlockAt: 0, globalMult: 1.5 },
    global_boost_2:     { cost: 500000, unlockAt: 0, globalMult: 2 },
    wisdom_boost:       { cost: 1e6, unlockAt: 0, wisdomMult: 0.5 },
  },
  prestige: {
    unlockThreshold: 1e6,
    wisdomDivisor: 1e6,
    wisdomExponent: 0.5,
    wisdomMultPerPoint: 0.02,
  },
};

// ---------- Existing function tests ----------

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

// ---------- New function tests ----------

describe("formatNumber", () => {
  it("shows 1 decimal for values under 10", () => {
    expect(formatNumber(0.2)).toBe("0.2");
  });

  it("drops trailing zero for whole numbers under 10", () => {
    expect(formatNumber(5)).toBe("5");
  });

  it("returns plain integer for values 10-999", () => {
    expect(formatNumber(42)).toBe("42");
  });

  it("floors fractional values 10-999", () => {
    expect(formatNumber(999.9)).toBe("999");
  });

  it("adds commas to thousands", () => {
    expect(formatNumber(1500)).toBe("1,500");
  });

  it("adds commas to millions", () => {
    expect(formatNumber(2500000)).toBe("2,500,000");
  });

  it("returns 0 for zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
});

describe("calcProducerCost", () => {
  it("returns baseCost when owning 0", () => {
    expect(calcProducerCost("sapling", 0, tuning)).toBe(10);
  });

  it("scales cost by costGrowth^owned", () => {
    // 10 * 1.15^1 = 11.5 → floor → 11
    expect(calcProducerCost("sapling", 1, tuning)).toBe(11);
  });

  it("grows exponentially", () => {
    // 10 * 1.15^10 ≈ 40.45 → 40
    expect(calcProducerCost("sapling", 10, tuning)).toBe(40);
  });

  it("works for higher-tier producers", () => {
    expect(calcProducerCost("orchard_row", 0, tuning)).toBe(100);
    // 100 * 1.15^5 ≈ 201.13 → 201
    expect(calcProducerCost("orchard_row", 5, tuning)).toBe(201);
  });
});

describe("calcProducerUnitRate", () => {
  it("returns base rate with no upgrades", () => {
    expect(calcProducerUnitRate("sapling", {}, tuning)).toBe(0.2);
  });

  it("doubles rate with matching producer upgrade", () => {
    expect(calcProducerUnitRate("sapling", { efficient_saplings: true }, tuning)).toBe(0.4);
  });

  it("ignores upgrades for other producers", () => {
    expect(calcProducerUnitRate("sapling", { drip_irrigation: true }, tuning)).toBe(0.2);
  });

  it("applies upgrade to correct producer", () => {
    expect(calcProducerUnitRate("orchard_row", { drip_irrigation: true }, tuning)).toBe(2);
  });
});

describe("calcTotalAps", () => {
  it("returns 0 with no producers", () => {
    const producers = { sapling: 0, orchard_row: 0, drone: 0, guac_lab: 0 };
    expect(calcTotalAps(producers, {}, 0, tuning)).toBe(0);
  });

  it("sums production from multiple producer types", () => {
    const producers = { sapling: 5, orchard_row: 2, drone: 0, guac_lab: 0 };
    // 5 * 0.2 + 2 * 1 = 1 + 2 = 3
    expect(calcTotalAps(producers, {}, 0, tuning)).toBe(3);
  });

  it("applies global multiplier upgrade", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // 10 * 0.2 = 2, * 1.5 global = 3
    expect(calcTotalAps(producers, { global_boost_1: true }, 0, tuning)).toBe(3);
  });

  it("stacks global multipliers", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // 10 * 0.2 = 2, * 1.5 * 2 = 6
    expect(calcTotalAps(producers, { global_boost_1: true, global_boost_2: true }, 0, tuning)).toBe(6);
  });

  it("applies wisdom bonus", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // base = 2, wisdom bonus = 1 + 10 * 0.02 = 1.2, total = 2.4
    expect(calcTotalAps(producers, {}, 10, tuning)).toBeCloseTo(2.4);
  });
});

describe("calcClickPower", () => {
  it("returns base click yield with no upgrades", () => {
    expect(calcClickPower({}, 0, tuning)).toBe(1);
  });

  it("doubles with strong_thumb", () => {
    expect(calcClickPower({ strong_thumb: true }, 0, tuning)).toBe(2);
  });

  it("stacks click multipliers", () => {
    expect(calcClickPower({ strong_thumb: true, iron_thumb: true }, 0, tuning)).toBe(4);
  });

  it("applies global multiplier", () => {
    // 1 * 1.5 = 1.5
    expect(calcClickPower({ global_boost_1: true }, 0, tuning)).toBe(1.5);
  });

  it("applies wisdom bonus to clicks", () => {
    // base 1, wisdom bonus 1 + 5 * 0.02 = 1.10
    expect(calcClickPower({}, 5, tuning)).toBeCloseTo(1.1);
  });

  it("stacks all multipliers", () => {
    // 1 * 2 (strong) * 2 (iron) = 4, * 1.5 (global) = 6, * 1.2 (10 wisdom) = 7.2
    expect(calcClickPower(
      { strong_thumb: true, iron_thumb: true, global_boost_1: true }, 10, tuning
    )).toBeCloseTo(7.2);
  });
});

describe("calcWisdomEarned", () => {
  it("returns 0 below threshold", () => {
    expect(calcWisdomEarned(999999, tuning)).toBe(0);
  });

  it("returns 1 at exactly threshold (1e6)", () => {
    // floor((1e6 / 1e6)^0.5) = floor(1) = 1
    expect(calcWisdomEarned(1e6, tuning)).toBe(1);
  });

  it("returns floor of sqrt scaling", () => {
    // floor((4e6 / 1e6)^0.5) = floor(2) = 2
    expect(calcWisdomEarned(4e6, tuning)).toBe(2);
  });

  it("grows with sqrt of total", () => {
    // floor((100e6 / 1e6)^0.5) = floor(10) = 10
    expect(calcWisdomEarned(100e6, tuning)).toBe(10);
  });

  it("returns 0 at zero avocados", () => {
    expect(calcWisdomEarned(0, tuning)).toBe(0);
  });
});

describe("calcWisdomBonus", () => {
  it("returns 1.0 with no wisdom", () => {
    expect(calcWisdomBonus(0, {}, tuning)).toBe(1);
  });

  it("adds 2% per wisdom point", () => {
    // 1 + 10 * 0.02 = 1.20
    expect(calcWisdomBonus(10, {}, tuning)).toBeCloseTo(1.2);
  });

  it("wisdom_boost upgrade increases effectiveness", () => {
    // with wisdom_boost: mult = 0.02 + 0.5 = 0.52
    // 1 + 10 * 0.52 = 6.2
    expect(calcWisdomBonus(10, { wisdom_boost: true }, tuning)).toBeCloseTo(6.2);
  });

  it("returns 1.0 with wisdom_boost but no wisdom points", () => {
    expect(calcWisdomBonus(0, { wisdom_boost: true }, tuning)).toBe(1);
  });
});

describe("canPrestige", () => {
  it("returns false below threshold", () => {
    expect(canPrestige(999999, tuning)).toBe(false);
  });

  it("returns true at exactly threshold", () => {
    expect(canPrestige(1e6, tuning)).toBe(true);
  });

  it("returns true above threshold", () => {
    expect(canPrestige(5e6, tuning)).toBe(true);
  });

  it("returns false at zero", () => {
    expect(canPrestige(0, tuning)).toBe(false);
  });
});
