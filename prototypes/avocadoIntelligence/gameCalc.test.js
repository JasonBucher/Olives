import { describe, it, expect } from "vitest";
import {
  clamp, formatRate, getDisplayCount, rollWeighted, canPrestige,
  formatNumber, calcProducerCost, calcProducerUnitRate,
  calcTotalAps, calcClickPower, calcWisdomEarned, calcWisdomBonus,
  calcGuacMultiplier, calcGuacConsumption, calcGuacProduction,
  calcEffectiveConsumeExponent, calcEffectiveProduceExponent,
  calcEffectiveBaseProduction,
} from "./static/js/gameCalc.js";

// --- Shared test tuning (mirrors real TUNING shape, pinned values) ---
const tuning = {
  production: { baseClickYield: 1, tickMs: 200 },
  producers: {
    sapling:     { baseCost: 10,    costGrowth: 1.15, baseRate: 0.2 },
    orchard_row: { baseCost: 100,   costGrowth: 1.15, baseRate: 1 },
    influencer:  { baseCost: 5,     costGrowth: 1.11, baseRate: 0, clickBonus: 0.1 },
    drone:       { baseCost: 1100,  costGrowth: 1.15, baseRate: 8 },
    guac_lab:    { baseCost: 12000, costGrowth: 1.15, baseRate: 47 },
  },
  guac: {
    baseConsumption: 50,
    consumeExponent: 0.85,
    consumeExponentFloor: 0.5,
    baseProduction: 1,
    produceExponent: 1.0,
    multiplierPerSqrt: 0.10,
    labUnlockAps: 50,
  },
  upgrades: {
    strong_thumb:       { cost: 100,  unlockAt: 0, clickMult: 2 },
    iron_thumb:         { cost: 500,  unlockAt: 0, clickMult: 2 },
    efficient_saplings: { cost: 1000, unlockAt: 10, producerId: "sapling", prodMult: 2 },
    drip_irrigation:    { cost: 5000, unlockAt: 5,  producerId: "orchard_row", prodMult: 2 },
    global_boost_1:     { cost: 10000, unlockAt: 0, globalMult: 1.5 },
    global_boost_2:     { cost: 500000, unlockAt: 0, globalMult: 2 },
    wisdom_boost:       { cost: 1e6, unlockAt: 0, wisdomMult: 0.05 },
    guac_recycler:      { cost: 50000,  unlockAt: 5,  producerId: "guac_lab", consumeExpDelta: -0.05 },
    bulk_fermentation:  { cost: 200000, unlockAt: 10, producerId: "guac_lab", consumeExpDelta: -0.05 },
    superlinear_synth:  { cost: 100000, guacUnlockAt: 25,  produceExpDelta: +0.05 },
    exponential_ripen:  { cost: 500000, guacUnlockAt: 100, produceExpDelta: +0.10 },
    concentrate_proto:  { cost: 75000,  unlockAt: 10, producerId: "guac_lab", baseProdMult: 1.5 },
    throughput_click_1: { cost: 500,   unlockAt: 1,  producerId: "influencer", apsPctPerClick: 0.01 },
    throughput_click_2: { cost: 5000,  unlockAt: 5,  producerId: "influencer", apsPctPerClick: 0.02 },
    throughput_click_3: { cost: 50000, unlockAt: 25, producerId: "influencer", apsPctPerClick: 0.05 },
  },
  prestige: {
    unlockThreshold: 1e6,
    divisor: 1000,
    wisdomMultPerPoint: 0.10,
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
  it("drops .0 for whole numbers", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(5)).toBe("5");
    expect(formatNumber(42)).toBe("42");
  });

  it("shows one decimal when non-zero", () => {
    expect(formatNumber(0.2)).toBe("0.2");
    expect(formatNumber(3.7)).toBe("3.7");
  });

  it("rounds to one decimal", () => {
    expect(formatNumber(3.75)).toBe("3.8");
  });

  it("adds commas to thousands", () => {
    expect(formatNumber(1500)).toBe("1,500");
    expect(formatNumber(1500.3)).toBe("1,500.3");
  });

  it("adds commas to millions", () => {
    expect(formatNumber(2500000)).toBe("2,500,000");
  });
});

describe("calcProducerCost", () => {
  it("returns baseCost when owning 0", () => {
    expect(calcProducerCost("sapling", 0, tuning)).toBe(10);
  });

  it("scales cost by costGrowth^owned", () => {
    expect(calcProducerCost("sapling", 1, tuning)).toBe(11);
  });

  it("grows exponentially", () => {
    expect(calcProducerCost("sapling", 10, tuning)).toBe(40);
  });

  it("works for higher-tier producers", () => {
    expect(calcProducerCost("orchard_row", 0, tuning)).toBe(100);
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

describe("calcGuacMultiplier", () => {
  it("returns 1.0 with no guac", () => {
    expect(calcGuacMultiplier(0, tuning)).toBe(1);
  });

  it("applies sqrt scaling", () => {
    // 1 + sqrt(100) * 0.10 = 1 + 10 * 0.10 = 2.0
    expect(calcGuacMultiplier(100, tuning)).toBe(2);
  });

  it("grows with diminishing returns", () => {
    // 1 + sqrt(400) * 0.10 = 1 + 20 * 0.10 = 3.0
    expect(calcGuacMultiplier(400, tuning)).toBe(3);
  });

  it("handles small guac amounts", () => {
    // 1 + sqrt(1) * 0.10 = 1.10
    expect(calcGuacMultiplier(1, tuning)).toBeCloseTo(1.1);
  });
});

describe("calcGuacConsumption", () => {
  it("returns 0 with no labs", () => {
    expect(calcGuacConsumption(0, tuning)).toBe(0);
  });

  it("returns base consumption with 1 lab", () => {
    // 50 * 1^0.85 = 50
    expect(calcGuacConsumption(1, tuning)).toBe(50);
  });

  it("scales sublinearly with more labs", () => {
    // 50 * 10^0.85 ≈ 354
    const c10 = calcGuacConsumption(10, tuning);
    expect(c10).toBeCloseTo(354, 0);
    // Should be less than linear (500)
    expect(c10).toBeLessThan(500);
  });

  it("scales further sublinearly at 100 labs", () => {
    // 50 * 100^0.85 ≈ 2506
    const c100 = calcGuacConsumption(100, tuning);
    expect(c100).toBeCloseTo(2506, 0);
    // Should be less than linear (5000)
    expect(c100).toBeLessThan(5000);
  });
});

describe("calcGuacConsumption — exponent floor", () => {
  it("clamps exponent at floor when pushed below", () => {
    const lowExpTuning = {
      ...tuning,
      guac: { ...tuning.guac, consumeExponent: 0.2 },  // below floor of 0.5
    };
    // Should use floor (0.5), not 0.2
    // 50 * 10^0.5 ≈ 158.1
    const result = calcGuacConsumption(10, lowExpTuning);
    expect(result).toBeCloseTo(50 * Math.pow(10, 0.5), 0);
  });
});

describe("calcGuacProduction", () => {
  it("returns 0 with no labs", () => {
    expect(calcGuacProduction(0, tuning)).toBe(0);
  });

  it("returns 1 guac/sec with 1 lab (produceExponent=1)", () => {
    // 1 * 1^1 = 1
    expect(calcGuacProduction(1, tuning)).toBe(1);
  });

  it("scales linearly with produceExponent=1", () => {
    // 1 * 10^1 = 10
    expect(calcGuacProduction(10, tuning)).toBe(10);
  });

  it("respects custom produceExponent", () => {
    const superTuning = {
      ...tuning,
      guac: { ...tuning.guac, produceExponent: 1.1 },
    };
    // 1 * 10^1.1 ≈ 12.59
    expect(calcGuacProduction(10, superTuning)).toBeCloseTo(12.59, 1);
  });
});

describe("calcTotalAps", () => {
  it("returns 0 with no producers", () => {
    const producers = { sapling: 0, orchard_row: 0, drone: 0, guac_lab: 0 };
    expect(calcTotalAps(producers, {}, 0, 0, tuning)).toBe(0);
  });

  it("sums production from multiple producer types", () => {
    const producers = { sapling: 5, orchard_row: 2, drone: 0, guac_lab: 0 };
    // 5 * 0.2 + 2 * 1 = 3
    expect(calcTotalAps(producers, {}, 0, 0, tuning)).toBe(3);
  });

  it("applies global multiplier upgrade", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // 10 * 0.2 = 2, * 1.5 = 3
    expect(calcTotalAps(producers, { global_boost_1: true }, 0, 0, tuning)).toBe(3);
  });

  it("stacks global multipliers", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // 10 * 0.2 = 2, * 1.5 * 2 = 6
    expect(calcTotalAps(producers, { global_boost_1: true, global_boost_2: true }, 0, 0, tuning)).toBe(6);
  });

  it("applies wisdom bonus", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // base = 2, wisdom = 1 + 10 * 0.10 = 2.0, total = 4
    expect(calcTotalAps(producers, {}, 10, 0, tuning)).toBeCloseTo(4);
  });

  it("applies guac multiplier", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // base = 2, guac mult = 1 + sqrt(100) * 0.10 = 2.0, total = 4
    expect(calcTotalAps(producers, {}, 0, 100, tuning)).toBeCloseTo(4);
  });

  it("stacks guac and wisdom multipliers", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // base = 2, wisdom = 2.0, guac = 2.0, total = 2 * 2 * 2 = 8
    expect(calcTotalAps(producers, {}, 10, 100, tuning)).toBeCloseTo(8);
  });
});

describe("calcClickPower", () => {
  const noProducers = { sapling: 0, orchard_row: 0, influencer: 0, drone: 0, guac_lab: 0 };

  it("returns base click yield with no upgrades", () => {
    expect(calcClickPower({}, noProducers, 0, 0, 0, tuning)).toBe(1);
  });

  it("doubles with strong_thumb", () => {
    expect(calcClickPower({ strong_thumb: true }, noProducers, 0, 0, 0, tuning)).toBe(2);
  });

  it("stacks click multipliers", () => {
    expect(calcClickPower({ strong_thumb: true, iron_thumb: true }, noProducers, 0, 0, 0, tuning)).toBe(4);
  });

  it("applies global multiplier", () => {
    expect(calcClickPower({ global_boost_1: true }, noProducers, 0, 0, 0, tuning)).toBe(1.5);
  });

  it("applies wisdom bonus to clicks", () => {
    // base 1, wisdom = 1 + 5 * 0.10 = 1.50
    expect(calcClickPower({}, noProducers, 5, 0, 0, tuning)).toBeCloseTo(1.5);
  });

  it("applies guac multiplier to clicks", () => {
    // base 1, guac = 1 + sqrt(100) * 0.10 = 2.0
    expect(calcClickPower({}, noProducers, 0, 100, 0, tuning)).toBeCloseTo(2);
  });

  it("stacks all multipliers", () => {
    // 1 * 2 (strong) * 2 (iron) = 4, * 1.5 (global) = 6, * 2 (10 wisdom) = 12, * 2 (100 guac) = 24
    expect(calcClickPower(
      { strong_thumb: true, iron_thumb: true, global_boost_1: true }, noProducers, 10, 100, 0, tuning
    )).toBeCloseTo(24);
  });

  // --- Influencer flat click bonus ---
  it("adds flat click bonus from influencers", () => {
    // base 1 + 4 * 0.1 = 1.4
    const producers = { ...noProducers, influencer: 4 };
    expect(calcClickPower({}, producers, 0, 0, 0, tuning)).toBeCloseTo(1.4);
  });

  it("influencer bonus is multiplied by click upgrades", () => {
    // (1 + 2*0.1) * 2 (strong_thumb) = 1.2 * 2 = 2.4
    const producers = { ...noProducers, influencer: 2 };
    expect(calcClickPower({ strong_thumb: true }, producers, 0, 0, 0, tuning)).toBeCloseTo(2.4);
  });

  it("influencer bonus stacks with all multipliers", () => {
    // base 1 + 10*0.1 = 2, * 2 (strong) = 4, * 1.5 (global) = 6
    const producers = { ...noProducers, influencer: 10 };
    expect(calcClickPower(
      { strong_thumb: true, global_boost_1: true }, producers, 0, 0, 0, tuning
    )).toBeCloseTo(6);
  });

  // --- Throughput Clicking (APS % bonus, highest tier wins) ---
  it("adds APS percentage from throughput_click_1", () => {
    // base 1, aps 100, 1% = +1, total = 2
    expect(calcClickPower({ throughput_click_1: true }, noProducers, 0, 0, 100, tuning)).toBe(2);
  });

  it("highest throughput tier wins (not additive)", () => {
    // base 1, aps 100, max(1%, 2%, 5%) = 5% = +5, total = 6
    const upgrades = { throughput_click_1: true, throughput_click_2: true, throughput_click_3: true };
    expect(calcClickPower(upgrades, noProducers, 0, 0, 100, tuning)).toBe(6);
  });

  it("throughput bonus is zero when aps is zero", () => {
    expect(calcClickPower({ throughput_click_1: true }, noProducers, 0, 0, 0, tuning)).toBe(1);
  });

  it("combines influencer bonus and throughput clicking", () => {
    // base 1 + 4*0.1 = 1.4 (from influencers)
    // clickMult: * 2 (strong_thumb) = 2.8
    // APS bonus: 100 * 0.01 = +1 → 3.8
    // global/wisdom/guac = 1 each → 3.8
    const producers = { ...noProducers, influencer: 4 };
    expect(calcClickPower(
      { strong_thumb: true, throughput_click_1: true }, producers, 0, 0, 100, tuning
    )).toBeCloseTo(3.8);
  });
});

describe("calcWisdomEarned", () => {
  it("returns 0 below threshold", () => {
    expect(calcWisdomEarned(999999, tuning)).toBe(0);
  });

  it("returns 1 at exactly threshold (1e6)", () => {
    // floor(sqrt(1e6) / 1000) = floor(1000 / 1000) = 1
    expect(calcWisdomEarned(1e6, tuning)).toBe(1);
  });

  it("returns floor of sqrt scaling", () => {
    // floor(sqrt(4e6) / 1000) = floor(2000 / 1000) = 2
    expect(calcWisdomEarned(4e6, tuning)).toBe(2);
  });

  it("grows with sqrt of total", () => {
    // floor(sqrt(100e6) / 1000) = floor(10000 / 1000) = 10
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

  it("adds 10% per wisdom point", () => {
    // 1 + 10 * 0.10 = 2.0
    expect(calcWisdomBonus(10, {}, tuning)).toBeCloseTo(2);
  });

  it("wisdom_boost upgrade increases effectiveness", () => {
    // with wisdom_boost: mult = 0.10 + 0.05 = 0.15
    // 1 + 10 * 0.15 = 2.5
    expect(calcWisdomBonus(10, { wisdom_boost: true }, tuning)).toBeCloseTo(2.5);
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

// ---------- Effective exponent tests ----------

describe("calcEffectiveConsumeExponent", () => {
  it("returns base exponent with no modifiers", () => {
    expect(calcEffectiveConsumeExponent(0, {}, {}, 0, tuning)).toBe(0.85);
  });

  it("reduces by 0.01 per refinery", () => {
    expect(calcEffectiveConsumeExponent(5, {}, {}, 0, tuning)).toBeCloseTo(0.80);
  });

  it("applies guac_recycler upgrade reduction", () => {
    expect(calcEffectiveConsumeExponent(0, { guac_recycler: true }, {}, 0, tuning)).toBeCloseTo(0.80);
  });

  it("stacks refineries and upgrades", () => {
    // 0.85 - 5*0.01 - 0.05 = 0.75
    expect(calcEffectiveConsumeExponent(5, { guac_recycler: true }, {}, 0, tuning)).toBeCloseTo(0.75);
  });

  it("stacks both consume upgrades", () => {
    // 0.85 - 0.05 - 0.05 = 0.75
    expect(calcEffectiveConsumeExponent(0, { guac_recycler: true, bulk_fermentation: true }, {}, 0, tuning)).toBeCloseTo(0.75);
  });

  it("clamps at floor", () => {
    // 35 refineries: 0.85 - 0.35 = 0.50 (at floor)
    expect(calcEffectiveConsumeExponent(35, {}, {}, 0, tuning)).toBe(0.50);
  });

  it("does not go below floor even with many refineries", () => {
    expect(calcEffectiveConsumeExponent(100, {}, {}, 0, tuning)).toBe(0.50);
  });

  it("applies Guac Memory II wisdom unlock", () => {
    // 0.85 - 0.01 * 5 prestiges = 0.80
    expect(calcEffectiveConsumeExponent(0, {}, { guac_memory_2: true }, 5, tuning)).toBeCloseTo(0.80);
  });

  it("stacks refineries, upgrades, and wisdom unlock", () => {
    // 0.85 - 5*0.01 - 0.05 - 0.01*3 = 0.85 - 0.05 - 0.05 - 0.03 = 0.72
    expect(calcEffectiveConsumeExponent(5, { guac_recycler: true }, { guac_memory_2: true }, 3, tuning)).toBeCloseTo(0.72);
  });

  it("Infinite Guac Theory lowers floor to 0.35", () => {
    // With infinite_guac, floor is 0.35 instead of 0.50
    expect(calcEffectiveConsumeExponent(100, {}, { infinite_guac: true }, 0, tuning)).toBe(0.35);
  });

  it("Infinite Guac Theory allows going below old floor", () => {
    // 0.85 - 40*0.01 = 0.45, below old floor 0.50 but above new floor 0.35
    expect(calcEffectiveConsumeExponent(40, {}, { infinite_guac: true }, 0, tuning)).toBeCloseTo(0.45);
  });
});

describe("calcEffectiveProduceExponent", () => {
  it("returns base exponent with no modifiers", () => {
    expect(calcEffectiveProduceExponent({}, {}, 0, tuning)).toBe(1.0);
  });

  it("applies superlinear_synth upgrade", () => {
    expect(calcEffectiveProduceExponent({ superlinear_synth: true }, {}, 0, tuning)).toBeCloseTo(1.05);
  });

  it("stacks both produce upgrades", () => {
    // 1.0 + 0.05 + 0.10 = 1.15
    expect(calcEffectiveProduceExponent({ superlinear_synth: true, exponential_ripen: true }, {}, 0, tuning)).toBeCloseTo(1.15);
  });

  it("applies Guac Memory I wisdom unlock", () => {
    // 1.0 + 0.02 * 5 = 1.10
    expect(calcEffectiveProduceExponent({}, { guac_memory_1: true }, 5, tuning)).toBeCloseTo(1.10);
  });

  it("stacks upgrades and wisdom unlock", () => {
    // 1.0 + 0.05 + 0.10 + 0.02*3 = 1.21
    expect(calcEffectiveProduceExponent(
      { superlinear_synth: true, exponential_ripen: true },
      { guac_memory_1: true }, 3, tuning
    )).toBeCloseTo(1.21);
  });

  it("wisdom unlock has no effect with 0 prestiges", () => {
    expect(calcEffectiveProduceExponent({}, { guac_memory_1: true }, 0, tuning)).toBe(1.0);
  });
});

describe("calcEffectiveBaseProduction", () => {
  it("returns base production with no upgrades", () => {
    expect(calcEffectiveBaseProduction({}, tuning)).toBe(1);
  });

  it("applies concentrate_proto multiplier", () => {
    expect(calcEffectiveBaseProduction({ concentrate_proto: true }, tuning)).toBe(1.5);
  });
});

describe("calcGuacConsumption — effective tuning", () => {
  it("uses effective exponent when extra args provided", () => {
    // 5 refineries: exp = 0.80
    // 50 * 10^0.80
    const expected = 50 * Math.pow(10, 0.80);
    const result = calcGuacConsumption(10, tuning, 5, {}, {}, 0);
    expect(result).toBeCloseTo(expected, 0);
  });

  it("still works with old 2-arg signature", () => {
    // 50 * 10^0.85
    const expected = 50 * Math.pow(10, 0.85);
    expect(calcGuacConsumption(10, tuning)).toBeCloseTo(expected, 0);
  });
});

describe("calcGuacProduction — effective tuning", () => {
  it("uses effective exponent and base when extra args provided", () => {
    // superlinear_synth: exp = 1.05, concentrate_proto: base = 1.5
    // 1.5 * 10^1.05
    const expected = 1.5 * Math.pow(10, 1.05);
    const result = calcGuacProduction(10, tuning, { superlinear_synth: true, concentrate_proto: true }, {}, 0);
    expect(result).toBeCloseTo(expected, 0);
  });

  it("still works with old 2-arg signature", () => {
    expect(calcGuacProduction(10, tuning)).toBe(10);
  });
});
