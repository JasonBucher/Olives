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
      olivesPerSecondPerCultivator: 0.10,
    },
    harvester: {
      baseCost: 10,
      costScale: 5,              // Cost increase per harvester hired
      olivesPerHarvest: 0.8,     // Flat olives bonus per harvester (floating point)
    },
    presser: {
      baseCost: 12,
      costScale: 6,              // Cost increase per presser hired
      oilPerOlivePerPresser: 0.02, // Linear oil bonus per presser per olive pressed
    },
  },

  // Managers: hiring costs, salaries, and supervision effects
  managers: {
    arborist: {
      hireCost: 25,
      salaryPerMin: 0.2,         // Florins per minute
    },
    foreman: {
      hireCost: 50,
      salaryPerMin: 0.2,         // Florins per minute
      growthMultiplier: 1.25,    // 25% increase to farm hand growth bonus
    },
    quarryManager: {
      hireCost: 60,
      salaryPerMin: 0.3,         // Florins per minute
    },
    pressManager: {
      hireCost: 50,
      salaryPerMin: 0.75,        // Florins per minute
      presserMultiplier: 1.50,   // 50% increase to presser oil bonus
    },
  },

  // Production: processor batch sizes, durations, and conversions
  production: {
    olivePress: {
      olivesPerPress: 3,
      pressDurationMs: 3000,
      oilPerPress: 1,
      baseDurationMs: 3000,
    },
  },

  // Quarry: stone production
  quarry: {
    durationSeconds: 20,
    outputPerRun: 4,
  },

  // Market: timing, pricing, shipping, and trading
  market: {
    tickSeconds: 12,
    autosell: {
      baseRatePerSecond: 0.35,
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

  // City: demand system (used by autosell pacing)
  city: {
    baseDemandRate: 0.35,
    eventChancePerSecond: 0.05,
    eventsByTier: {
      neighborhood: [
        { id: "localPurchase", weight: 6 },
        { id: "haggler", weight: 2 },
        { id: "recommendation", weight: 1 },
      ],
      artisans: [
        { id: "localPurchase", weight: 4 },
        { id: "haggler", weight: 2 },
        { id: "chefOrder", weight: 3 },
        { id: "recommendation", weight: 2 },
      ],
      nobles: [
        { id: "localPurchase", weight: 3 },
        { id: "haggler", weight: 1 },
        { id: "chefOrder", weight: 3 },
        { id: "recommendation", weight: 2 },
        { id: "noblePatronage", weight: 1 },
      ],
    },
    events: {
      localPurchase: {
        id: "localPurchase",
        name: "Local Purchase",
        type: "instantSale",
        minOil: 1,
        maxOil: 2,
        renownBonus: 0.2,
      },
      haggler: {
        id: "haggler",
        name: "Haggler",
        type: "timedDemandModifier",
        durationSeconds: 30,
        demandMultiplier: 0.7,
      },
      chefOrder: {
        id: "chefOrder",
        name: "Chef Order",
        type: "instantSale",
        minOil: 5,
        maxOil: 10,
        renownBonus: 0.8,
      },
      recommendation: {
        id: "recommendation",
        name: "Recommendation",
        type: "timedDemandModifier",
        durationSeconds: 60,
        demandMultiplier: 1.4,
      },
      noblePatronage: {
        id: "noblePatronage",
        name: "Noble Patronage",
        type: "instantSale",
        minOil: 20,
        maxOil: 30,
        renownBonus: 2.5,
      },
    },
  },

  // Relocation: Era 2 gating requirements
  relocation: {
    lifetimeFlorinsRequired: 5000,
    florinCost: 3000,
  },

  // Era 2: estate passive income coefficients (florins/sec)
  era2: {
    estateIncome: {
      treeCapacityMultiplier: 0.0025,
      olivePressMultiplier: 0.06,
      harvestBasketMultiplier: 0.012,
      harvestUpgradeMultiplier: 0.04,
    },
  },

  // Renown: sale-driven progression
  renown: {
    perUnitSold: 0.25,
  },

  // Renown: city reputation tiers (config-driven)
  renownTiers: [
    { id: "neighborhood", name: "Neighborhood", minRenown: 0, maxRenown: 99, demandBonus: 0 },
    { id: "artisans", name: "Artisans", minRenown: 100, maxRenown: 249, demandBonus: 0.10 },
    { id: "nobles", name: "Nobles", minRenown: 250, maxRenown: 399, demandBonus: 0.25 },
  ],

  // Investments: costs for managers and upgrades
  investments: {
    costs: {
      selective_picking: 5,
      ladders_nets: 10,
    },
    marketAutosell: {
      rateUpgradeCost: { florins: 60, stone: 6 },
      laneUpgradeCost: { florins: 90, stone: 10 },
    },
    marketPrice: {
      upgradeCost: { florins: 90, stone: 12 },
    },
    pulleyCart: {
      baseCost: { florins: 50, stone: 10 },
      costScale: { florins: 40, stone: 8 },
      maxLevel: 3,
      reductionPerLevel: 0.20,
    },
    sharpenedPicks: {
      baseCost: { stone: 5, florins: 40 },
      costScale: { stone: 3, florins: 40 },
      maxLevel: 6,
      bonusPerLevel: 1,
    },
    olivePressExpansion: {
      baseCost: { florins: 120, stone: 10 },
      costScale: { florins: 90, stone: 8 },
      maxAdditionalPresses: 5,
    },
    autoShipOil: {
      cost: { florins: 150, stone: 30 },
    },
    groveExpansion: [
      { idSuffix: 1, florinCost: 45, stoneCost: 5, capacityBonus: 20 },
      { idSuffix: 2, florinCost: 75, stoneCost: 12, capacityBonus: 25 },
      { idSuffix: 3, florinCost: 200, stoneCost: 25, capacityBonus: 35 },
    ],
    harvestBaskets: {
      baseCost: { florins: 20, stone: 3 },
      costScale: { florins: 15, stone: 3 },
      maxLevel: 5,
      bonusPerLevel: 2,
    },
    shippingEfficiency: {
      olives: [
        { idSuffix: 1, cost: 25, capacityBonus: 10 },
        { idSuffix: 2, cost: 50, capacityBonus: 10 },
        { idSuffix: 3, cost: 100, capacityBonus: 10 },
      ],
    },
  },
};
