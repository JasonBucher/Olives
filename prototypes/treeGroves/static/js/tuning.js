// Centralized location for all game balance values
// Organized by domain for scalability as we add processors and goods
export const TUNING = {
  // Grove: tree growth and capacity
  grove: {
    treeCapacity: 25,
    treeGrowthPerSec: 1.0,
  },

  // Harvest: batch sizes, outcome probabilities, and modifiers
  harvest: {
    baseBatchSize: 10,
    outcomes: [
      { key: "interrupted_short", weight: 0.10, durationMs: 2000, collectedPct: 0.30, lostPct: 0.00 },
      { key: "poor", weight: 0.25, durationMs: 5500, collectedPct: 0.50, lostPct: 0.50 },
      { key: "normal", weight: 0.55, durationMs: 4500, collectedPct: 0.80, lostPct: 0.20 },
      { key: "efficient", weight: 0.10, durationMs: 3500, collectedPct: 1.00, lostPct: 0.00 },
    ],
    poorWeightPerHarvester: 0.01,
    poorArboristMultiplier: 0.5,
    poorTrainingMultiplier: 0.5,
    poorStandardizedToolsReduction: 0.08,
    efficientArboristBonus: 0.05,
    efficientSelectivePickingBonus: 0.06,
    efficientLaddersNetsPerHarvester: 0.01,
    efficientLaddersNetsCap: 0.08,
    efficientQualityInspectorBonus: 0.08,
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
};
