import { describe, it, expect } from 'vitest';
import { computeHarvestOutcomeWeights, TUNING } from './test-utils.js';

describe('computeHarvestOutcomeWeights', () => {
  // Helper to find outcome by key
  const findOutcome = (outcomes, key) => outcomes.find(o => o.key === key);

  // Helper: build {key -> weight} map
  const toMap = (outcomes) =>
    outcomes.reduce((acc, o) => {
      acc[o.key] = o.weight;
      return acc;
    }, {});

  describe('Baseline passthrough: with zero modifiers, weights match tuning', () => {
    it('should return exactly the tuning weights when harvesterCount=0 and no modifiers', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 0,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const base = toMap(TUNING.harvest.outcomes);
      const actual = toMap(result);

      // Same keys
      expect(Object.keys(actual).sort()).toEqual(Object.keys(base).sort());

      // Same weights (exact match is fine because no math should occur in this scenario)
      for (const key of Object.keys(base)) {
        expect(actual[key]).toBe(base[key]);
      }
    });
  });

  describe('Weights are safe to normalize', () => {
    it('should return finite, non-negative weights for a variety of states', () => {
      const scenarios = [
        { harvesterCount: 0, arboristIsActive: false, upgrades: {} },
        { harvesterCount: 5, arboristIsActive: false, upgrades: {} },
        { harvesterCount: 10, arboristIsActive: true, upgrades: {} },
        {
          harvesterCount: 8,
          arboristIsActive: true,
          upgrades: {
            standardized_tools: true,
            training_program: true,
            improved_harvesting: true,
          },
        },
        {
          harvesterCount: 20,
          arboristIsActive: true,
          upgrades: {
            standardized_tools: true,
            training_program: true,
            improved_harvesting: true,
          },
        },
      ];

      scenarios.forEach(({ harvesterCount, arboristIsActive, upgrades }) => {
        const result = computeHarvestOutcomeWeights({
          outcomes: TUNING.harvest.outcomes,
          harvesterCount,
          arboristIsActive,
          upgrades,
          tuning: TUNING.harvest,
        });

        result.forEach((o) => {
          expect(Number.isFinite(o.weight)).toBe(true);
          expect(o.weight).toBeGreaterThanOrEqual(0);
        });

        // Note: weights are allowed to NOT sum to 1.0.
        // Normalization happens in computeHarvestOutcomeChances().
      });
    });

    it('should always include all outcome keys from tuning', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 7,
        arboristIsActive: true,
        upgrades: { standardized_tools: true, improved_harvesting: true },
        tuning: TUNING.harvest,
      });

      const baseKeys = TUNING.harvest.outcomes.map(o => o.key).sort();
      const resultKeys = result.map(o => o.key).sort();
      expect(resultKeys).toEqual(baseKeys);
    });
  });

  describe('Specific weight adjustments (directional)', () => {
    it('should increase poor weight with more harvesters (no arborist, no upgrades)', () => {
      const baseline = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 0,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const withHarvesters = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const baselinePoor = findOutcome(baseline, 'poor').weight;
      const withHarvestersPoor = findOutcome(withHarvesters, 'poor').weight;

      expect(withHarvestersPoor).toBeGreaterThan(baselinePoor);
    });

    it('should reduce poor weight increase when arborist is active', () => {
      const noArborist = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const withArborist = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const noArboristPoor = findOutcome(noArborist, 'poor').weight;
      const withArboristPoor = findOutcome(withArborist, 'poor').weight;

      expect(withArboristPoor).toBeLessThan(noArboristPoor);
    });

    it('should increase efficient weight when arborist is active', () => {
      const noArborist = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const withArborist = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const noArboristEfficient = findOutcome(noArborist, 'efficient').weight;
      const withArboristEfficient = findOutcome(withArborist, 'efficient').weight;

      expect(withArboristEfficient).toBeGreaterThan(noArboristEfficient);
    });

    it('should increase efficient weight with improved_harvesting upgrade', () => {
      const noUpgrade = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });

      const withUpgrade = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: { improved_harvesting: true },
        tuning: TUNING.harvest,
      });

      const noUpgradeEff = findOutcome(noUpgrade, 'efficient').weight;
      const withUpgradeEff = findOutcome(withUpgrade, 'efficient').weight;

      expect(withUpgradeEff).toBeGreaterThan(noUpgradeEff);
    });
  });
});