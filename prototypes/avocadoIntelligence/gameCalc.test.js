import { describe, it, expect } from "vitest";
import {
  clamp, formatRate, getDisplayCount, rollWeighted, canPrestige,
  formatNumber, calcProducerCost, calcProducerUnitRate,
  calcBaseAps, calcTotalAps, calcClickPower, calcWisdomEarned, calcWisdomBonus,
  calcGuacMultiplier, calcGuacConsumption, calcGuacProduction,
  calcEffectiveConsumeExponent, calcEffectiveProduceExponent,
  calcEffectiveBaseProduction,
  calcBenchmarkBonus, calcHyperparamModifiers,
  calcDistillationCost, canDistill, calcDistillationBonus,
} from "./static/js/gameCalc.js";

// --- Shared test tuning (mirrors real TUNING shape, pinned values) ---
const tuning = {
  production: { baseClickYield: 1, tickMs: 200 },
  producers: {
    sapling:         { baseCost: 10,    costGrowth: 1.15, baseRate: 0.2 },
    seed_bank:       { baseCost: 35,    costGrowth: 1.15, baseRate: 0.5 },
    orchard_row:     { baseCost: 100,   costGrowth: 1.15, baseRate: 1 },
    compost_bin:     { baseCost: 400,   costGrowth: 1.15, baseRate: 3 },
    drone:           { baseCost: 1100,  costGrowth: 1.15, baseRate: 8 },
    greenhouse:      { baseCost: 4000,  costGrowth: 1.15, baseRate: 18 },
    harvest_bot:     { baseCost: 45000, costGrowth: 1.15, baseRate: 80 },
    guac_lab:        { baseCost: 12000, costGrowth: 1.15, baseRate: 47 },
    guac_refinery:   { baseCost: 50000, costGrowth: 1.15, baseRate: 0 },
    guac_centrifuge: { baseCost: 200000, costGrowth: 1.15, baseRate: 0 },
    exchange:        { baseCost: 130000, costGrowth: 1.15, baseRate: 260 },
    data_grove:      { baseCost: 350000, costGrowth: 1.15, baseRate: 450 },
    attention_head:  { baseCost: 800000, costGrowth: 1.15, baseRate: 900 },
    pit_miner:       { baseCost: 1.4e6,  costGrowth: 1.15, baseRate: 1400 },
    gpu_cluster:     { baseCost: 5e6,    costGrowth: 1.15, baseRate: 2800 },
    neural_pit:      { baseCost: 2e7,    costGrowth: 1.15, baseRate: 7800 },
    synth_orchard:   { baseCost: 3e7,    costGrowth: 1.15, baseRate: 11000 },
    transformer:     { baseCost: 1.5e8,  costGrowth: 1.15, baseRate: 28000 },
    orchard_cloud:   { baseCost: 3.3e8,  costGrowth: 1.15, baseRate: 44000 },
    quantum_grove:   { baseCost: 5e8,    costGrowth: 1.15, baseRate: 55000 },
    agi_nexus:       { baseCost: 5e9,    costGrowth: 1.15, baseRate: 180000 },
    dyson_orchard:   { baseCost: 8e10,   costGrowth: 1.15, baseRate: 600000 },
    omega_harvest:   { baseCost: 1e12,   costGrowth: 1.15, baseRate: 2500000 },
    foundation_model:{ baseCost: 5e10,   costGrowth: 1.15, baseRate: 200000 },
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
    efficient_saplings: { cost: 40,   unlockAt: 5,  producerId: "sapling", prodMult: 2 },
    drip_irrigation:    { cost: 402,  unlockAt: 5,  producerId: "orchard_row", prodMult: 2 },
    global_boost_1:     { cost: 10000, unlockAt: 0, globalMult: 1.5 },
    global_boost_2:     { cost: 500000, unlockAt: 0, globalMult: 2 },
    global_boost_3:     { cost: 5e7, unlockAt: 0, globalMult: 2 },
    wisdom_boost:       { cost: 1e6, unlockAt: 0, wisdomMult: 0.05 },
    guac_recycler:      { cost: 50000,  unlockAt: 5,  producerId: "guac_lab", consumeExpDelta: -0.05 },
    bulk_fermentation:  { cost: 200000, unlockAt: 10, producerId: "guac_lab", consumeExpDelta: -0.05 },
    superlinear_synth:  { cost: 100000, guacUnlockAt: 25,  produceExpDelta: +0.05 },
    exponential_ripen:  { cost: 500000, guacUnlockAt: 100, produceExpDelta: +0.10 },
    concentrate_proto:  { cost: 75000,  unlockAt: 10, producerId: "guac_lab", baseProdMult: 1.5 },
    throughput_click_1: { cost: 500,   apsUnlockAt: 1,   apsPctPerClick: 0.03 },
    throughput_click_2: { cost: 5000,  apsUnlockAt: 10,  apsPctPerClick: 0.06 },
    throughput_click_3: { cost: 50000, apsUnlockAt: 100, apsPctPerClick: 0.10 },
    attention_focus:    { cost: 3218171,   unlockAt: 5,  producerId: "attention_head", prodMult: 2 },
    transformer_scale:  { cost: 603407156, unlockAt: 5,  producerId: "transformer", prodMult: 2 },
    seed_catalog:       { cost: 140,       unlockAt: 5,  producerId: "seed_bank", prodMult: 2 },
    hot_compost:        { cost: 1609,      unlockAt: 5,  producerId: "compost_bin", prodMult: 2 },
    climate_control:    { cost: 16090,     unlockAt: 5,  producerId: "greenhouse", prodMult: 2 },
    harvest_fleet:      { cost: 181022,    unlockAt: 5,  producerId: "harvest_bot", prodMult: 2 },
    data_lake:          { cost: 1407950,   unlockAt: 5,  producerId: "data_grove", prodMult: 2 },
    gpu_overclock:      { cost: 20113571,  unlockAt: 5,  producerId: "gpu_cluster", prodMult: 2 },
    drone_swarm:        { cost: 4424,  unlockAt: 5,  producerId: "drone",       prodMult: 2 },
    // Multi-tier upgrades for stacking tests
    sapling_t2:         { cost: 1646,        unlockAt: 25,  producerId: "sapling",      prodMult: 2 },
    sapling_t3:         { cost: 108366,      unlockAt: 50,  producerId: "sapling",      prodMult: 2 },
    sapling_t4:         { cost: 176147018,   unlockAt: 100, producerId: "sapling",      prodMult: 2 },
    sapling_t5:         { cost: 254510701921, unlockAt: 150, producerId: "sapling",     prodMult: 2 },
    drone_t2:           { cost: 181054,      unlockAt: 25,  producerId: "drone",        prodMult: 2 },
    drone_t3:           { cost: 11920232,    unlockAt: 50,  producerId: "drone",        prodMult: 2 },
    gpu_cluster_t2:     { cost: 822973815,       unlockAt: 25,  producerId: "gpu_cluster",  prodMult: 2 },
    gpu_cluster_t3:     { cost: 54182872079,     unlockAt: 50,  producerId: "gpu_cluster",  prodMult: 2 },
    gpu_cluster_t4:     { cost: 88073508802520,  unlockAt: 100, producerId: "gpu_cluster",  prodMult: 2 },
    agi_nexus_t2:       { cost: 822973815495, unlockAt: 25, producerId: "agi_nexus",    prodMult: 2 },
  },
  benchmarks: {
    hello_world:      { title: "Hello, World", globalMult: 0.02 },
    overfitting:      { title: "Overfitting",  clickMult: 0.05 },
    guac_online:      { title: "Guac Online",  guacProdMult: 0.05 },
    loss_convergence: { title: "Loss Convergence", guacMult: 0.03 },
    convergence:      { title: "Convergence",  wisdomMult: 0.05 },
    no_bonus:         { title: "No Bonus" },
  },
  hyperparams: {
    cooldownMs: 180000,
    warmupDurationMs: 60000,
    learningRate: {
      conservative: { label: "Conservative", apsMult: 1, guacConsumeMult: 1 },
      aggressive:   { label: "Aggressive", apsMult: 1.3, guacConsumeMult: 1.2 },
      warmup:       { label: "Warmup", apsMult: 0.85, apsMultAfterWarmup: 1.2 },
    },
    batchSize: {
      small: { label: "Small", apsMult: 1, clickMult: 1 },
      large: { label: "Large", apsMult: 1.5, clickMult: 0.7 },
      micro: { label: "Micro", apsMult: 0.8, clickMult: 1.8 },
    },
    regularization: {
      none:         { label: "None" },
      dropout:      { label: "Dropout", freezeGuacMult: true, wisdomMult: 1.15 },
      weight_decay: { label: "Weight Decay", costMult: 0.9, globalMult: 0.95 },
    },
  },
  prestige: {
    unlockThreshold: 1e7,
    divisor: 1000,
    wisdomMultPerPoint: 0.10,
  },
  distillation: {
    costs: [100, 250, 500, 1000, 2000],
    bonuses: [
      { apsMult: 1.5, wisdomEarnMult: 1.2, desc: "test" },
      { baseClickBonus: 1, guacProdMult: 1.3, desc: "test" },
      { costMult: 0.90, startingWisdom: 2, desc: "test" },
      { multiplierPerSqrtBonus: 0.02, consumeFloorBonus: -0.05, desc: "test" },
      { allProdMult: 2.0, unlocksFoundationModel: true, desc: "test" },
    ],
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

  it("works for attention_head producer", () => {
    expect(calcProducerCost("attention_head", 0, tuning)).toBe(800000);
  });

  it("works for transformer producer", () => {
    expect(calcProducerCost("transformer", 0, tuning)).toBe(150000000);
  });

  it("works for new producers", () => {
    expect(calcProducerCost("seed_bank", 0, tuning)).toBe(35);
    expect(calcProducerCost("gpu_cluster", 0, tuning)).toBe(5000000);
    expect(calcProducerCost("omega_harvest", 0, tuning)).toBe(1000000000000);
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

  it("applies attention_focus to attention_head", () => {
    expect(calcProducerUnitRate("attention_head", { attention_focus: true }, tuning)).toBe(1800);
  });

  it("applies transformer_scale to transformer", () => {
    expect(calcProducerUnitRate("transformer", { transformer_scale: true }, tuning)).toBe(56000);
  });

  it("applies new producer upgrades", () => {
    expect(calcProducerUnitRate("seed_bank", { seed_catalog: true }, tuning)).toBe(1.0);
    expect(calcProducerUnitRate("compost_bin", { hot_compost: true }, tuning)).toBe(6);
    expect(calcProducerUnitRate("greenhouse", { climate_control: true }, tuning)).toBe(36);
    expect(calcProducerUnitRate("harvest_bot", { harvest_fleet: true }, tuning)).toBe(160);
    expect(calcProducerUnitRate("data_grove", { data_lake: true }, tuning)).toBe(900);
    expect(calcProducerUnitRate("gpu_cluster", { gpu_overclock: true }, tuning)).toBe(5600);
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

describe("calcBaseAps", () => {
  it("returns 0 with no producers", () => {
    const producers = { sapling: 0, orchard_row: 0, drone: 0, guac_lab: 0 };
    expect(calcBaseAps(producers, {}, tuning)).toBe(0);
  });

  it("sums production from multiple producer types", () => {
    const producers = { sapling: 5, orchard_row: 2, drone: 0, guac_lab: 0 };
    // 5 * 0.2 + 2 * 1 = 3
    expect(calcBaseAps(producers, {}, tuning)).toBe(3);
  });

  it("applies per-producer upgrades", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // 10 * 0.4 = 4
    expect(calcBaseAps(producers, { efficient_saplings: true }, tuning)).toBe(4);
  });

  it("does not apply global multipliers", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // 10 * 0.2 = 2 (global_boost_1 should NOT affect this)
    expect(calcBaseAps(producers, { global_boost_1: true }, tuning)).toBe(2);
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

  it("applies benchmark global multiplier", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // base = 2, benchmark global = 1 + 0.02 = 1.02, total = 2 * 1.02 = 2.04
    expect(calcTotalAps(producers, {}, 0, 0, tuning, { hello_world: true })).toBeCloseTo(2.04);
  });
});

describe("calcClickPower", () => {
  const noProducers = { sapling: 0, orchard_row: 0, drone: 0, guac_lab: 0 };

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

  // --- Throughput Clicking (base APS % bonus, highest tier wins) ---
  it("adds base APS percentage from throughput_click_1", () => {
    // base 1, baseAps 100, 3% = +3, total = 4
    expect(calcClickPower({ throughput_click_1: true }, noProducers, 0, 0, 100, tuning)).toBe(4);
  });

  it("highest throughput tier wins (not additive)", () => {
    // base 1, baseAps 100, max(3%, 6%, 10%) = 10% = +10, total = 11
    const upgrades = { throughput_click_1: true, throughput_click_2: true, throughput_click_3: true };
    expect(calcClickPower(upgrades, noProducers, 0, 0, 100, tuning)).toBe(11);
  });

  it("throughput bonus is zero when baseAps is zero", () => {
    expect(calcClickPower({ throughput_click_1: true }, noProducers, 0, 0, 0, tuning)).toBe(1);
  });
});

describe("calcWisdomEarned", () => {
  it("returns 0 below threshold", () => {
    expect(calcWisdomEarned(9999999, tuning)).toBe(0);
  });

  it("returns 3 at exactly threshold (1e7)", () => {
    // floor(sqrt(1e7) / 1000) = floor(3162.27 / 1000) = 3
    expect(calcWisdomEarned(1e7, tuning)).toBe(3);
  });

  it("returns floor of sqrt scaling", () => {
    // floor(sqrt(4e7) / 1000) = floor(6324.5 / 1000) = 6
    expect(calcWisdomEarned(4e7, tuning)).toBe(6);
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

  it("applies benchmark wisdom effectiveness bonus", () => {
    // convergence benchmark: wisdomMult = 0.05
    // mult = 0.10 * 1.05 = 0.105
    // 1 + 10 * 0.105 = 2.05
    expect(calcWisdomBonus(10, {}, tuning, { convergence: true })).toBeCloseTo(2.05);
  });
});

describe("canPrestige", () => {
  it("returns false below threshold", () => {
    expect(canPrestige(9999999, tuning)).toBe(false);
  });

  it("returns true at exactly threshold", () => {
    expect(canPrestige(1e7, tuning)).toBe(true);
  });

  it("returns true above threshold", () => {
    expect(canPrestige(5e7, tuning)).toBe(true);
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

// ---------- Benchmark bonus tests ----------

describe("calcBenchmarkBonus", () => {
  it("returns all-1 multipliers with no benchmarks", () => {
    const b = calcBenchmarkBonus({}, tuning);
    expect(b.globalMult).toBe(1);
    expect(b.clickMult).toBe(1);
    expect(b.guacProdMult).toBe(1);
    expect(b.guacMult).toBe(1);
    expect(b.wisdomMult).toBe(1);
  });

  it("sums global multiplier from benchmarks", () => {
    const b = calcBenchmarkBonus({ hello_world: true }, tuning);
    expect(b.globalMult).toBeCloseTo(1.02);
  });

  it("sums click multiplier", () => {
    const b = calcBenchmarkBonus({ overfitting: true }, tuning);
    expect(b.clickMult).toBeCloseTo(1.05);
  });

  it("sums guac production multiplier", () => {
    const b = calcBenchmarkBonus({ guac_online: true }, tuning);
    expect(b.guacProdMult).toBeCloseTo(1.05);
  });

  it("sums guac multiplier", () => {
    const b = calcBenchmarkBonus({ loss_convergence: true }, tuning);
    expect(b.guacMult).toBeCloseTo(1.03);
  });

  it("sums wisdom multiplier", () => {
    const b = calcBenchmarkBonus({ convergence: true }, tuning);
    expect(b.wisdomMult).toBeCloseTo(1.05);
  });

  it("ignores benchmarks with no bonus", () => {
    const b = calcBenchmarkBonus({ no_bonus: true }, tuning);
    expect(b.globalMult).toBe(1);
    expect(b.clickMult).toBe(1);
  });

  it("stacks multiple benchmarks", () => {
    const b = calcBenchmarkBonus({ hello_world: true, overfitting: true, convergence: true }, tuning);
    expect(b.globalMult).toBeCloseTo(1.02);
    expect(b.clickMult).toBeCloseTo(1.05);
    expect(b.wisdomMult).toBeCloseTo(1.05);
  });
});

// ---------- Hyperparameter modifier tests ----------

describe("calcHyperparamModifiers", () => {
  const defaultHp = { learningRate: "conservative", batchSize: "small", regularization: "none", lastTuneTime: 0, warmupStartTime: 0 };

  it("returns all-neutral with defaults", () => {
    const m = calcHyperparamModifiers(defaultHp, Date.now(), tuning);
    expect(m.apsMult).toBe(1);
    expect(m.clickMult).toBe(1);
    expect(m.guacConsumeMult).toBe(1);
    expect(m.wisdomMult).toBe(1);
    expect(m.costMult).toBe(1);
    expect(m.globalMult).toBe(1);
    expect(m.freezeGuacMult).toBe(false);
  });

  it("returns all-neutral with null hyperparams", () => {
    const m = calcHyperparamModifiers(null, Date.now(), tuning);
    expect(m.apsMult).toBe(1);
  });

  it("aggressive learning rate boosts APS and guac consume", () => {
    const hp = { ...defaultHp, learningRate: "aggressive" };
    const m = calcHyperparamModifiers(hp, Date.now(), tuning);
    expect(m.apsMult).toBeCloseTo(1.3);
    expect(m.guacConsumeMult).toBeCloseTo(1.2);
  });

  it("warmup learning rate reduces APS during warmup", () => {
    const now = Date.now();
    const hp = { ...defaultHp, learningRate: "warmup", warmupStartTime: now };
    const m = calcHyperparamModifiers(hp, now + 1000, tuning); // 1s in
    expect(m.apsMult).toBeCloseTo(0.85);
  });

  it("warmup learning rate boosts APS after warmup", () => {
    const now = Date.now();
    const hp = { ...defaultHp, learningRate: "warmup", warmupStartTime: now - 120000 }; // started 2 min ago
    const m = calcHyperparamModifiers(hp, now, tuning);
    expect(m.apsMult).toBeCloseTo(1.2);
  });

  it("large batch size boosts APS and reduces clicks", () => {
    const hp = { ...defaultHp, batchSize: "large" };
    const m = calcHyperparamModifiers(hp, Date.now(), tuning);
    expect(m.apsMult).toBeCloseTo(1.5);
    expect(m.clickMult).toBeCloseTo(0.7);
  });

  it("micro batch size reduces APS and boosts clicks", () => {
    const hp = { ...defaultHp, batchSize: "micro" };
    const m = calcHyperparamModifiers(hp, Date.now(), tuning);
    expect(m.apsMult).toBeCloseTo(0.8);
    expect(m.clickMult).toBeCloseTo(1.8);
  });

  it("dropout freezes guac mult and boosts wisdom", () => {
    const hp = { ...defaultHp, regularization: "dropout" };
    const m = calcHyperparamModifiers(hp, Date.now(), tuning);
    expect(m.freezeGuacMult).toBe(true);
    expect(m.wisdomMult).toBeCloseTo(1.15);
  });

  it("weight_decay reduces costs and global mult", () => {
    const hp = { ...defaultHp, regularization: "weight_decay" };
    const m = calcHyperparamModifiers(hp, Date.now(), tuning);
    expect(m.costMult).toBeCloseTo(0.9);
    expect(m.globalMult).toBeCloseTo(0.95);
  });

  it("stacks learning rate and batch size", () => {
    const hp = { ...defaultHp, learningRate: "aggressive", batchSize: "large" };
    const m = calcHyperparamModifiers(hp, Date.now(), tuning);
    // 1.3 * 1.5 = 1.95
    expect(m.apsMult).toBeCloseTo(1.95);
  });
});

// ---------- Distillation tests ----------

describe("calcDistillationCost", () => {
  it("returns first cost for distillation 0", () => {
    expect(calcDistillationCost(0, tuning)).toBe(100);
  });

  it("returns second cost for distillation 1", () => {
    expect(calcDistillationCost(1, tuning)).toBe(250);
  });

  it("returns last cost for distillation 4", () => {
    expect(calcDistillationCost(4, tuning)).toBe(2000);
  });

  it("returns Infinity when all distillations are done", () => {
    expect(calcDistillationCost(5, tuning)).toBe(Infinity);
  });

  it("returns Infinity with no distillation config", () => {
    expect(calcDistillationCost(0, {})).toBe(Infinity);
  });
});

describe("canDistill", () => {
  it("returns false when wisdom is insufficient", () => {
    expect(canDistill(50, 0, tuning)).toBe(false);
  });

  it("returns true when wisdom meets cost", () => {
    expect(canDistill(100, 0, tuning)).toBe(true);
  });

  it("returns true when wisdom exceeds cost", () => {
    expect(canDistill(200, 0, tuning)).toBe(true);
  });

  it("uses correct cost for second distillation", () => {
    expect(canDistill(249, 1, tuning)).toBe(false);
    expect(canDistill(250, 1, tuning)).toBe(true);
  });

  it("returns false when all distillations done", () => {
    expect(canDistill(99999, 5, tuning)).toBe(false);
  });
});

describe("calcDistillationBonus", () => {
  it("returns neutral bonuses at version 0", () => {
    const b = calcDistillationBonus(0, tuning);
    expect(b.apsMult).toBe(1);
    expect(b.clickBaseBonus).toBe(0);
    expect(b.guacProdMult).toBe(1);
    expect(b.costMult).toBe(1);
    expect(b.startingWisdom).toBe(0);
    expect(b.allProdMult).toBe(1);
    expect(b.wisdomEarnMult).toBe(1);
    expect(b.unlocksFoundationModel).toBe(false);
  });

  it("applies v1.0 bonuses", () => {
    const b = calcDistillationBonus(1, tuning);
    expect(b.apsMult).toBeCloseTo(1.5);
    expect(b.wisdomEarnMult).toBeCloseTo(1.2);
  });

  it("cumulates v1.0 + v2.0 bonuses", () => {
    const b = calcDistillationBonus(2, tuning);
    expect(b.apsMult).toBeCloseTo(1.5);
    expect(b.clickBaseBonus).toBe(1);
    expect(b.guacProdMult).toBeCloseTo(1.3);
  });

  it("cumulates through v3.0", () => {
    const b = calcDistillationBonus(3, tuning);
    expect(b.costMult).toBeCloseTo(0.9);
    expect(b.startingWisdom).toBe(2);
  });

  it("cumulates through v4.0", () => {
    const b = calcDistillationBonus(4, tuning);
    expect(b.multiplierPerSqrtBonus).toBeCloseTo(0.02);
    expect(b.consumeFloorBonus).toBeCloseTo(-0.05);
  });

  it("cumulates through v5.0 with foundation model", () => {
    const b = calcDistillationBonus(5, tuning);
    expect(b.allProdMult).toBeCloseTo(2.0);
    expect(b.unlocksFoundationModel).toBe(true);
  });

  it("returns neutral with no distillation config", () => {
    const b = calcDistillationBonus(3, {});
    expect(b.apsMult).toBe(1);
  });

  it("does not exceed available bonuses", () => {
    // version 10 but only 5 bonuses defined
    const b = calcDistillationBonus(10, tuning);
    expect(b.allProdMult).toBeCloseTo(2.0);
    expect(b.unlocksFoundationModel).toBe(true);
  });
});

// ---------- Multi-tier upgrade stacking tests ----------

describe("calcProducerUnitRate — multi-tier stacking", () => {
  it("2-tier stacking gives 4x (T1 + T2)", () => {
    // sapling base 0.2, T1 (efficient_saplings) 2x, T2 (sapling_t2) 2x = 4x = 0.8
    expect(calcProducerUnitRate("sapling", { efficient_saplings: true, sapling_t2: true }, tuning)).toBeCloseTo(0.8);
  });

  it("3-tier stacking gives 8x (T1 + T2 + T3)", () => {
    // sapling base 0.2, 3 × 2x = 8x = 1.6
    expect(calcProducerUnitRate("sapling", { efficient_saplings: true, sapling_t2: true, sapling_t3: true }, tuning)).toBeCloseTo(1.6);
  });

  it("4-tier stacking gives 16x (T1 + T2 + T3 + T4)", () => {
    // sapling base 0.2, 4 × 2x = 16x = 3.2
    expect(calcProducerUnitRate("sapling", { efficient_saplings: true, sapling_t2: true, sapling_t3: true, sapling_t4: true }, tuning)).toBeCloseTo(3.2);
  });

  it("5-tier stacking gives 32x (T1 through T5)", () => {
    // sapling base 0.2, 5 × 2x = 32x = 6.4
    expect(calcProducerUnitRate("sapling", {
      efficient_saplings: true, sapling_t2: true, sapling_t3: true, sapling_t4: true, sapling_t5: true,
    }, tuning)).toBeCloseTo(6.4);
  });

  it("later tiers without T1 still stack correctly", () => {
    // sapling base 0.2, only T2 + T3 = 4x = 0.8
    expect(calcProducerUnitRate("sapling", { sapling_t2: true, sapling_t3: true }, tuning)).toBeCloseTo(0.8);
  });

  it("stacking works for mid-tier producer (drone)", () => {
    // drone base 8, T1 (drone_swarm) 2x, T2 2x, T3 2x = 8x = 64
    expect(calcProducerUnitRate("drone", { drone_swarm: true, drone_t2: true, drone_t3: true }, tuning)).toBeCloseTo(64);
  });

  it("stacking works for late-tier producer (gpu_cluster) with T4", () => {
    // gpu_cluster base 2800, T1 2x, T2 2x, T3 2x, T4 2x = 16x = 44800
    expect(calcProducerUnitRate("gpu_cluster", {
      gpu_overclock: true, gpu_cluster_t2: true, gpu_cluster_t3: true, gpu_cluster_t4: true,
    }, tuning)).toBeCloseTo(44800);
  });

  it("stacking works for endgame producer (agi_nexus)", () => {
    // agi_nexus base 180000, T1 (recursive_improve) not in test tuning, T2 2x = 2x = 360000
    expect(calcProducerUnitRate("agi_nexus", { agi_nexus_t2: true }, tuning)).toBeCloseTo(360000);
  });

  it("tier upgrades do not affect other producers", () => {
    // sapling tiers should not affect drone
    expect(calcProducerUnitRate("drone", { sapling_t2: true, sapling_t3: true }, tuning)).toBe(8);
  });
});
