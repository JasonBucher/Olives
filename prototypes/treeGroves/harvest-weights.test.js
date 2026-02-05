import { describe, it, expect } from 'vitest';
import { computeHarvestOutcomeWeights, TUNING } from './test-utils.js';

describe('computeHarvestOutcomeWeights', () => {
  // Helper to sum weights
  const sumWeights = (outcomes) => outcomes.reduce((sum, o) => sum + o.weight, 0);
  
  // Helper to find outcome by key
  const findOutcome = (outcomes, key) => outcomes.find(o => o.key === key);

  describe('Conservation: weight sum remains ~1.0 when no clamping occurs', () => {
    it('should conserve weight sum with 0 harvesters, no upgrades', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 0,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });
      
      const sum = sumWeights(result);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should conserve weight sum with 5 harvesters, no upgrades, no arborist', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });
      
      const sum = sumWeights(result);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should conserve weight sum with 10 harvesters, arborist active, no upgrades', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });
      
      const sum = sumWeights(result);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should conserve weight sum with 5 harvesters, all safe upgrades', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: true,
        upgrades: {
          standardized_tools: true,
          training_program: true,
          selective_picking: true,
        },
        tuning: TUNING.harvest,
      });
      
      const sum = sumWeights(result);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should conserve weight sum with 8 harvesters, ladders_nets active', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 8,
        arboristIsActive: true,
        upgrades: {
          standardized_tools: true,
          training_program: true,
          selective_picking: true,
          ladders_nets: true,
        },
        tuning: TUNING.harvest,
      });
      
      const sum = sumWeights(result);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should conserve weight sum with quality_inspector and arborist', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 3,
        arboristIsActive: true,
        upgrades: {
          quality_inspector: true,
          selective_picking: true,
        },
        tuning: TUNING.harvest,
      });
      
      const sum = sumWeights(result);
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  describe('Interrupted stability: interrupted_short weight remains unchanged', () => {
    it('should keep interrupted_short at base weight with 0 harvesters', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 0,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });
      
      const interrupted = findOutcome(result, 'interrupted_short');
      expect(interrupted.weight).toBe(0.10);
    });

    it('should keep interrupted_short at base weight with 5 harvesters', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });
      
      const interrupted = findOutcome(result, 'interrupted_short');
      expect(interrupted.weight).toBe(0.10);
    });

    it('should keep interrupted_short at base weight with 10 harvesters and arborist', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });
      
      const interrupted = findOutcome(result, 'interrupted_short');
      expect(interrupted.weight).toBe(0.10);
    });

    it('should keep interrupted_short at base weight with all upgrades', () => {
      const result = computeHarvestOutcomeWeights({
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
      
      const interrupted = findOutcome(result, 'interrupted_short');
      expect(interrupted.weight).toBe(0.10);
    });
  });

  describe('Non-negative weights: all weights >= 0', () => {
    it('should have non-negative weights with 0 harvesters', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 0,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });
      
      result.forEach(outcome => {
        expect(outcome.weight).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have non-negative weights with 5 harvesters, no upgrades', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 5,
        arboristIsActive: false,
        upgrades: {},
        tuning: TUNING.harvest,
      });
      
      result.forEach(outcome => {
        expect(outcome.weight).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have non-negative weights with 10 harvesters, arborist active', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 10,
        arboristIsActive: true,
        upgrades: {},
        tuning: TUNING.harvest,
      });
      
      result.forEach(outcome => {
        expect(outcome.weight).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have non-negative weights with all upgrades', () => {
      const result = computeHarvestOutcomeWeights({
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
      
      result.forEach(outcome => {
        expect(outcome.weight).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have non-negative weights in extreme case: 20 harvesters, all upgrades', () => {
      const result = computeHarvestOutcomeWeights({
        outcomes: TUNING.harvest.outcomes,
        harvesterCount: 20,
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
      
      result.forEach(outcome => {
        expect(outcome.weight).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Specific weight adjustments', () => {
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

    it('should reduce poor weight with standardized_tools upgrade', () => {
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
        upgrades: { standardized_tools: true },
        tuning: TUNING.harvest,
      });
      
      const noUpgradePoor = findOutcome(noUpgrade, 'poor').weight;
      const withUpgradePoor = findOutcome(withUpgrade, 'poor').weight;
      
      expect(withUpgradePoor).toBeLessThan(noUpgradePoor);
    });
  });
});
