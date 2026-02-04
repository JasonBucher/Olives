// Test utilities - exports pure functions for testing
// This file is only used by tests, not by the game itself

// Base harvest outcomes (matching harvestConfig in game.js)
export const BASE_HARVEST_OUTCOMES = [
  { key: "interrupted_short", weight: 0.10, durationMs: 2000, collectedPct: 0.30, lostPct: 0.00 },
  { key: "poor", weight: 0.25, durationMs: 5500, collectedPct: 0.50, lostPct: 0.50 },
  { key: "normal", weight: 0.55, durationMs: 4500, collectedPct: 0.80, lostPct: 0.20 },
  { key: "efficient", weight: 0.10, durationMs: 3500, collectedPct: 1.00, lostPct: 0.00 },
];

/**
 * Pure function: Compute adjusted harvest outcome weights
 * 
 * @param {Object} params
 * @param {Array} params.outcomes - Base harvest outcomes with weights
 * @param {number} params.harvesterCount - Number of harvesters
 * @param {boolean} params.arboristIsActive - Whether arborist is active
 * @param {Object} params.upgrades - Upgrade flags (standardized_tools, training_program, etc.)
 * @returns {Array} Adjusted outcomes with modified weights
 */
export function computeHarvestOutcomeWeights({ outcomes, harvesterCount, arboristIsActive, upgrades }) {
  // Calculate deltas
  let multiplier = arboristIsActive ? 0.5 : 1;
  if (upgrades.training_program) {
    multiplier *= 0.5;
  }
  const poorWeightDelta = harvesterCount * 0.01 * multiplier;
  
  const poorFlatReduction = upgrades.standardized_tools ? 0.08 : 0;
  const deltaPoor = poorWeightDelta - poorFlatReduction;
  
  let efficientBonus = 0;
  if (arboristIsActive) {
    efficientBonus += 0.05;
  }
  if (upgrades.selective_picking) {
    efficientBonus += 0.06;
  }
  if (upgrades.ladders_nets) {
    const scaledBonus = Math.min(harvesterCount * 0.01, 0.08);
    efficientBonus += scaledBonus;
  }
  if (upgrades.quality_inspector && arboristIsActive) {
    efficientBonus += 0.08;
  }
  const deltaEff = efficientBonus;
  
  // Apply deltas to outcome weights
  const adjustedOutcomes = outcomes.map(o => {
    if (o.key === "poor") {
      return { ...o, weight: Math.max(0, o.weight + deltaPoor) };
    } else if (o.key === "efficient") {
      return { ...o, weight: Math.max(0, o.weight + deltaEff) };
    } else if (o.key === "normal") {
      // Normal compensates to conserve probability mass
      return { ...o, weight: Math.max(0, o.weight - deltaPoor - deltaEff) };
    } else {
      // interrupted_short and others remain unchanged
      return { ...o };
    }
  });
  
  return adjustedOutcomes;
}
