// ═══════════════════════════════════════════════════════════════════════════════
// PRESS OUTCOME PROBABILITY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
//
// SINGLE SOURCE OF TRUTH: computePressOutcomeChances()
//
// This module enforces a HARD INVARIANT for all press outcome probabilities:
//   ✓ All chances are finite (no NaN/Infinity)
//   ✓ All chances >= 0
//   ✓ Sum of chances == 1.0 (within epsilon 1e-9)
//
// USAGE:
//   - UI Preview: calculatePresserHirePreview() in game.js uses computePressOutcomeChances()
//   - Press Resolution: startPressing() in game.js uses computePressOutcomeChances()
//
// ARCHITECTURE:
//   1. computePressOutcomeWeights() [INTERNAL] - Computes raw adjusted weights (may not sum to 1)
//   2. normalizeOutcomes() [HELPER] - Clamps negatives, checks total, normalizes to probabilities
//   3. computePressOutcomeChances() [PUBLIC API] - Combines 1+2, guarantees invariant
//
// NEVER use raw weights from computePressOutcomeWeights() for UI or gameplay logic.
// ALWAYS use computePressOutcomeChances() which enforces the invariant.
// ═══════════════════════════════════════════════════════════════════════════════

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
    console.warn('[pressWeights] Invalid weight total, falling back to base outcomes', { total, outcomes });
    const baseTotal = baseOutcomes.reduce((sum, o) => sum + o.weight, 0);
    return baseOutcomes.map(o => ({
      ...o,
      weight: o.weight / baseTotal
    }));
  }
  
  // Normalize to probabilities (sum to 1)
  const normalized = clamped.map(o => ({
    ...o,
    weight: o.weight / total
  }));
  
  // Validate invariant
  const finalSum = normalized.reduce((sum, o) => sum + o.weight, 0);
  const epsilon = 1e-9;
  if (Math.abs(finalSum - 1.0) > epsilon) {
    console.warn('[pressWeights] Normalization failed invariant check', { finalSum, epsilon });
  }
  
  return normalized;
}

/**
 * Computes raw adjusted weights for press outcomes based on presser count and modifiers.
 * 
 * INTERNAL USE ONLY - does not guarantee normalized probabilities.
 * Use computePressOutcomeChances() for gameplay/UI logic.
 * 
 * @param {Object} params
 * @param {Array} params.outcomes - Base outcomes from tuning
 * @param {number} params.presserCount - Number of pressers hired
 * @param {boolean} params.pressManagerIsActive - Whether press manager is active and paid
 * @param {Object} params.upgrades - Upgrade state object
 * @param {Object} params.tuning - Press tuning object with weightModifiers
 * @returns {Array} Outcomes with adjusted weights (NOT normalized)
 */
function computePressOutcomeWeights({
  outcomes,
  presserCount,
  pressManagerIsActive,
  upgrades,
  tuning,
}) {
  // Start with a copy of base outcomes
  const adjusted = outcomes.map(o => ({ ...o }));
  
  const perPresser = tuning.weightModifiers?.perPresser || {};
  const pressManager = tuning.weightModifiers?.pressManager || {};
  
  // Apply per-presser modifiers (shift quality with each hire)
  if (presserCount > 0) {
    for (const outcome of adjusted) {
      const delta = perPresser[`${outcome.key}Delta`] || 0;
      outcome.weight += delta * presserCount;
    }
  }
  
  // Apply press manager modifiers when active
  if (pressManagerIsActive) {
    for (const outcome of adjusted) {
      // Reduce poor weight
      if (outcome.key === 'poor' && pressManager.poorMultiplier !== undefined) {
        outcome.weight *= pressManager.poorMultiplier;
      }
      
      // Boost masterwork
      if (outcome.key === 'masterwork' && pressManager.masterworkBonus !== undefined) {
        outcome.weight += pressManager.masterworkBonus;
      }
      
      // Boost excellent
      if (outcome.key === 'excellent' && pressManager.excellentBonus !== undefined) {
        outcome.weight += pressManager.excellentBonus;
      }
    }
  }
  
  return adjusted;
}

/**
 * Computes normalized press outcome chances (probabilities 0..1 summing to 1).
 * 
 * PUBLIC API - This is the single source of truth for press probabilities.
 * ALWAYS use this function for gameplay logic and UI displays.
 * 
 * GUARANTEES:
 * - All chances are finite (no NaN/Infinity)
 * - All chances >= 0
 * - Sum of chances == 1 (within epsilon)
 * 
 * @param {Object} params
 * @param {Array} params.outcomes - Base outcomes from TUNING.production.olivePress.outcomes
 * @param {number} params.presserCount - Number of pressers hired
 * @param {boolean} params.pressManagerIsActive - Whether press manager is active and paid
 * @param {Object} params.upgrades - Upgrade state object (for future extensions)
 * @param {Object} params.tuning - TUNING.production.olivePress
 * @returns {Array} Outcomes with normalized weight property (probabilities 0..1)
 */
export function computePressOutcomeChances({
  outcomes,
  presserCount,
  pressManagerIsActive,
  upgrades,
  tuning,
}) {
  // Compute adjusted weights
  const adjusted = computePressOutcomeWeights({
    outcomes,
    presserCount,
    pressManagerIsActive,
    upgrades,
    tuning,
  });
  
  // Normalize to valid probability distribution
  return normalizeOutcomes(adjusted, outcomes);
}
