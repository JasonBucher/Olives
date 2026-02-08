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
    treeCapacity: 25,
    treeGrowthPerSec: 0.5,
  },

  // Harvest: batch sizes, outcome probabilities, and modifiers
  harvest: {
    baseBatchSize: 10,
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
      standardized_tools: {
        poorFlatReduction: 0.08,  // Flat reduction to poor weight (positive value gets subtracted)
      },
      training_program: {
        poorMultiplierReduction: 0.5,  // Multiplies poor accumulation rate
      },
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

  // Workers: hiring costs and production effects
  workers: {
    farmHand: {
      baseCost: 5,
      costScaleLow: 2,           // Cost increase per farm hand (0-30)
      costScaleHigh: 8,          // Cost increase per farm hand (30+)
      costScaleThreshold: 30,    // When cost scaling increases
      growthBonusPct: 0.08,      // 8% growth speed bonus per farm hand
      capacityBonusPerWorker: 1, // +1 capacity per farm hand
      capacityBonusCap: 25,      // Max bonus to capacity (doubles base 25)
    },
    harvester: {
      baseCost: 10,
      costScale: 5,              // Cost increase per harvester hired
      attemptBonusTiers: {       // Harvest batch size bonuses by count
        tier1: { max: 5, bonus: 1 },     // First 5: +1 each
        tier2: { max: 10, bonus: 0.5 },  // 6-10: +0.5 each
        tier3: { bonus: 0.25 },          // 11+: +0.25 each
      },
      durationReductionPct: 0.04, // 4% speed per harvester
      durationReductionCap: 0.25,  // Max 25% total speed boost
    },
    presser: {
      baseCost: 12,
      costScale: 6,              // Cost increase per presser hired
      baseCapacity: 3,           // Minimum olives that can be pressed
      logScale: 4.4,             // Logarithmic scaling factor (higher = slower growth)
      capacityPerLog: 5,         // Capacity added per log unit
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
      hireCost: 150,
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
      outcomes: [
        { key: "poor", weight: 0.15, yieldMultiplier: 0.75 },
        { key: "normal", weight: 0.50, yieldMultiplier: 1.0 },
        { key: "good", weight: 0.25, yieldMultiplier: 1.25 },
        { key: "excellent", weight: 0.10, yieldMultiplier: 1.6 },
        { key: "masterwork", weight: 0.00, yieldMultiplier: 2.0 },  // Enabled by Press Manager
      ],
      // Weight modifiers that shift outcome probabilities
      weightModifiers: {
        perPresser: {
          poorDelta: -0.008,      // Each presser reduces poor weight
          normalDelta: -0.002,    // Each presser slightly reduces normal weight
          goodDelta: 0.006,       // Each presser increases good weight
          excellentDelta: 0.004,  // Each presser increases excellent weight
        },
        pressManager: {
          poorMultiplier: 0.6,    // Multiplies poor weight when active
          masterworkBonus: 0.03,  // Adds flat weight to masterwork when active
          excellentBonus: 0.05,   // Adds flat weight to excellent when active
        },
      },
    },
  },

  // Market: timing and pricing
  market: {
    tickSeconds: 12,
    olivePriceFlorins: 1,
    oliveOilPriceFlorins: 5,
    oliveOilBatchSize: 5,
  },

  // Investments: costs for managers and upgrades
  investments: {
    costs: {
      standardized_tools: 75,
      training_program: 150,
      selective_picking: 200,
      ladders_nets: 300,
      quality_inspector: 500,
    },
  },
};
