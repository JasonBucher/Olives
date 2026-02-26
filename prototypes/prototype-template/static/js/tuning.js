// Centralized tuning constants for the prototype.
// Rule: zero hardcoded game numbers elsewhere. Every balance-relevant
// value lives here so you can tweak the feel in one place.

export const TUNING = {
  // -- Production --
  production: {
    baseClickYield: 1,
    basketBonusPerLevel: 1,
    tickMs: 200,
  },

  // -- Processing --
  processing: {
    olivesPerPress: 5,
    oilYieldPerPress: 1,
  },

  // -- Market --
  market: {
    baseSellPrice: 4,
    stallBonusMultiplier: 1.5,
  },

  // -- Investments --
  investments: {
    sharperPickCost: 30,
    sharperPickUnlockOlives: 10,
    biggerBasketBaseCost: 20,
    biggerBasketCostScale: 18,
    biggerBasketUnlockOlives: 15,
    marketStallCost: 40,
    marketStallUnlockFlorins: 10,
  },
};
