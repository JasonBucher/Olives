// Centralized location for all game balance values
// Organized by domain for scalability as we add processors and goods

// Base harvest outcomes (exported separately for test compatibility)
export const BASE_HARVEST_OUTCOMES = [
  { key: "interrupted_short", weight: 0.10, durationMs: 2000, collectedPct: 0.30, lostPct: 0.00 },
  { key: "poor", weight: 0.25, durationMs: 5500, collectedPct: 0.50, lostPct: 0.50 },
  { key: "normal", weight: 0.55, durationMs: 4500, collectedPct: 0.80, lostPct: 0.20 },
  { key: "efficient", weight: 0.10, durationMs: 3500, collectedPct: 1.00, lostPct: 0.00 },
];

export const TUNING = {
  // Grove: tree growth and capacity
  grove: {
    treeCapacity: 25,
    treeGrowthPerSec: 1.0,
  },

  // Harvest: batch sizes, outcome probabilities, and modifiers
  harvest: {
    baseBatchSize: 10,
    outcomes: BASE_HARVEST_OUTCOMES,
    // Base harvest modifiers (per harvester)
    poorWeightPerHarvester: 0.01,
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
  },

  // Managers: hiring costs, salaries, and supervision effects
  managers: {
    arborist: {
      hireCost: 50,
      salaryPerMin: 0.2,         // Florins per minute
    },
  },

  // Market: timing and pricing
  market: {
    tickSeconds: 12,
    olivePriceFlorins: 1,
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
