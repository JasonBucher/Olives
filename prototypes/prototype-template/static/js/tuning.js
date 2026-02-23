// Centralized tuning constants for the prototype.
// Rule: zero hardcoded game numbers elsewhere. Every balance-relevant
// value lives here so you can tweak the feel in one place.

export const TUNING = {
  // -- Production --
  production: {
    baseClickYield: 1,   // resources per click
    tickMs: 200,          // main loop interval
  },

  // -- Market --
  market: {
    baseSellPrice: 1,     // florins per unit sold
  },
};
