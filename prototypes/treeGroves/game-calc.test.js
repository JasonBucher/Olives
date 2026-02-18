import { describe, it, expect } from 'vitest';
import { TUNING } from './test-utils.js';
import * as Calc from './static/js/gameCalc.js';

describe('gameCalc pure helpers', () => {
  // --- Cultivator ---
  describe('getCultivatorHireCost', () => {
    it('scales linearly below threshold', () => {
      expect(Calc.getCultivatorHireCost(0, TUNING)).toBe(8);
      expect(Calc.getCultivatorHireCost(5, TUNING)).toBe(8 + 5 * 3);
      expect(Calc.getCultivatorHireCost(29, TUNING)).toBe(8 + 29 * 3);
    });

    it('switches to high scale at threshold', () => {
      const costAtThreshold = 8 + 30 * 3;
      expect(Calc.getCultivatorHireCost(30, TUNING)).toBe(costAtThreshold);
      expect(Calc.getCultivatorHireCost(31, TUNING)).toBe(costAtThreshold + 1 * 8);
      expect(Calc.getCultivatorHireCost(35, TUNING)).toBe(costAtThreshold + 5 * 8);
    });
  });

  describe('getCultivatorBonusPerSecond', () => {
    it('returns 0 with no cultivators', () => {
      expect(Calc.getCultivatorBonusPerSecond(0, TUNING, false)).toBe(0);
    });

    it('scales linearly without foreman', () => {
      expect(Calc.getCultivatorBonusPerSecond(5, TUNING, false)).toBeCloseTo(0.5);
    });

    it('applies foreman multiplier when active', () => {
      const base = 5 * 0.10;
      expect(Calc.getCultivatorBonusPerSecond(5, TUNING, true)).toBeCloseTo(base * 1.25);
    });
  });

  // --- Grove ---
  describe('getGroveExpansionBonus', () => {
    it('returns 0 with no upgrades', () => {
      expect(Calc.getGroveExpansionBonus({}, TUNING)).toBe(0);
    });

    it('sums purchased expansion bonuses', () => {
      const upgrades = { expand_grove_1: true, expand_grove_2: true };
      expect(Calc.getGroveExpansionBonus(upgrades, TUNING)).toBe(20 + 25);
    });

    it('sums all three expansions', () => {
      const upgrades = { expand_grove_1: true, expand_grove_2: true, expand_grove_3: true };
      expect(Calc.getGroveExpansionBonus(upgrades, TUNING)).toBe(20 + 25 + 35);
    });
  });

  // --- Harvester ---
  describe('getHarvesterHireCost', () => {
    it('scales linearly', () => {
      expect(Calc.getHarvesterHireCost(0, TUNING)).toBe(10);
      expect(Calc.getHarvesterHireCost(5, TUNING)).toBe(10 + 5 * 5);
      expect(Calc.getHarvesterHireCost(10, TUNING)).toBe(10 + 10 * 5);
    });
  });

  describe('calculateHarvesterHirePreview', () => {
    it('returns 0 current olives at 0 harvesters', () => {
      const preview = Calc.calculateHarvesterHirePreview(0, TUNING);
      expect(preview.olives.current).toBe(0);
      expect(preview.olives.next).toBeCloseTo(0.8);
    });

    it('scales at 5 harvesters', () => {
      const preview = Calc.calculateHarvesterHirePreview(5, TUNING);
      expect(preview.olives.current).toBeCloseTo(5 * 0.8);
      expect(preview.olives.next).toBeCloseTo(6 * 0.8);
    });

    it('scales at 10 harvesters', () => {
      const preview = Calc.calculateHarvesterHirePreview(10, TUNING);
      expect(preview.olives.current).toBeCloseTo(10 * 0.8);
      expect(preview.olives.next).toBeCloseTo(11 * 0.8);
    });
  });

  // --- Presser ---
  describe('getPresserHireCost', () => {
    it('scales linearly', () => {
      expect(Calc.getPresserHireCost(0, TUNING)).toBe(12);
      expect(Calc.getPresserHireCost(3, TUNING)).toBe(12 + 3 * 6);
    });
  });

  describe('getTotalOilPerOlive', () => {
    it('returns base with 0 pressers', () => {
      const base = TUNING.press.baseOilPerPress / TUNING.press.olivesPerPress;
      expect(Calc.getTotalOilPerOlive(0, TUNING, false)).toBeCloseTo(base);
    });

    it('adds presser bonus without manager', () => {
      const base = 1 / 3;
      const bonus = 3 * 0.02;
      expect(Calc.getTotalOilPerOlive(3, TUNING, false)).toBeCloseTo(base + bonus);
    });

    it('applies press manager multiplier to bonus', () => {
      const base = 1 / 3;
      const bonus = 3 * 0.02 * 1.5;
      expect(Calc.getTotalOilPerOlive(3, TUNING, true)).toBeCloseTo(base + bonus);
    });
  });

  // --- Olive Press Scaling (multiples-of-3 breakpoint) ---
  describe('getOlivesToPress', () => {
    it('returns 0 when not enough olives', () => {
      expect(Calc.getOlivesToPress(2, 1, TUNING)).toBe(0);
    });

    it('presses one batch with exactly 3 olives', () => {
      expect(Calc.getOlivesToPress(3, 1, TUNING)).toBe(3);
    });

    it('caps at press count with 1 press', () => {
      // 8 olives, 1 press: floor(8/3)=2 multiples, min(2,1)=1 → 3
      expect(Calc.getOlivesToPress(8, 1, TUNING)).toBe(3);
    });

    it('uses multiple presses when available', () => {
      // 8 olives, 2 presses: floor(8/3)=2 multiples, min(2,2)=2 → 6
      expect(Calc.getOlivesToPress(8, 2, TUNING)).toBe(6);
    });

    it('caps at press count with many olives', () => {
      expect(Calc.getOlivesToPress(100, 2, TUNING)).toBe(6);
    });

    it('handles fractional olives by flooring', () => {
      // 5.9 → floor=5, 5/3=1 multiple, min(1,1)=1 → 3
      expect(Calc.getOlivesToPress(5.9, 1, TUNING)).toBe(3);
      // 6.1 → floor=6, 6/3=2 multiples, min(2,2)=2 → 6
      expect(Calc.getOlivesToPress(6.1, 2, TUNING)).toBe(6);
    });
  });

  // --- Shipping ---
  describe('getOliveShippingCapacity', () => {
    it('returns base with no crates', () => {
      expect(Calc.getOliveShippingCapacity(0, TUNING)).toBe(10);
    });

    it('adds bonus per level', () => {
      expect(Calc.getOliveShippingCapacity(2, TUNING)).toBe(10 + 2 * 5);
    });
  });

  describe('getOliveOilShippingCapacity', () => {
    it('returns base with no crates', () => {
      expect(Calc.getOliveOilShippingCapacity(0, TUNING)).toBe(5);
    });

    it('adds bonus per level', () => {
      expect(Calc.getOliveOilShippingCapacity(3, TUNING)).toBe(5 + 3 * 4);
    });
  });

  // --- Quarry ---
  describe('getQuarryOutput', () => {
    it('returns base with no picks', () => {
      expect(Calc.getQuarryOutput(0, TUNING)).toBe(4);
    });

    it('adds bonus per level', () => {
      expect(Calc.getQuarryOutput(2, TUNING)).toBe(4 + 2 * 2);
    });
  });

  describe('getQuarryDurationSeconds', () => {
    it('returns base with no cart', () => {
      expect(Calc.getQuarryDurationSeconds(0, TUNING)).toBe(20);
    });

    it('reduces by 20% per level', () => {
      expect(Calc.getQuarryDurationSeconds(1, TUNING)).toBeCloseTo(16);
      expect(Calc.getQuarryDurationSeconds(2, TUNING)).toBeCloseTo(12);
    });
  });

  // --- Harvest batch size ---
  describe('getCurrentHarvestBatchSize', () => {
    it('returns base with no upgrades or harvesters', () => {
      expect(Calc.getCurrentHarvestBatchSize(0, 0, 10, TUNING)).toBe(10);
    });

    it('adds basket bonus', () => {
      expect(Calc.getCurrentHarvestBatchSize(0, 2, 10, TUNING)).toBe(10 + 2 * 2);
    });

    it('adds harvester olive bonus', () => {
      expect(Calc.getCurrentHarvestBatchSize(5, 0, 10, TUNING)).toBeCloseTo(10 + 5 * 0.8);
    });

    it('combines basket and harvester bonuses', () => {
      expect(Calc.getCurrentHarvestBatchSize(5, 2, 10, TUNING)).toBeCloseTo(10 + 4 + 4);
    });
  });

  // --- Stability label ---
  describe('getHarvestStabilityLabel', () => {
    it('returns Certain at 0%', () => {
      expect(Calc.getHarvestStabilityLabel(0)).toBe("Certain");
    });

    it('returns Engineered at 5%', () => {
      expect(Calc.getHarvestStabilityLabel(5)).toBe("Engineered");
    });

    it('returns Reliable at 14%', () => {
      expect(Calc.getHarvestStabilityLabel(14)).toBe("Reliable");
    });

    it('returns Unstable at 15%+', () => {
      expect(Calc.getHarvestStabilityLabel(15)).toBe("Unstable");
    });
  });

  // --- Format helpers ---
  describe('formatOlivesPerSecond', () => {
    it('trims trailing zeros', () => {
      expect(Calc.formatOlivesPerSecond(1.50)).toBe("1.5");
      expect(Calc.formatOlivesPerSecond(2.00)).toBe("2");
    });

    it('shows 3 decimal places for values < 1', () => {
      expect(Calc.formatOlivesPerSecond(0.1)).toBe("0.1");
      expect(Calc.formatOlivesPerSecond(0.125)).toBe("0.125");
    });
  });

  describe('getDisplayCount / getShippableCount', () => {
    it('floors fractional values', () => {
      expect(Calc.getDisplayCount(5.9)).toBe(5);
      expect(Calc.getShippableCount(3.1)).toBe(3);
    });
  });
});

describe('gameCalc compound functions', () => {
  const baseState = {
    treeOlives: 15.7,
    cultivatorCount: 3,
    harvesterCount: 5,
    presserCount: 2,
    florinCount: 100,
    harvestedOlives: 12.5,
    oliveOilCount: 8.3,
    marketOlives: 5,
    marketOliveOil: 3,
    stone: 10,
    olivePressCount: 2,
    shippingCrateLevel: 1,
    quarryPickLevel: 1,
    quarryCartLevel: 1,
    harvestBasketLevel: 1,
    upgrades: { expand_grove_1: true },
    arboristHired: true,
    foremanHired: true,
    quarryManagerHired: false,
    pressManagerHired: true,
  };

  describe('calcGroveStats', () => {
    it('computes tree capacity with expansion', () => {
      const stats = Calc.calcGroveStats(baseState, TUNING, true);
      expect(stats.treeCapacity).toBe(20 + 20);
      expect(stats.treeOlives).toBe(15);
    });

    it('includes cultivator bonus in growth rate', () => {
      const stats = Calc.calcGroveStats(baseState, TUNING, true);
      const expectedRate = 0.75 + 3 * 0.10 * 1.25;
      expect(stats.growthRate).toBeCloseTo(expectedRate);
    });
  });

  describe('calcCultivatorStats', () => {
    it('computes cost and bonuses', () => {
      const stats = Calc.calcCultivatorStats(baseState, TUNING, true);
      expect(stats.count).toBe(3);
      expect(stats.hireCost).toBe(8 + 3 * 3);
      expect(stats.currentBonus).toBeCloseTo(3 * 0.10 * 1.25);
      expect(stats.nextBonus).toBeCloseTo(0.10 * 1.25);
    });
  });

  describe('calcPresserStats', () => {
    it('computes oil bonus with manager', () => {
      const stats = Calc.calcPresserStats(baseState, TUNING, true);
      expect(stats.count).toBe(2);
      const maxOlives = 2 * 3;
      expect(stats.currentOilBonus).toBeCloseTo(maxOlives * 2 * 0.02 * 1.5);
      expect(stats.nextOilBonus).toBeCloseTo(maxOlives * 0.02 * 1.5);
    });

    it('computes oil bonus without manager', () => {
      const stats = Calc.calcPresserStats(baseState, TUNING, false);
      const maxOlives = 2 * 3;
      expect(stats.currentOilBonus).toBeCloseTo(maxOlives * 2 * 0.02 * 1);
      expect(stats.nextOilBonus).toBeCloseTo(maxOlives * 0.02 * 1);
    });
  });

  describe('calcPressAction', () => {
    it('computes olives to press, oil per olive, and output', () => {
      const action = Calc.calcPressAction(baseState, TUNING, true);
      // 12.5 → floor = 12, ÷3 = 4 multiples, min(4, 2 presses) = 2 → 6 olives
      expect(action.olivesToPress).toBe(6);
      expect(action.oilPerOlive).toBeCloseTo(1/3 + 2 * 0.02 * 1.5);
      expect(action.oilOutput).toBeCloseTo(6 * action.oilPerOlive);
    });
  });

  describe('calcShippingStats', () => {
    it('computes shippable and max ship amounts', () => {
      const stats = Calc.calcShippingStats(baseState, TUNING);
      expect(stats.olives.shippable).toBe(12);
      expect(stats.olives.maxShip).toBe(Math.min(12, 10 + 5));
      expect(stats.oil.shippable).toBe(8);
      expect(stats.oil.maxShip).toBe(Math.min(8, 5 + 4));
    });
  });

  describe('calcManagersSummary', () => {
    it('reports hired and active managers', () => {
      const flags = { arborist: true, foreman: true, quarryManager: false, pressManager: false };
      const summary = Calc.calcManagersSummary(baseState, TUNING, flags);
      expect(summary.anyHired).toBe(true);
      expect(summary.managers.find(m => m.id === "arborist").hired).toBe(true);
      expect(summary.managers.find(m => m.id === "arborist").active).toBe(true);
      expect(summary.managers.find(m => m.id === "quarryManager").hired).toBe(false);
      expect(summary.totalActiveCost).toBeCloseTo(0.2 + 0.2);
    });

    it('returns 0 cost when none active', () => {
      const noMgrState = { ...baseState, arboristHired: false, foremanHired: false, quarryManagerHired: false, pressManagerHired: false };
      const flags = { arborist: false, foreman: false, quarryManager: false, pressManager: false };
      const summary = Calc.calcManagersSummary(noMgrState, TUNING, flags);
      expect(summary.anyHired).toBe(false);
      expect(summary.totalActiveCost).toBe(0);
    });
  });

  describe('calcQuarryStats', () => {
    it('computes output and duration with upgrades', () => {
      const stats = Calc.calcQuarryStats(baseState, TUNING);
      expect(stats.output).toBe(4 + 2);
      expect(stats.durationSeconds).toBeCloseTo(16);
    });
  });
});
