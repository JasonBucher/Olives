import { describe, it, expect } from 'vitest';
import { computeHarvestOutcomeChances, TUNING } from './test-utils.js';

/**
 * Tests for debug helper functions
 * 
 * These tests validate that debug utilities return correct data
 * and prevent wiring mistakes in debug UI.
 */

describe('Debug Helpers', () => {
  describe('getCurrentHarvestOutcomeChances simulation', () => {
    it('should return finite probabilities that sum to 1', () => {
      // Simulate what getCurrentHarvestOutcomeChances() does in game
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      // All probabilities must be finite
      chances.forEach(outcome => {
        expect(Number.isFinite(outcome.weight)).toBe(true);
      });

      // Sum must equal 1.0
      const sum = chances.reduce((acc, o) => acc + o.weight, 0);
      expect(sum).toBeCloseTo(1.0, 9);
    });

    it('should contain all expected outcome keys', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: true,
        upgrades: {
          standardized_tools: true,
          training_program: true,
        },
        tuning: TUNING.harvest,
      });

      const keys = chances.map(o => o.key);
      
      // Verify expected keys exist
      expect(keys).toContain('poor');
      expect(keys).toContain('normal');
      expect(keys).toContain('efficient');
      expect(keys).toContain('interrupted_short');
      
      // Verify count matches base outcomes
      expect(chances.length).toBe(TUNING.harvest.outcomes.length);
    });

    it('should return probabilities that respond to state changes', () => {
      // With 0 harvesters
      const zeroHarvesters = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 0,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      // With 10 harvesters
      const tenHarvesters = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const poorZero = zeroHarvesters.find(o => o.key === 'poor').weight;
      const poorTen = tenHarvesters.find(o => o.key === 'poor').weight;

      // More harvesters should increase poor chance
      expect(poorTen).toBeGreaterThan(poorZero);
    });

    it('should return probabilities as decimals between 0 and 1', () => {
      const chances = computeHarvestOutcomeChances({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      chances.forEach(outcome => {
        expect(outcome.weight).toBeGreaterThanOrEqual(0);
        expect(outcome.weight).toBeLessThanOrEqual(1);
      });
    });
  });
});
