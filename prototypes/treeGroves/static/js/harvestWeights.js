// Shared harvest weight calculation logic
// Used by both the game and unit tests
// This is a pure module with no DOM or global state dependencies

/**
 * Base harvest outcome configuration
 * These are the baseline probabilities before any modifiers
 */
export const BASE_HARVEST_OUTCOMES = [
  { key: "interrupted_short", weight: 0.10, durationMs: 2000, collectedPct: 0.30, lostPct: 0.00 },
  { key: "poor", weight: 0.25, durationMs: 5500, collectedPct: 0.50, lostPct: 0.50 },
  { key: "normal", weight: 0.55, durationMs: 4500, collectedPct: 0.80, lostPct: 0.20 },
  { key: "efficient", weight: 0.10, durationMs: 3500, collectedPct: 1.00, lostPct: 0.00 },
];

/**
 * Pure function: Compute adjusted harvest outcome weights
 * 
 * Calculates outcome probabilities based on harvesters, arborist status, and upgrades.
 * The function maintains probability conservation by adjusting "normal" to compensate
 * for changes to "poor" and "efficient" outcomes.
 * 
 * @param {Object} params
 * @param {Array} params.outcomes - Base harvest outcomes with weights
 * @param {number} params.harvesterCount - Number of harvesters (affects poor weight)
 * @param {boolean} params.arboristIsActive - Whether arborist is active (reduces poor, boosts efficient)
 * @param {Object} params.upgrades - Upgrade flags (standardized_tools, training_program, etc.)
 * @returns {Array} Adjusted outcomes with modified weights (always sums to ~1.0)
 */
export function computeHarvestOutcomeWeights({ outcomes, harvesterCount, arboristIsActive, upgrades }) {
  // Calculate deltas for poor weight
  // Base: +0.01 per harvester
  // Arborist: reduces multiplier by 50%
  // training_program: further reduces multiplier by 50%
  let multiplier = arboristIsActive ? 0.5 : 1;
  if (upgrades.training_program) {
    multiplier *= 0.5;
  }
  const poorWeightDelta = harvesterCount * 0.01 * multiplier;
  
  // standardized_tools provides flat reduction to poor weight
  const poorFlatReduction = upgrades.standardized_tools ? 0.08 : 0;
  const deltaPoor = poorWeightDelta - poorFlatReduction;
  
  // Calculate bonuses for efficient weight
  let efficientBonus = 0;
  
  // Arborist base bonus
  if (arboristIsActive) {
    efficientBonus += 0.05;
  }
  
  // selective_picking adds flat bonus
  if (upgrades.selective_picking) {
    efficientBonus += 0.06;
  }
  
  // ladders_nets adds bonus scaling with harvesters (capped)
  if (upgrades.ladders_nets) {
    const scaledBonus = Math.min(harvesterCount * 0.01, 0.08);
    efficientBonus += scaledBonus;
  }
  
  // quality_inspector amplifies arborist benefits
  if (upgrades.quality_inspector && arboristIsActive) {
    efficientBonus += 0.08;
  }
  
  const deltaEff = efficientBonus;
  
  // Apply deltas to outcome weights
  // - interrupted_short: unchanged
  // - poor: increases with harvesters, reduced by upgrades
  // - normal: compensates to maintain probability mass
  // - efficient: increases with arborist and upgrades
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
