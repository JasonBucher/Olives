// Centralized location for all game balance values
// Organized by domain for scalability as we add processors and goods

// Base harvest outcomes (exported separately for test compatibility)
export const BASE_HARVEST_OUTCOMES = [
  { key: "interrupted_short", weight: 0.10, durationMs: 2000, collectedPct: 0.30, lostPct: 0.00 },
  { key: "poor", weight: 0.05, durationMs: 5500, collectedPct: 0.50, lostPct: 0.50 },
  { key: "normal", weight: 0.65, durationMs: 4500, collectedPct: 0.80, lostPct: 0.20 },
  { key: "efficient", weight: 0.20, durationMs: 3500, collectedPct: 1.00, lostPct: 0.00 },
];

export const TUNING = {
  // Grove: tree growth and capacity
  grove: {
    treeCapacity: 20,
    treeGrowthPerSec: 0.75,
  },

  // Harvest: batch sizes, outcome probabilities, and modifiers
  harvest: {
    baseBatchSize: 10,
    durationSeconds: 6,
    outcomes: BASE_HARVEST_OUTCOMES,
    // Base harvest modifiers (per harvester)
    poorWeightPerHarvester: 0.005,
    // Arborist effects
    arborist: {
      poorReductionMult: 0.5,      // Reduces poor weight accumulation
      efficientBonus: 0.05,        // Flat bonus to efficient weight
    },
    // Upgrade effects
    upgrades: {
      selective_picking: {
        efficientBonus: 0.06,      // Flat bonus to efficient weight
      },
      ladders_nets: {
        efficientPerHarvester: 0.01,  // Scales with harvester count
        efficientCap: 0.08,           // Maximum bonus from scaling
      },
      quality_inspector: {
        efficientBonusWithArborist: 0.08,  // Additional bonus when arborist active
      },
    },
  },

  // Press: deterministic conversion tuning
  press: {
    olivesPerPress: 3,
    baseOilPerPress: 1,
  },

  // Workers: hiring costs and production effects
  workers: {
    cultivator: {
      baseCost: 5,
      costScaleLow: 2,           // Cost increase per cultivator (0-30)
      costScaleHigh: 8,          // Cost increase per cultivator (30+)
      costScaleThreshold: 30,    // When cost scaling increases
      olivesPerSecondPerCultivator: 0.02,
    },
    harvester: {
      baseCost: 10,
      costScale: 5,              // Cost increase per harvester hired
      olivesPerHarvest: 0.6,     // Flat olives bonus per harvester (floating point)
      // Legacy effects (disabled)
      attemptBonusTiers: {       // DEPRECATED: No longer used
        tier1: { max: 5, bonus: 1 },
        tier2: { max: 10, bonus: 0.5 },
        tier3: { bonus: 0.25 },
      },
      durationReductionPct: 0,   // DISABLED: Was 0.04
      durationReductionCap: 0,   // DISABLED: Was 0.25
    },
    presser: {
      baseCost: 12,
      costScale: 6,              // Cost increase per presser hired
      baseCapacity: 3,           // Minimum olives that can be pressed
      logScale: 4.4,             // Logarithmic scaling factor (higher = slower growth)
      capacityPerLog: 5,         // Capacity added per log unit
      oilPerOlivePerPresser: 0.005, // Linear oil bonus per presser per olive pressed
    },
  },

  // Managers: hiring costs, salaries, and supervision effects
  managers: {
    arborist: {
      hireCost: 50,
      salaryPerMin: 0.2,         // Florins per minute
    },
    foreman: {
      hireCost: 50,
      salaryPerMin: 0.2,         // Florins per minute
      growthMultiplier: 1.25,    // 25% increase to farm hand growth bonus
    },
    pressManager: {
      hireCost: 50,
      salaryPerMin: 0.75,        // Florins per minute
      poorMultiplier: 0.6,       // Reduces poor outcome weight
      masterworkBonus: 0.03,     // Adds weight to masterwork outcome
      excellentBonus: 0.05,      // Increases excellent outcome weight
    },
  },

  // Production: processor batch sizes, durations, and conversions
  production: {
    olivePress: {
      olivesPerPress: 3,
      pressDurationMs: 3000,
      oilPerPress: 1,
      baseDurationMs: 3000,
      stochasticRounding: true,
      // Press outcome probabilities (weights normalized at runtime)
      // Expected yield progression:
      //   Base (0 pressers, no manager): ~0.88x multiplier (slight loss, oil not "free")
      //   With 5 pressers: ~0.94x multiplier (approaching parity)
      //   With 5 pressers + manager: ~1.08x multiplier (clearly better, masterwork possible)
      outcomes: [
        { key: "poor", weight: 0.30, yieldMultiplier: 0.6 },      // Wasteful: lose 40%
        { key: "normal", weight: 0.50, yieldMultiplier: 0.9 },    // Slight loss: 10% waste
        { key: "good", weight: 0.15, yieldMultiplier: 1.2 },      // Efficient: +20% bonus
        { key: "excellent", weight: 0.05, yieldMultiplier: 1.5 }, // Great: +50% bonus
        { key: "masterwork", weight: 0.00, yieldMultiplier: 2.0 },// Rare jackpot: 2x (manager only)
      ],
      // Weight modifiers that shift outcome probabilities
      weightModifiers: {
        perPresser: {
          poorDelta: -0.012,      // Each presser reduces poor weight (fewer bad outcomes)
          normalDelta: -0.004,    // Each presser reduces normal weight (shift to better)
          goodDelta: 0.010,       // Each presser increases good weight
          excellentDelta: 0.006,  // Each presser increases excellent weight
        },
        pressManager: {
          poorMultiplier: 0.4,    // Cuts poor weight significantly when active
          masterworkBonus: 0.05,  // Adds 5% masterwork chance (2 oil from 3 olives)
          excellentBonus: 0.08,   // Adds 8% excellent chance
        },
      },
    },
  },

  // Quarry: stone production
  quarry: {
    durationSeconds: 8,
    outputPerRun: 1,
  },

  // Market: timing, pricing, shipping, and trading
  market: {
    tickSeconds: 12,
    autosell: {
      baseRatePerSecond: 0.2,
      rateUpgradeAmount: 0.15,
      maxRateUpgrades: 3,
    },
    lanes: {
      baseLanes: 1,
      laneUpgradeAmount: 1,
      maxAdditionalLanes: 3,
    },
    prices: {
      olivesFlorins: 1,
      oliveOilFlorins: 5,
    },
    price: {
      baseMultiplier: 1.0,
      upgradeMultiplier: 0.10,
      maxUpgrades: 3,
    },
    shipping: {
      // Shared time outcomes for both olive and olive oil shipping
      sharedTimeOutcomes: [
        { key: "fast", weight: 0.20, durationMs: 3000 },
        { key: "normal", weight: 0.60, durationMs: 5000 },
        { key: "slow", weight: 0.20, durationMs: 8000 },
      ],
      // Shared incident outcomes for both olive and olive oil shipping
      sharedIncidentOutcomes: [
        { key: "none", weight: 0.60, lostPct: 0.00, stolenPct: 0.00 },
        { key: "bumps", weight: 0.20, lostPct: 0.10, stolenPct: 0.00 },
        { key: "snack", weight: 0.10, lostPct: 0.05, stolenPct: 0.00 },
        { key: "bandits", weight: 0.10, lostPct: 0.00, stolenPct: 0.30 },
      ],
      olives: {
        baseBatchSize: 10,
      },
      oliveOil: {
        baseBatchSize: 5,
      },
    },
    buyerOutcomes: [
      { key: "nonna", weight: 0.45, buyMin: 1, buyMax: 4 },
      { key: "regular", weight: 0.40, buyMin: 2, buyMax: 8 },
      { key: "giuseppe", weight: 0.15, buyAll: true },
    ],
  },

  // Investments: costs for managers and upgrades
  investments: {
    costs: {
      selective_picking: 20,
      ladders_nets: 30,
      quality_inspector: 50,
    },
    marketAutosell: {
      rateUpgradeCost: { florins: 60, stone: 6 },
      laneUpgradeCost: { florins: 90, stone: 10 },
    },
    marketPrice: {
      upgradeCost: { florins: 90, stone: 12 },
    },
    olivePressExpansion: {
      baseCost: { florins: 120, stone: 40 },
      costScale: { florins: 90, stone: 30 },
      maxAdditionalPresses: 5,
    },
    groveExpansion: [
      { idSuffix: 1, florinCost: 45, stoneCost: 5, capacityBonus: 20 },
      { idSuffix: 2, florinCost: 75, stoneCost: 12, capacityBonus: 25 },
      { idSuffix: 3, florinCost: 200, stoneCost: 25, capacityBonus: 35 },
    ],
    shippingEfficiency: {
      olives: [
        { idSuffix: 1, cost: 25, capacityBonus: 10 },
        { idSuffix: 2, cost: 50, capacityBonus: 10 },
        { idSuffix: 3, cost: 100, capacityBonus: 10 },
      ],
      oliveOil: [
        { idSuffix: 1, cost: 100, capacityBonus: 10 },
        { idSuffix: 2, cost: 200, capacityBonus: 10 },
        { idSuffix: 3, cost: 500, capacityBonus: 25 },
      ],
    },
  },
};
