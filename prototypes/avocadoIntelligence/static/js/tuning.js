// Centralized tuning constants for Avocado Intelligence.
// Rule: zero hardcoded game numbers elsewhere. Every balance-relevant
// value lives here so you can tweak the feel in one place.

export const TUNING = {
  production: {
    baseClickYield: 1,   // avocados per click
    tickMs: 200,          // main loop interval
  },

  prestige: {
    unlockThreshold: 1000,       // total avocados needed to prestige
    multiplierPerPrestige: 0.5,  // +50% per prestige
  },
};
