// Shared harvest weight calculation logic
// Used by both the game and unit tests
// This is a pure module with no DOM or global state dependencies

// Re-export BASE_HARVEST_OUTCOMES for backwards compatibility
// (In actual use, outcomes should come from TUNING.harvest.outcomes)
export { BASE_HARVEST_OUTCOMES } from './tuning.js';

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
 * @param {Object} params.tuning - Harvest tuning constants (deltas, caps, multipliers)
 * @returns {Array} Adjusted outcomes with modified weights (always sums to ~1.0)
 */
export function computeHarvestOutcomeWeights({ outcomes, harvesterCount, arboristIsActive, upgrades, tuning }) {
  // Extract values from new nested structure
  const poorWeightPerHarvester = tuning.poorWeightPerHarvester;
  const poorArboristMultiplier = tuning.arborist?.poorReductionMult ?? 0.5;
  const poorTrainingMultiplier = tuning.upgrades?.training_program?.poorMultiplierReduction ?? 0.5;
  const poorStandardizedToolsReduction = tuning.upgrades?.standardized_tools?.poorFlatReduction ?? 0.08;
  const efficientArboristBonus = tuning.arborist?.efficientBonus ?? 0.05;
  const efficientSelectivePickingBonus = tuning.upgrades?.selective_picking?.efficientBonus ?? 0.06;
  const efficientLaddersNetsPerHarvester = tuning.upgrades?.ladders_nets?.efficientPerHarvester ?? 0.01;
  const efficientLaddersNetsCap = tuning.upgrades?.ladders_nets?.efficientCap ?? 0.08;
  const efficientQualityInspectorBonus = tuning.upgrades?.quality_inspector?.efficientBonusWithArborist ?? 0.08;

  // Calculate deltas for poor weight
  // Base: +per harvester
  // Arborist: reduces multiplier
  // training_program: further reduces multiplier
  let multiplier = arboristIsActive ? poorArboristMultiplier : 1;
  if (upgrades.training_program) {
    multiplier *= poorTrainingMultiplier;
  }
  const poorWeightDelta = harvesterCount * poorWeightPerHarvester * multiplier;

  // standardized_tools provides flat reduction to poor weight
  const poorFlatReduction = upgrades.standardized_tools ? poorStandardizedToolsReduction : 0;
  const deltaPoor = poorWeightDelta - poorFlatReduction;

  // Calculate bonuses for efficient weight
  let efficientBonus = 0;

  // Arborist base bonus
  if (arboristIsActive) {
    efficientBonus += efficientArboristBonus;
  }

  // selective_picking adds flat bonus
  if (upgrades.selective_picking) {
    efficientBonus += efficientSelectivePickingBonus;
  }

  // ladders_nets adds bonus scaling with harvesters (capped)
  if (upgrades.ladders_nets) {
    const scaledBonus = Math.min(harvesterCount * efficientLaddersNetsPerHarvester, efficientLaddersNetsCap);
    efficientBonus += scaledBonus;
  }

  // quality_inspector amplifies arborist benefits
  if (upgrades.quality_inspector && arboristIsActive) {
    efficientBonus += efficientQualityInspectorBonus;
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
