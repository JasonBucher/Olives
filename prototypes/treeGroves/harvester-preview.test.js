import { describe, it, expect } from 'vitest';
import { computeHarvestOutcomeWeights, TUNING } from './test-utils.js';

/**
 * Unit tests for harvester hire preview calculations
 * 
 * These tests ensure the preview computation never produces NaN values
 * and that the poor chance probability is always finite and valid.
 * 
 * Regression prevention: The preview previously showed "NaN → NaN" 
 * because it was displaying raw weights instead of normalized probabilities.
 */

describe('Harvester Hire Preview', () => {
  // Helper to extract poor outcome weight
  const getPoorWeight = (outcomes) => {
    const poor = outcomes.find(o => o.key === 'poor');
    return poor?.weight ?? 0;
  };

  // Helper to sum weights (for verification)
  const sumWeights = (outcomes) => outcomes.reduce((sum, o) => sum + o.weight, 0);

  describe('Poor chance computation safety', () => {
    it('should return finite poor weight with 0 harvesters', () => {
      const weights = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 0,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const poorWeight = getPoorWeight(weights);
      expect(Number.isFinite(poorWeight)).toBe(true);
      expect(poorWeight).toBeGreaterThanOrEqual(0);
      expect(poorWeight).toBeLessThanOrEqual(1);
    });

    it('should return finite poor weight with 5 harvesters, no arborist', () => {
      const weights = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const poorWeight = getPoorWeight(weights);
      expect(Number.isFinite(poorWeight)).toBe(true);
      expect(poorWeight).toBeGreaterThanOrEqual(0);
      expect(poorWeight).toBeLessThanOrEqual(1);
    });

    it('should return finite poor weight with 10 harvesters and arborist', () => {
      const weights = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const poorWeight = getPoorWeight(weights);
      expect(Number.isFinite(poorWeight)).toBe(true);
      expect(poorWeight).toBeGreaterThanOrEqual(0);
      expect(poorWeight).toBeLessThanOrEqual(1);
    });

    it('should return finite poor weight with all upgrades active', () => {
      const weights = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 8,
        arboristIsActive: true,
        upgrades: {
          standardized_tools: true,
          training_program: true,
          selective_picking: true,
          ladders_nets: true,
          quality_inspector: true,
        },
        tuning: TUNING.harvest,
      });

      const poorWeight = getPoorWeight(weights);
      expect(Number.isFinite(poorWeight)).toBe(true);
      expect(poorWeight).toBeGreaterThanOrEqual(0);
      expect(poorWeight).toBeLessThanOrEqual(1);
    });
  });

  describe('Before → After preview calculations', () => {
    it('should show valid poor chance transition from 0 to 1 harvester', () => {
      const currentWeights = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 0,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const nextWeights = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 1,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const currentPoor = getPoorWeight(currentWeights);
      const nextPoor = getPoorWeight(nextWeights);

      // Both should be finite
      expect(Number.isFinite(currentPoor)).toBe(true);
      expect(Number.isFinite(nextPoor)).toBe(true);

      // Next should be higher (more harvesters = more poor outcomes)
      expect(nextPoor).toBeGreaterThan(currentPoor);
    });

    it('should show valid poor chance transition from 5 to 6 harvesters', () => {
      const currentWeights = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const nextWeights = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 6,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const currentPoor = getPoorWeight(currentWeights);
      const nextPoor = getPoorWeight(nextWeights);

      expect(Number.isFinite(currentPoor)).toBe(true);
      expect(Number.isFinite(nextPoor)).toBe(true);
      expect(nextPoor).toBeGreaterThan(currentPoor);
    });

    it('should show mitigated poor increase with arborist active', () => {
      const currentWeights = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 3,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const nextWeights = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 4,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const currentPoor = getPoorWeight(currentWeights);
      const nextPoor = getPoorWeight(nextWeights);

      expect(Number.isFinite(currentPoor)).toBe(true);
      expect(Number.isFinite(nextPoor)).toBe(true);

      // Still increases, but the delta should be smaller than without arborist
      const arboristDelta = nextPoor - currentPoor;

      // Compare to no-arborist case
      const noArboristCurrent = getPoorWeight(computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 3,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      }));

      const noArboristNext = getPoorWeight(computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 4,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      }));

      const noArboristDelta = noArboristNext - noArboristCurrent;

      // Arborist should reduce the increase
      expect(arboristDelta).toBeLessThan(noArboristDelta);
    });
  });

  describe('Total weight validation', () => {
    it('should have non-zero total weight in all scenarios', () => {
      const scenarios = [
        { count: 0, arborist: false, upgrades: {} },
        { count: 5, arborist: false, upgrades: {} },
        { count: 10, arborist: true, upgrades: {} },
        { count: 15, arborist: true, upgrades: { standardized_tools: true } },
        { count: 20, arborist: true, upgrades: { 
          standardized_tools: true,
          training_program: true,
          selective_picking: true,
          ladders_nets: true,
          quality_inspector: true,
        }},
      ];

      scenarios.forEach(({ count, arborist, upgrades }) => {
        const weights = computeHarvestOutcomeWeights({
          outcomes: TUNING.harvest.outcomes,
          harvesterCount: count,
          arboristIsActive: arborist,
          upgrades,
          tuning: TUNING.harvest,
        });

        const total = sumWeights(weights);
        
        // Total weight should always be positive and close to 1.0
        expect(total).toBeGreaterThan(0);
        expect(total).toBeCloseTo(1.0, 5);
        
        // All individual weights should be finite
        weights.forEach(outcome => {
          expect(Number.isFinite(outcome.weight)).toBe(true);
          expect(outcome.weight).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  describe('Edge cases and defensive checks', () => {
    it('should handle extreme harvester counts without NaN', () => {
      const weights = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 100,
        arboristIsActive: true,
        upgrades: {
          standardized_tools: true,
          training_program: true,
        },
        tuning: TUNING.harvest,
      });

      const poorWeight = getPoorWeight(weights);
      expect(Number.isFinite(poorWeight)).toBe(true);
      
      // Even with 100 harvesters, poor weight should be clamped
      expect(poorWeight).toBeGreaterThanOrEqual(0);
      expect(poorWeight).toBeLessThanOrEqual(1);
    });

    it('should handle missing poor outcome gracefully', () => {
      // Test with outcomes that don't include "poor" key
      const customOutcomes = [
        { key: "normal", weight: 0.80, durationMs: 4500, collectedPct: 0.80, lostPct: 0.20 },
        { key: "efficient", weight: 0.20, durationMs: 3500, collectedPct: 1.00, lostPct: 0.00 },
      ];

      const weights = computeHarvestOutcomeWeights({
        outcomes: customOutcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const poorWeight = getPoorWeight(weights);
      
      // Should return 0 (fallback value) not NaN
      expect(poorWeight).toBe(0);
      expect(Number.isFinite(poorWeight)).toBe(true);
    });
  });

  describe('Percentage conversion safety', () => {
    it('should produce valid percentages from all weight values', () => {
      const testCounts = [0, 1, 5, 10, 15, 20];
      
      testCounts.forEach(count => {
        const weights = computeHarvestOutcomeWeights({
          outcomes: TUNING.harvest.outcomes,
          harvesterCount: count,
          arboristIsActive: false,
          upgrades: {},
          tuning: TUNING.harvest,
        });

        const poorWeight = getPoorWeight(weights);
        const percentage = poorWeight * 100;

        expect(Number.isFinite(percentage)).toBe(true);
        expect(percentage).toBeGreaterThanOrEqual(0);
        expect(percentage).toBeLessThanOrEqual(100);
      });
    });
  });
});
