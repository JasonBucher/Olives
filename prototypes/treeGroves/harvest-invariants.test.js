import { describe, it, expect } from 'vitest';
import { computeHarvestOutcomeChances, TUNING } from './test-utils.js';

/**
 * INVARIANT TESTS for Harvest Outcome Probabilities
 * 
 * These tests enforce the fundamental invariant that harvest outcome chances
 * ALWAYS form a valid probability distribution, regardless of game state.
 * 
 * INVARIANT:
 * - All chances are finite (no NaN/Infinity)
 * - All chances >= 0
 * - Sum of chances == 1.0 (within epsilon)
 * 
 * These tests are designed to catch regressions that would break:
 * - UI previews showing "Poor: NaN%"
 * - Probability drift causing gameplay inconsistencies
 * - Edge cases with extreme tuning or state values
 */

describe('Harvest Outcome Invariants', () => {
  const EPSILON = 1e-9; // Tolerance for floating point comparison

  // Helper to validate invariant on a set of outcomes
  const validateInvariant = (outcomes, context = '') => {
    const prefix = context ? `[${context}] ` : '';
    
    // Check each outcome is finite and non-negative
    outcomes.forEach(outcome => {
      expect(Number.isFinite(outcome.weight), 
        `${prefix}${outcome.key} chance must be finite`).toBe(true);
      expect(outcome.weight, 
        `${prefix}${outcome.key} chance must be >= 0`).toBeGreaterThanOrEqual(0);
    });
    
    // Check sum equals 1
    const sum = outcomes.reduce((acc, o) => acc + o.weight, 0);
    expect(Math.abs(sum - 1.0), 
      `${prefix}Sum of chances must equal 1.0, got ${sum}`).toBeLessThan(EPSILON);
    
    return true;
  };

  describe('Basic state combinations', () => {
    it('should maintain invariant with 0 harvesters, no arborist, no upgrades', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 0,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, '0 harvesters');
    });

    it('should maintain invariant with 1 harvester, no arborist, no upgrades', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 1,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, '1 harvester');
    });

    it('should maintain invariant with 10 harvesters, no arborist, no upgrades', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, '10 harvesters');
    });

    it('should maintain invariant with 100 harvesters, no arborist, no upgrades', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 100,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, '100 harvesters');
    });
  });

  describe('Arborist combinations', () => {
    it('should maintain invariant with arborist active, 0 harvesters', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 0,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, 'arborist + 0 harvesters');
    });

    it('should maintain invariant with arborist active, 10 harvesters', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, 'arborist + 10 harvesters');
    });

    it('should maintain invariant with arborist active, 100 harvesters', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 100,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, 'arborist + 100 harvesters');
    });
  });

  describe('Upgrade combinations', () => {
    it('should maintain invariant with all upgrades, no arborist', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: false,
        upgrades: {
          standardized_tools: true,
          training_program: true,
          improved_harvesting: true,
        },
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, 'all upgrades');
    });

    it('should maintain invariant with all upgrades + arborist', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: true,
        upgrades: {
          standardized_tools: true,
          training_program: true,
          improved_harvesting: true,
        },
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, 'all upgrades + arborist');
    });

    it('should maintain invariant with standardized_tools only', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: { standardized_tools: true },
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, 'standardized_tools');
    });

    it('should maintain invariant with training_program only', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: { training_program: true },
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, 'training_program');
    });
  });

  describe('Extreme cases', () => {
    it('should maintain invariant with 1000 harvesters', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 1000,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, '1000 harvesters');
    });

    it('should maintain invariant with 1000 harvesters + all upgrades + arborist', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 1000,
        arboristIsActive: true,
        upgrades: {
          standardized_tools: true,
          training_program: true,
          improved_harvesting: true,
        },
        tuning: TUNING.harvest,
      });

      validateInvariant(chances, '1000 harvesters + all modifiers');
    });

    it('should maintain invariant with worst-case tuning (huge bonuses)', () => {
      // Temporarily override tuning with extreme values
      const extremeTuning = {
        poorWeightPerHarvester: 1.0, // Huge poor increase
        arborist: {
          poorReductionMult: 0.01, // Tiny reduction (almost no effect)
          efficientBonus: 2.0, // Huge efficient bonus
        },
        upgrades: {
          standardized_tools: {
            poorFlatReduction: 5.0, // Huge flat reduction
          },
          training_program: {
            poorMultiplierReduction: 0.01,
          },
          improved_harvesting: {
            efficientBonus: 3.0,
            efficientPerHarvester: 0.5,
            efficientCap: 50.0,
          },
        },
      };

      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 50,
        arboristIsActive: true,
        upgrades: {
          standardized_tools: true,
          training_program: true,
          improved_harvesting: true,
        },
        tuning: extremeTuning,
      });

      validateInvariant(chances, 'extreme tuning values');
    });

    it('should handle zero-weight edge case gracefully', () => {
      // Create outcomes where adjustments might zero everything
      const zeroTuning = {
        poorWeightPerHarvester: 0,
        arborist: {
          poorReductionMult: 0,
          efficientBonus: 0,
        },
        upgrades: {
          standardized_tools: { poorFlatReduction: 100 }, // Huge reduction
          training_program: { poorMultiplierReduction: 0 },
          improved_harvesting: { efficientBonus: 0, efficientPerHarvester: 0, efficientCap: 0 },
        },
      };

      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: true,
        upgrades: { standardized_tools: true },
        tuning: zeroTuning,
      });

      validateInvariant(chances, 'zero-weight edge case');
    });
  });

  describe('Outcome key presence', () => {
    it('should always include expected outcome keys', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const keys = chances.map(o => o.key);
      
      // Check for expected keys from base outcomes
      expect(keys).toContain('poor');
      expect(keys).toContain('normal');
      expect(keys).toContain('efficient');
      expect(keys).toContain('interrupted_short');
    });

    it('should maintain all original outcome keys even if weight goes to 0', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 100,
        arboristIsActive: true,
        upgrades: {
          standardized_tools: true,
          training_program: true,
        },
        tuning: TUNING.harvest,
      });

      // All base outcome keys should still be present
      expect(chances.length).toBe(TUNING.harvest.outcomes.length);
    });
  });

  describe('Preview-specific invariants', () => {
    it('should never produce NaN for "before" poor chance', () => {
      // Test range of harvester counts
      for (let count = 0; count <= 20; count++) {
        const chances = computeHarvestOutcomeChances({
          outcomes: TUNING.harvest.outcomes,
          harvesterCount: count,
          arboristIsActive: false,
          upgrades: {},
          tuning: TUNING.harvest,
        });

        const poorOutcome = chances.find(o => o.key === 'poor');
        expect(poorOutcome).toBeDefined();
        expect(Number.isFinite(poorOutcome.weight)).toBe(true);
        expect(poorOutcome.weight).toBeGreaterThanOrEqual(0);
        expect(poorOutcome.weight).toBeLessThanOrEqual(1);
      }
    });

    it('should produce valid before→after transition for preview', () => {
      // Simulate what the preview does
      const currentCount = 5;
      const nextCount = 6;

      const currentChances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: currentCount,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const nextChances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: nextCount,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const currentPoor = currentChances.find(o => o.key === 'poor')?.weight ?? 0;
      const nextPoor = nextChances.find(o => o.key === 'poor')?.weight ?? 0;

      // Both should be valid probabilities
      expect(Number.isFinite(currentPoor)).toBe(true);
      expect(Number.isFinite(nextPoor)).toBe(true);
      expect(currentPoor).toBeGreaterThanOrEqual(0);
      expect(currentPoor).toBeLessThanOrEqual(1);
      expect(nextPoor).toBeGreaterThanOrEqual(0);
      expect(nextPoor).toBeLessThanOrEqual(1);

      // Converting to percentage should never produce NaN
      const currentPct = currentPoor * 100;
      const nextPct = nextPoor * 100;
      expect(Number.isFinite(currentPct)).toBe(true);
      expect(Number.isFinite(nextPct)).toBe(true);
    });
  });

  describe('Stress test: comprehensive state sweep', () => {
    it('should maintain invariant across all realistic game states', () => {
      const harvesterCounts = [0, 1, 5, 10, 20, 50];
      const arboristStates = [false, true];
      const upgradeConfigs = [
        {},
        { standardized_tools: true },
        { training_program: true },
        { improved_harvesting: true },
        { standardized_tools: true, training_program: true },
        { 
          standardized_tools: true,
          training_program: true,
          improved_harvesting: true,
        },
      ];

      let testCount = 0;
      for (const count of harvesterCounts) {
        for (const arborist of arboristStates) {
          for (const upgrades of upgradeConfigs) {
            const chances = computeHarvestOutcomeChances({
              outcomes: TUNING.harvest.outcomes,
              harvesterCount: count,
              arboristIsActive: arborist,
              upgrades,
              tuning: TUNING.harvest,
            });

            validateInvariant(chances, 
              `H:${count} A:${arborist} U:${Object.keys(upgrades).length}`);
            testCount++;
          }
        }
      }

      // Verify we actually tested a comprehensive set
      expect(testCount).toBeGreaterThan(70); // 6 * 2 * 7 = 84
    });
  });
});
