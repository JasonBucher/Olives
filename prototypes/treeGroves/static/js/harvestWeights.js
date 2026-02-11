// ═══════════════════════════════════════════════════════════════════════════════
// HARVEST OUTCOME PROBABILITY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
//
// SINGLE SOURCE OF TRUTH: computeHarvestOutcomeChances()
//
// This module enforces a HARD INVARIANT for all harvest outcome probabilities:
//   ✓ All chances are finite (no NaN/Infinity)
//   ✓ All chances >= 0
//   ✓ Sum of chances == 1.0 (within epsilon 1e-9)
//
// USAGE:
//   - UI Preview: calculateHarvesterHirePreview() in game.js uses computeHarvestOutcomeChances()
//   - Harvest Resolution: startHarvest() in game.js uses computeHarvestOutcomeChances()
//   - Tests: harvest-invariants.test.js validates invariant holds across 90+ scenarios
//
// ARCHITECTURE:
//   1. computeHarvestOutcomeWeights() [INTERNAL] - Computes raw adjusted weights (may not sum to 1)
//   2. normalizeOutcomes() [HELPER] - Clamps negatives, checks total, normalizes to probabilities
//   3. computeHarvestOutcomeChances() [PUBLIC API] - Combines 1+2, guarantees invariant
//
// NEVER use raw weights from computeHarvestOutcomeWeights() for UI or gameplay logic.
// ALWAYS use computeHarvestOutcomeChances() which enforces the invariant.
// ═══════════════════════════════════════════════════════════════════════════════

// Re-export BASE_HARVEST_OUTCOMES for backwards compatibility
// (In actual use, outcomes should come from TUNING.harvest.outcomes)
export { BASE_HARVEST_OUTCOMES } from './tuning.js';

/**
 * Normalizes outcome weights to ensure they form a valid probability distribution.
 * 
 * INVARIANT: Returns outcomes where:
 * - All chances are finite (no NaN/Infinity)
 * - All chances >= 0
 * - Sum of chances == 1 (within epsilon)
 * 
 * @param {Array} outcomes - Outcomes with weight property
 * @param {Array} baseOutcomes - Original outcomes to fall back to if normalization fails
 * @returns {Array} Outcomes with normalized weight property (now representing chances 0..1)
 */
function normalizeOutcomes(outcomes, baseOutcomes) {
  // Clamp negative weights to 0 and filter out invalid values
  const clamped = outcomes.map(o => ({
    ...o,
    weight: Number.isFinite(o.weight) ? Math.max(0, o.weight) : 0
  }));
  
  // Compute total
  const total = clamped.reduce((sum, o) => sum + o.weight, 0);
  
  // If total is invalid or zero, fall back to base outcomes
  if (!Number.isFinite(total) || total <= 0) {
    console.warn('Harvest outcome normalization failed (total=' + total + '), falling back to base outcomes');
    // Use base outcomes as fallback
    if (baseOutcomes && baseOutcomes.length > 0) {
      return normalizeOutcomes(baseOutcomes, null); // Recursive with base
    }
    // Ultimate fallback: return equal distribution
    return outcomes.map(o => ({ ...o, weight: 1 / outcomes.length }));
  }
  
  // Normalize: divide each weight by total to get chances (0..1)
  return clamped.map(o => ({
    ...o,
    weight: o.weight / total
  }));
}

/**
 * INTERNAL: Compute adjusted harvest outcome weights (before normalization).
 * 
 * This function applies modifiers from harvesters, arborist, and upgrades to base weights.
 * Weights may go negative or sum to != 1, so normalization is required.
 * 
 * Use computeHarvestOutcomeChances() instead - this is the public API.
 * 
 * @param {Object} params
 * @param {Array} params.outcomes - Base harvest outcomes with weights
 * @param {number} params.harvesterCount - Number of harvesters (affects poor weight)
 * @param {boolean} params.arboristIsActive - Whether arborist is active (reduces poor, boosts efficient)
 * @param {Object} params.upgrades - Upgrade flags (selective_picking, ladders_nets, etc.)
 * @param {Object} params.tuning - Harvest tuning constants (deltas, caps, multipliers)
 * @returns {Array} Adjusted outcomes with modified weights (NOT normalized - internal use only)
 */
function computeHarvestOutcomeWeights({ outcomes, harvesterCount, arboristIsActive, upgrades, tuning }) {
  // Extract values from new nested structure
  const poorWeightPerHarvester = tuning.poorWeightPerHarvester;
  const poorArboristMultiplier = tuning.arborist?.poorReductionMult ?? 0.5;
  const efficientArboristBonus = tuning.arborist?.efficientBonus ?? 0.05;
  const efficientSelectivePickingBonus = tuning.upgrades?.selective_picking?.efficientBonus ?? 0.06;
  const efficientLaddersNetsPerHarvester = tuning.upgrades?.ladders_nets?.efficientPerHarvester ?? 0.01;
  const efficientLaddersNetsCap = tuning.upgrades?.ladders_nets?.efficientCap ?? 0.08;
  const efficientQualityInspectorBonus = tuning.upgrades?.quality_inspector?.efficientBonusWithArborist ?? 0.08;

  // Calculate deltas for poor weight
  // Base: +per harvester
  // Arborist: reduces multiplier
  const multiplier = arboristIsActive ? poorArboristMultiplier : 1;
  const deltaPoor = harvesterCount * poorWeightPerHarvester * multiplier;

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

/**
 * PUBLIC API: Compute normalized harvest outcome chances (probabilities).
 * 
 * This is the SINGLE SOURCE OF TRUTH for harvest outcome probabilities.
 * Always use this function for:
 * - UI previews (showing "Poor: 25% → 30%")
 * - Actual harvest resolution (rolling outcomes)
 * - Any display or calculation involving harvest probabilities
 * 
 * INVARIANT GUARANTEE:
 * - All returned chances are finite (no NaN/Infinity)
 * - All chances are >= 0
 * - Sum of all chances == 1.0 (within floating point epsilon)
 * 
 * The "weight" property in returned outcomes represents normalized probability (0..1).
 * 
 * @param {Object} params
 * @param {Array} params.outcomes - Base harvest outcomes with weights
 * @param {number} params.harvesterCount - Number of harvesters (affects poor weight)
 * @param {boolean} params.arboristIsActive - Whether arborist is active (reduces poor, boosts efficient)
 * @param {Object} params.upgrades - Upgrade flags (selective_picking, ladders_nets, etc.)
 * @param {Object} params.tuning - Harvest tuning constants (deltas, caps, multipliers)
 * @returns {Array} Outcomes where weight property is normalized chance (0..1, sums to 1)
 */
export function computeHarvestOutcomeChances({ outcomes, harvesterCount, arboristIsActive, upgrades, tuning }) {
  // Compute adjusted weights (may not sum to 1)
  const adjustedWeights = computeHarvestOutcomeWeights({
    outcomes,
    harvesterCount,
    arboristIsActive,
    upgrades,
    tuning
  });
  
  // Normalize to ensure valid probability distribution
  return normalizeOutcomes(adjustedWeights, outcomes);
}

// Legacy export for backwards compatibility
// DEPRECATED: Use computeHarvestOutcomeChances() instead
export { computeHarvestOutcomeWeights };
