import { describe, it, expect } from "vitest";
import {
  clamp, formatRate, getDisplayCount, rollWeighted, canPrestige,
  formatNumber, calcProducerCost, calcProducerUnitRate,
  calcBulkProducerCost, calcMaxAffordable,
  calcBaseAps, calcTotalAps, calcClickPower, calcWisdomEarned, calcWisdomBonus,
  calcGuacMultiplier, calcGuacConsumption, calcGuacProduction,
  calcEffectiveConsumeExponent, calcEffectiveProduceExponent,
  calcEffectiveBaseProduction,
  calcBenchmarkBonus, calcHyperparamModifiers,
  calcDistillationCost, canDistill, calcDistillationBonus,
  calcSynergyMultiplier,
} from "./static/js/gameCalc.js";

// --- Shared test tuning (mirrors real TUNING shape, pinned values) ---
const tuning = {
  production: { baseClickYield: 1, tickMs: 200 },
  producers: {
    sapling:         { baseCost: 15,      costGrowth: 1.15, baseRate: 0.1 },
    seed_bank:       { baseCost: 100,     costGrowth: 1.15, baseRate: 0.8 },
    orchard_row:     { baseCost: 1100,    costGrowth: 1.15, baseRate: 8 },
    compost_bin:     { baseCost: 12000,   costGrowth: 1.15, baseRate: 47 },
    drone:           { baseCost: 130000,  costGrowth: 1.15, baseRate: 260 },
    greenhouse:      { baseCost: 1.4e6,   costGrowth: 1.15, baseRate: 1400 },
    harvest_bot:     { baseCost: 20e6,    costGrowth: 1.15, baseRate: 7800 },
    guac_lab:        { baseCost: 50000,   costGrowth: 1.15, baseRate: 47 },
    guac_refinery:   { baseCost: 150000,  costGrowth: 1.15, baseRate: 0 },
    guac_centrifuge: { baseCost: 500000,  costGrowth: 1.15, baseRate: 0 },
    exchange:        { baseCost: 280e6,   costGrowth: 1.15, baseRate: 44000 },
    data_grove:      { baseCost: 3.9e9,   costGrowth: 1.15, baseRate: 260000 },
    attention_head:  { baseCost: 55e9,    costGrowth: 1.15, baseRate: 1.6e6 },
    pit_miner:       { baseCost: 830e9,   costGrowth: 1.15, baseRate: 10e6 },
    gpu_cluster:     { baseCost: 12e12,   costGrowth: 1.15, baseRate: 65e6 },
    neural_pit:      { baseCost: 180e12,  costGrowth: 1.15, baseRate: 430e6 },
    synth_orchard:   { baseCost: 2.9e15,  costGrowth: 1.15, baseRate: 2.9e9 },
    transformer:     { baseCost: 46e15,   costGrowth: 1.15, baseRate: 21e9 },
    orchard_cloud:   { baseCost: 780e15,  costGrowth: 1.15, baseRate: 150e9 },
    quantum_grove:   { baseCost: 14e18,   costGrowth: 1.15, baseRate: 1.1e12 },
    agi_nexus:       { baseCost: 290e18,  costGrowth: 1.15, baseRate: 8.3e12 },
    dyson_orchard:   { baseCost: 7.3e21,  costGrowth: 1.15, baseRate: 64e12 },
    omega_harvest:   { baseCost: 210e21,  costGrowth: 1.15, baseRate: 510e12 },
    foundation_model:{ baseCost: 1.5e21,  costGrowth: 1.15, baseRate: 8.3e12 },
  },
  guac: {
    baseConsumption: 200,
    consumeExponent: 0.85,
    consumeExponentFloor: 0.70,
    baseProduction: 1,
    produceExponent: 1.0,
    multiplierCoeff: 0.06,
    guacMultCap: 8.0,
    guacMaintenanceRate: 0.5,
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
    guac_recycler:      { cost: 120000, unlockAt: 5,  producerId: "guac_lab", consumeExpDelta: -0.05 },
    bulk_fermentation:  { cost: 200000, unlockAt: 10, producerId: "guac_lab", consumeExpDelta: -0.05 },
    superlinear_synth:  { cost: 100000, guacUnlockAt: 25,  produceExpDelta: +0.05 },
    exponential_ripen:  { cost: 500000, guacUnlockAt: 100, produceExpDelta: +0.10 },
    concentrate_proto:  { cost: 200000, unlockAt: 10, producerId: "guac_lab", baseProdMult: 1.5 },
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
    // Synergy upgrades for testing
    syn_orchard_sapling:    { cost: 5000,   synergySource: "orchard_row",    synergyTarget: "sapling",  synergyPct: 0.05, sourceReq: 5,  targetReq: 10 },
    syn_greenhouse_sapling: { cost: 5e6,    synergySource: "greenhouse",     synergyTarget: "sapling",  synergyPct: 0.04, sourceReq: 1,  targetReq: 10 },
    syn_synth_sapling:      { cost: 10e15,  synergySource: "synth_orchard",  synergyTarget: "sapling",  synergyPct: 0.02, sourceReq: 1,  targetReq: 15 },
    syn_drone_orchard:      { cost: 500000, synergySource: "drone",          synergyTarget: "orchard_row", synergyPct: 0.04, sourceReq: 3, targetReq: 5 },
    syn_gpu_data:           { cost: 40e12,  synergySource: "gpu_cluster",    synergyTarget: "data_grove",  synergyPct: 0.02, sourceReq: 1, targetReq: 3 },
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
      { multiplierCoeffBonus: 0.01, consumeFloorBonus: -0.05, desc: "test" },
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

  it("abbreviates millions with M suffix", () => {
    expect(formatNumber(1.5e6)).toBe("1.50 M");
    expect(formatNumber(45e6)).toBe("45.0 M");
    expect(formatNumber(500e6)).toBe("500 M");
  });

  it("abbreviates billions with B suffix", () => {
    expect(formatNumber(3.9e9)).toBe("3.90 B");
    expect(formatNumber(55e9)).toBe("55.0 B");
  });

  it("abbreviates trillions with T suffix", () => {
    expect(formatNumber(12e12)).toBe("12.0 T");
  });

  it("abbreviates quadrillions with Qa suffix", () => {
    expect(formatNumber(2.9e15)).toBe("2.90 Qa");
  });

  it("abbreviates quintillions with Qi suffix", () => {
    expect(formatNumber(14e18)).toBe("14.0 Qi");
  });

  it("abbreviates sextillions with Sx suffix", () => {
    expect(formatNumber(7.3e21)).toBe("7.30 Sx");
  });

  it("uses integer format for >= 100 scaled", () => {
    expect(formatNumber(500e6)).toBe("500 M");
    expect(formatNumber(830e9)).toBe("830 B");
  });
});

describe("calcProducerCost", () => {
  it("returns baseCost when owning 0", () => {
    expect(calcProducerCost("sapling", 0, tuning)).toBe(15);
  });

  it("scales cost by costGrowth^owned", () => {
    // floor(15 * 1.15) = 17
    expect(calcProducerCost("sapling", 1, tuning)).toBe(17);
  });

  it("grows exponentially", () => {
    // floor(15 * 1.15^10) = 60
    expect(calcProducerCost("sapling", 10, tuning)).toBe(60);
  });

  it("works for higher-tier producers", () => {
    expect(calcProducerCost("orchard_row", 0, tuning)).toBe(1100);
    // floor(1100 * 1.15^5) = 2212
    expect(calcProducerCost("orchard_row", 5, tuning)).toBe(2212);
  });

  it("works for attention_head producer", () => {
    expect(calcProducerCost("attention_head", 0, tuning)).toBe(55000000000);
  });

  it("works for transformer producer", () => {
    expect(calcProducerCost("transformer", 0, tuning)).toBe(46000000000000000);
  });

  it("works for new producers", () => {
    expect(calcProducerCost("seed_bank", 0, tuning)).toBe(100);
    expect(calcProducerCost("gpu_cluster", 0, tuning)).toBe(12000000000000);
    expect(calcProducerCost("omega_harvest", 0, tuning)).toBe(210000000000000000000000);
  });
});

describe("calcBulkProducerCost", () => {
  it("qty=1 equals calcProducerCost result", () => {
    expect(calcBulkProducerCost("sapling", 0, 1, tuning)).toBe(calcProducerCost("sapling", 0, tuning));
  });

  it("qty=3 equals sum of 3 individual calcProducerCost calls", () => {
    const expected = calcProducerCost("sapling", 0, tuning)
                   + calcProducerCost("sapling", 1, tuning)
                   + calcProducerCost("sapling", 2, tuning);
    expect(calcBulkProducerCost("sapling", 0, 3, tuning)).toBe(expected);
  });

  it("respects starting ownedCount", () => {
    const expected = calcProducerCost("sapling", 5, tuning)
                   + calcProducerCost("sapling", 6, tuning);
    expect(calcBulkProducerCost("sapling", 5, 2, tuning)).toBe(expected);
  });

  it("applies costMult per-unit", () => {
    const costMult = 0.9;
    const expected = Math.floor(calcProducerCost("sapling", 0, tuning) * costMult)
                   + Math.floor(calcProducerCost("sapling", 1, tuning) * costMult);
    expect(calcBulkProducerCost("sapling", 0, 2, tuning, costMult)).toBe(expected);
  });

  it("returns 0 for qty=0", () => {
    expect(calcBulkProducerCost("sapling", 0, 0, tuning)).toBe(0);
  });
});

describe("calcMaxAffordable", () => {
  it("returns 0 when budget < first unit cost", () => {
    expect(calcMaxAffordable("sapling", 0, 10, tuning)).toBe(0);
  });

  it("returns 1 when budget equals exactly one unit", () => {
    const cost = calcProducerCost("sapling", 0, tuning);
    expect(calcMaxAffordable("sapling", 0, cost, tuning)).toBe(1);
  });

  it("returns correct count for larger budgets", () => {
    // sapling costs: 15, 17, 19, 22, 25, 28 ... (floor of 15 * 1.15^n)
    // Cumulative: 15, 32, 51, 73, 98
    const budget = 75;
    const count = calcMaxAffordable("sapling", 0, budget, tuning);
    expect(count).toBe(4); // 15+17+19+22 = 73 <= 75, next would be 25 -> 98 > 75
    expect(calcBulkProducerCost("sapling", 0, count, tuning)).toBeLessThanOrEqual(budget);
    expect(calcBulkProducerCost("sapling", 0, count + 1, tuning)).toBeGreaterThan(budget);
  });

  it("accounts for starting ownedCount", () => {
    const cost10 = calcProducerCost("sapling", 10, tuning);
    expect(calcMaxAffordable("sapling", 10, cost10 - 1, tuning)).toBe(0);
    expect(calcMaxAffordable("sapling", 10, cost10, tuning)).toBe(1);
  });

  it("applies costMult", () => {
    const costMult = 0.5;
    // With 0.5x costs, can afford more units
    const normalCount = calcMaxAffordable("sapling", 0, 75, tuning);
    const discountedCount = calcMaxAffordable("sapling", 0, 75, tuning, costMult);
    expect(discountedCount).toBeGreaterThan(normalCount);
  });

  it("returns 0 for zero budget", () => {
    expect(calcMaxAffordable("sapling", 0, 0, tuning)).toBe(0);
  });
});

describe("calcProducerUnitRate", () => {
  it("returns base rate with no upgrades", () => {
    expect(calcProducerUnitRate("sapling", {}, tuning)).toBe(0.1);
  });

  it("doubles rate with matching producer upgrade", () => {
    expect(calcProducerUnitRate("sapling", { efficient_saplings: true }, tuning)).toBe(0.2);
  });

  it("ignores upgrades for other producers", () => {
    expect(calcProducerUnitRate("sapling", { drip_irrigation: true }, tuning)).toBe(0.1);
  });

  it("applies upgrade to correct producer", () => {
    expect(calcProducerUnitRate("orchard_row", { drip_irrigation: true }, tuning)).toBe(16);
  });

  it("applies attention_focus to attention_head", () => {
    expect(calcProducerUnitRate("attention_head", { attention_focus: true }, tuning)).toBe(3.2e6);
  });

  it("applies transformer_scale to transformer", () => {
    expect(calcProducerUnitRate("transformer", { transformer_scale: true }, tuning)).toBe(42e9);
  });

  it("applies new producer upgrades", () => {
    expect(calcProducerUnitRate("seed_bank", { seed_catalog: true }, tuning)).toBe(1.6);
    expect(calcProducerUnitRate("compost_bin", { hot_compost: true }, tuning)).toBe(94);
    expect(calcProducerUnitRate("greenhouse", { climate_control: true }, tuning)).toBe(2800);
    expect(calcProducerUnitRate("harvest_bot", { harvest_fleet: true }, tuning)).toBe(15600);
    expect(calcProducerUnitRate("data_grove", { data_lake: true }, tuning)).toBe(520000);
    expect(calcProducerUnitRate("gpu_cluster", { gpu_overclock: true }, tuning)).toBe(130e6);
  });
});

describe("calcGuacMultiplier", () => {
  it("returns 1.0 with no guac", () => {
    expect(calcGuacMultiplier(0, tuning)).toBe(1);
  });

  it("applies asymptotic log2 scaling", () => {
    // L = log2(101) * 0.06 ≈ 6.658 * 0.06 ≈ 0.3995
    // mult = 1 + 7 * (0.3995 / 1.3995) ≈ 1 + 7 * 0.2854 ≈ 2.998
    expect(calcGuacMultiplier(100, tuning)).toBeCloseTo(3.0, 0);
  });

  it("approaches cap but never reaches it", () => {
    // At 1M guac: L = log2(1000001) * 0.06 ≈ 19.93 * 0.06 ≈ 1.196
    // mult = 1 + 7 * (1.196 / 2.196) ≈ 1 + 7 * 0.5446 ≈ 4.81
    const mult = calcGuacMultiplier(1000000, tuning);
    expect(mult).toBeGreaterThan(4.5);
    expect(mult).toBeLessThan(8.0); // never reaches cap
  });

  it("handles small guac amounts", () => {
    // L = log2(2) * 0.06 = 0.06
    // mult = 1 + 7 * (0.06 / 1.06) ≈ 1 + 7 * 0.0566 ≈ 1.396
    expect(calcGuacMultiplier(1, tuning)).toBeCloseTo(1.4, 0);
  });

  it("gives early boost at 10 guac", () => {
    // L = log2(11) * 0.06 ≈ 3.459 * 0.06 ≈ 0.2076
    // mult = 1 + 7 * (0.2076 / 1.2076) ≈ 1 + 7 * 0.1719 ≈ 2.203
    expect(calcGuacMultiplier(10, tuning)).toBeCloseTo(2.2, 0);
  });

  it("shows diminishing returns at high guac", () => {
    const at10k = calcGuacMultiplier(10000, tuning);
    const at100k = calcGuacMultiplier(100000, tuning);
    // Difference should be small
    expect(at100k - at10k).toBeLessThan(0.5);
  });
});

describe("calcGuacConsumption", () => {
  it("returns 0 with no labs", () => {
    expect(calcGuacConsumption(0, tuning)).toBe(0);
  });

  it("returns base consumption with 1 lab (no guac)", () => {
    // 200 * 1^0.85 = 200, maintenance = 0
    expect(calcGuacConsumption(1, tuning)).toBe(200);
  });

  it("scales sublinearly with more labs", () => {
    // 200 * 10^0.85 ≈ 1416
    const c10 = calcGuacConsumption(10, tuning);
    expect(c10).toBeCloseTo(1416, 0);
    // Should be less than linear (2000)
    expect(c10).toBeLessThan(2000);
  });

  it("scales further sublinearly at 100 labs", () => {
    // 200 * 100^0.85 ≈ 10024
    const c100 = calcGuacConsumption(100, tuning);
    expect(c100).toBeCloseTo(10024, 0);
    // Should be less than linear (20000)
    expect(c100).toBeLessThan(20000);
  });
});

describe("calcGuacConsumption — exponent floor", () => {
  it("clamps exponent at floor when pushed below", () => {
    const lowExpTuning = {
      ...tuning,
      guac: { ...tuning.guac, consumeExponent: 0.2 },  // below floor of 0.70
    };
    // Should use floor (0.70), not 0.2
    // 200 * 10^0.70 ≈ 1002
    const result = calcGuacConsumption(10, lowExpTuning);
    expect(result).toBeCloseTo(200 * Math.pow(10, 0.70), 0);
  });
});

describe("calcGuacConsumption — maintenance cost", () => {
  it("adds maintenance proportional to guac count", () => {
    // Base: 200 * 1^0.85 = 200, maintenance: 1000 * 0.5 = 500, total = 700
    expect(calcGuacConsumption(1, tuning, undefined, undefined, undefined, undefined, 1000)).toBe(700);
  });

  it("maintenance scales linearly with guac", () => {
    // Base: 200 * 1^0.85 = 200, maintenance: 50000 * 0.5 = 25000, total = 25200
    expect(calcGuacConsumption(1, tuning, undefined, undefined, undefined, undefined, 50000)).toBe(25200);
  });

  it("maintenance adds to effective-exponent consumption", () => {
    // 5 refineries: exp = 0.80, base: 200 * 10^0.80, maintenance: 100 * 0.5 = 50
    const expected = 200 * Math.pow(10, 0.80) + 100 * 0.5;
    const result = calcGuacConsumption(10, tuning, 5, {}, {}, 0, 100);
    expect(result).toBeCloseTo(expected, 0);
  });

  it("maintenance is zero when guacCount is zero", () => {
    const withoutGuac = calcGuacConsumption(10, tuning, 0, {}, {}, 0, 0);
    const withoutParam = calcGuacConsumption(10, tuning, 0, {}, {}, 0);
    expect(withoutGuac).toBeCloseTo(withoutParam, 5);
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
    // 5 * 0.1 + 2 * 8 = 16.5
    expect(calcBaseAps(producers, {}, tuning)).toBe(16.5);
  });

  it("applies per-producer upgrades", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // 10 * 0.2 = 2
    expect(calcBaseAps(producers, { efficient_saplings: true }, tuning)).toBe(2);
  });

  it("does not apply global multipliers", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // 10 * 0.1 = 1 (global_boost_1 should NOT affect this)
    expect(calcBaseAps(producers, { global_boost_1: true }, tuning)).toBe(1);
  });
});

describe("calcTotalAps", () => {
  it("returns 0 with no producers", () => {
    const producers = { sapling: 0, orchard_row: 0, drone: 0, guac_lab: 0 };
    expect(calcTotalAps(producers, {}, 0, 0, tuning)).toBe(0);
  });

  it("sums production from multiple producer types", () => {
    const producers = { sapling: 5, orchard_row: 2, drone: 0, guac_lab: 0 };
    // 5 * 0.1 + 2 * 8 = 16.5
    expect(calcTotalAps(producers, {}, 0, 0, tuning)).toBe(16.5);
  });

  it("applies global multiplier upgrade", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // 10 * 0.1 = 1, * 1.5 = 1.5
    expect(calcTotalAps(producers, { global_boost_1: true }, 0, 0, tuning)).toBe(1.5);
  });

  it("stacks global multipliers", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // 10 * 0.1 = 1, * 1.5 * 2 = 3
    expect(calcTotalAps(producers, { global_boost_1: true, global_boost_2: true }, 0, 0, tuning)).toBe(3);
  });

  it("applies wisdom bonus", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // base = 1, wisdom = 1 + 10 * 0.10 = 2.0, total = 2
    expect(calcTotalAps(producers, {}, 10, 0, tuning)).toBeCloseTo(2);
  });

  it("applies guac multiplier", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // base = 1, guac mult at 100 guac
    const guacMult = calcGuacMultiplier(100, tuning);
    expect(calcTotalAps(producers, {}, 0, 100, tuning)).toBeCloseTo(1 * guacMult);
  });

  it("stacks guac and wisdom multipliers", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // base = 1, wisdom = 2.0, guac at 100 guac
    const guacMult = calcGuacMultiplier(100, tuning);
    expect(calcTotalAps(producers, {}, 10, 100, tuning)).toBeCloseTo(1 * 2.0 * guacMult);
  });

  it("applies benchmark global multiplier", () => {
    const producers = { sapling: 10, orchard_row: 0, drone: 0, guac_lab: 0 };
    // base = 1, benchmark global = 1 + 0.02 = 1.02, total = 1 * 1.02 = 1.02
    expect(calcTotalAps(producers, {}, 0, 0, tuning, { hello_world: true })).toBeCloseTo(1.02);
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
    expect(calcClickPower({}, noProducers, 5, 0, 0, tuning)).toBeCloseTo(1.5);
  });

  it("applies guac multiplier to clicks", () => {
    const guacMult = calcGuacMultiplier(100, tuning);
    expect(calcClickPower({}, noProducers, 0, 100, 0, tuning)).toBeCloseTo(guacMult);
  });

  it("stacks all multipliers", () => {
    // 1 * 2 (strong) * 2 (iron) = 4, * 1.5 (global) = 6, * 2 (10 wisdom) = 12, * guac
    const guacMult = calcGuacMultiplier(100, tuning);
    expect(calcClickPower(
      { strong_thumb: true, iron_thumb: true, global_boost_1: true }, noProducers, 10, 100, 0, tuning
    )).toBeCloseTo(12 * guacMult);
  });

  it("adds base APS percentage from throughput_click_1", () => {
    expect(calcClickPower({ throughput_click_1: true }, noProducers, 0, 0, 100, tuning)).toBe(4);
  });

  it("highest throughput tier wins (not additive)", () => {
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
    // 15 refineries: 0.85 - 0.15 = 0.70 (at floor)
    expect(calcEffectiveConsumeExponent(15, {}, {}, 0, tuning)).toBe(0.70);
  });

  it("does not go below floor even with many refineries", () => {
    expect(calcEffectiveConsumeExponent(100, {}, {}, 0, tuning)).toBe(0.70);
  });

  it("applies Guac Memory II wisdom unlock", () => {
    // 0.85 - 0.01 * 5 prestiges = 0.80
    expect(calcEffectiveConsumeExponent(0, {}, { guac_memory_2: true }, 5, tuning)).toBeCloseTo(0.80);
  });

  it("stacks refineries, upgrades, and wisdom unlock", () => {
    // 0.85 - 5*0.01 - 0.05 - 0.01*3 = 0.85 - 0.05 - 0.05 - 0.03 = 0.72
    expect(calcEffectiveConsumeExponent(5, { guac_recycler: true }, { guac_memory_2: true }, 3, tuning)).toBeCloseTo(0.72);
  });

  it("Infinite Guac Theory lowers floor to 0.55", () => {
    // With infinite_guac, floor is 0.55 instead of 0.70
    expect(calcEffectiveConsumeExponent(100, {}, { infinite_guac: true }, 0, tuning)).toBe(0.55);
  });

  it("Infinite Guac Theory allows going below old floor", () => {
    // 0.85 - 20*0.01 = 0.65, below old floor 0.70 but above new floor 0.55
    expect(calcEffectiveConsumeExponent(20, {}, { infinite_guac: true }, 0, tuning)).toBeCloseTo(0.65);
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
    // 200 * 10^0.80
    const expected = 200 * Math.pow(10, 0.80);
    const result = calcGuacConsumption(10, tuning, 5, {}, {}, 0);
    expect(result).toBeCloseTo(expected, 0);
  });

  it("still works with old 2-arg signature", () => {
    // 200 * 10^0.85
    const expected = 200 * Math.pow(10, 0.85);
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
    expect(b.multiplierCoeffBonus).toBe(0);
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
    expect(b.multiplierCoeffBonus).toBeCloseTo(0.01);
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
    // sapling base 0.1, T1 (efficient_saplings) 2x, T2 (sapling_t2) 2x = 4x = 0.4
    expect(calcProducerUnitRate("sapling", { efficient_saplings: true, sapling_t2: true }, tuning)).toBeCloseTo(0.4);
  });

  it("3-tier stacking gives 8x (T1 + T2 + T3)", () => {
    // sapling base 0.1, 3 × 2x = 8x = 0.8
    expect(calcProducerUnitRate("sapling", { efficient_saplings: true, sapling_t2: true, sapling_t3: true }, tuning)).toBeCloseTo(0.8);
  });

  it("4-tier stacking gives 16x (T1 + T2 + T3 + T4)", () => {
    // sapling base 0.1, 4 × 2x = 16x = 1.6
    expect(calcProducerUnitRate("sapling", { efficient_saplings: true, sapling_t2: true, sapling_t3: true, sapling_t4: true }, tuning)).toBeCloseTo(1.6);
  });

  it("5-tier stacking gives 32x (T1 through T5)", () => {
    // sapling base 0.1, 5 × 2x = 32x = 3.2
    expect(calcProducerUnitRate("sapling", {
      efficient_saplings: true, sapling_t2: true, sapling_t3: true, sapling_t4: true, sapling_t5: true,
    }, tuning)).toBeCloseTo(3.2);
  });

  it("later tiers without T1 still stack correctly", () => {
    // sapling base 0.1, only T2 + T3 = 4x = 0.4
    expect(calcProducerUnitRate("sapling", { sapling_t2: true, sapling_t3: true }, tuning)).toBeCloseTo(0.4);
  });

  it("stacking works for mid-tier producer (drone)", () => {
    // drone base 260, T1 (drone_swarm) 2x, T2 2x, T3 2x = 8x = 2080
    expect(calcProducerUnitRate("drone", { drone_swarm: true, drone_t2: true, drone_t3: true }, tuning)).toBeCloseTo(2080);
  });

  it("stacking works for late-tier producer (gpu_cluster) with T4", () => {
    // gpu_cluster base 65e6, T1 2x, T2 2x, T3 2x, T4 2x = 16x = 1.04e9
    expect(calcProducerUnitRate("gpu_cluster", {
      gpu_overclock: true, gpu_cluster_t2: true, gpu_cluster_t3: true, gpu_cluster_t4: true,
    }, tuning)).toBeCloseTo(1.04e9);
  });

  it("stacking works for endgame producer (agi_nexus)", () => {
    // agi_nexus base 8.3e12, T2 2x = 16.6e12
    expect(calcProducerUnitRate("agi_nexus", { agi_nexus_t2: true }, tuning)).toBeCloseTo(16.6e12);
  });

  it("tier upgrades do not affect other producers", () => {
    // sapling tiers should not affect drone
    expect(calcProducerUnitRate("drone", { sapling_t2: true, sapling_t3: true }, tuning)).toBe(260);
  });
});

// ---------- Cross-producer synergy tests ----------

describe("calcSynergyMultiplier", () => {
  it("returns 1 when no synergy upgrades exist for target", () => {
    const producers = { sapling: 10, orchard_row: 5 };
    expect(calcSynergyMultiplier("drone", producers, {}, tuning)).toBe(1);
  });

  it("returns 1 when synergy upgrade exists but not owned", () => {
    const producers = { sapling: 10, orchard_row: 5 };
    expect(calcSynergyMultiplier("sapling", producers, {}, tuning)).toBe(1);
  });

  it("returns correct multiplier with one synergy", () => {
    // 5% per orchard_row, 10 orchard_rows = 1 + 0.05*10 = 1.50
    const producers = { sapling: 10, orchard_row: 10 };
    expect(calcSynergyMultiplier("sapling", producers, { syn_orchard_sapling: true }, tuning)).toBeCloseTo(1.50);
  });

  it("returns 1 when source count is 0", () => {
    const producers = { sapling: 10, orchard_row: 0 };
    expect(calcSynergyMultiplier("sapling", producers, { syn_orchard_sapling: true }, tuning)).toBe(1);
  });

  it("combines multiple synergies targeting the same producer additively", () => {
    // sapling has 3 synergy sources: orchard_row (5%), greenhouse (4%), synth_orchard (2%)
    // 15 orchard_rows, 10 greenhouses, 5 synth_orchards:
    // bonus = 0.05*15 + 0.04*10 + 0.02*5 = 0.75 + 0.40 + 0.10 = 1.25
    // multiplier = 1 + 1.25 = 2.25
    const producers = { sapling: 15, orchard_row: 15, greenhouse: 10, synth_orchard: 5 };
    const upgrades = { syn_orchard_sapling: true, syn_greenhouse_sapling: true, syn_synth_sapling: true };
    expect(calcSynergyMultiplier("sapling", producers, upgrades, tuning)).toBeCloseTo(2.25);
  });

  it("only applies owned synergy upgrades", () => {
    // Only orchard synergy owned, not greenhouse or synth
    const producers = { sapling: 10, orchard_row: 10, greenhouse: 5, synth_orchard: 3 };
    const upgrades = { syn_orchard_sapling: true };
    // bonus = 0.05*10 = 0.50, multiplier = 1.50
    expect(calcSynergyMultiplier("sapling", producers, upgrades, tuning)).toBeCloseTo(1.50);
  });
});

describe("calcBaseAps — synergy integration", () => {
  it("returns boosted APS when synergy upgrade is owned and source has units", () => {
    const producers = { sapling: 10, orchard_row: 5 };
    const upgrades = { syn_orchard_sapling: true };
    // sapling: 10 * 0.1 * (1 + 0.05*5) = 10 * 0.1 * 1.25 = 1.25
    // orchard_row: 5 * 8 = 40
    // total = 41.25
    expect(calcBaseAps(producers, upgrades, tuning)).toBeCloseTo(41.25);
  });

  it("returns unboosted APS when synergy upgrade not owned", () => {
    const producers = { sapling: 10, orchard_row: 5 };
    // sapling: 10 * 0.1 = 1, orchard_row: 5 * 8 = 40, total = 41
    expect(calcBaseAps(producers, {}, tuning)).toBeCloseTo(41);
  });
});

