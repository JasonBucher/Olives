import { describe, it, expect } from 'vitest';
import { TUNING } from './test-utils.js';
import * as Calc from './static/js/gameCalc.js';

// ========================
// consumeInventory
// ========================
describe('consumeInventory', () => {
  it('subtracts integer amount from float inventory', () => {
    expect(Calc.consumeInventory(10.5, 3)).toBeCloseTo(7.5);
  });

  it('returns exactly zero when consuming all', () => {
    expect(Calc.consumeInventory(5, 5)).toBe(0);
  });

  it('guards against float epsilon (tiny negative becomes 0)', () => {
    // 0.3 - 0.1 - 0.1 - 0.1 can produce tiny negative in float math
    const val = 0.1 + 0.1 + 0.1; // ~0.30000000000000004
    const result = Calc.consumeInventory(val, 0);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 when over-consuming', () => {
    expect(Calc.consumeInventory(3, 10)).toBe(0);
  });

  it('handles zero inventory and zero amount', () => {
    expect(Calc.consumeInventory(0, 0)).toBe(0);
  });

  it('preserves fractional remainder', () => {
    expect(Calc.consumeInventory(10.75, 7)).toBeCloseTo(3.75);
  });
});

// ========================
// splitMarketSaleUnits
// ========================
describe('splitMarketSaleUnits', () => {
  it('returns zeros for zero units', () => {
    expect(Calc.splitMarketSaleUnits(0, 10, 5)).toEqual({ olives: 0, oil: 0 });
  });

  it('returns zeros for negative units', () => {
    expect(Calc.splitMarketSaleUnits(-5, 10, 5)).toEqual({ olives: 0, oil: 0 });
  });

  it('sells only olives when no oil available', () => {
    expect(Calc.splitMarketSaleUnits(5, 10, 0)).toEqual({ olives: 5, oil: 0 });
  });

  it('sells only oil when no olives available', () => {
    expect(Calc.splitMarketSaleUnits(5, 0, 10)).toEqual({ olives: 0, oil: 5 });
  });

  it('splits proportionally', () => {
    const result = Calc.splitMarketSaleUnits(10, 50, 50);
    expect(result.olives + result.oil).toBe(10);
    expect(result.olives).toBe(5);
    expect(result.oil).toBe(5);
  });

  it('handles uneven ratio (more olives)', () => {
    const result = Calc.splitMarketSaleUnits(10, 75, 25);
    expect(result.olives + result.oil).toBeLessThanOrEqual(10);
    expect(result.oil).toBeLessThanOrEqual(25);
    expect(result.olives).toBeLessThanOrEqual(75);
  });

  it('caps at available inventory', () => {
    const result = Calc.splitMarketSaleUnits(100, 3, 4);
    expect(result.olives).toBeLessThanOrEqual(3);
    expect(result.oil).toBeLessThanOrEqual(4);
  });

  it('handles large sale with small inventory', () => {
    const result = Calc.splitMarketSaleUnits(1000, 2, 3);
    expect(result.olives).toBe(2);
    expect(result.oil).toBe(3);
  });

  it('sells all when units equal total available', () => {
    const result = Calc.splitMarketSaleUnits(15, 10, 5);
    expect(result.olives).toBe(10);
    expect(result.oil).toBe(5);
  });
});

// ========================
// computeEstateIncomeRate
// ========================
describe('computeEstateIncomeRate', () => {
  const ei = TUNING.era2.estateIncome;

  it('returns 0 for null snapshot', () => {
    expect(Calc.computeEstateIncomeRate(null, TUNING)).toBe(0);
  });

  it('returns 0 for empty snapshot', () => {
    expect(Calc.computeEstateIncomeRate({}, TUNING)).toBe(0);
  });

  it('computes tree capacity component', () => {
    const rate = Calc.computeEstateIncomeRate({ treeCapacity: 40 }, TUNING);
    expect(rate).toBeCloseTo(40 * ei.treeCapacityMultiplier);
  });

  it('computes olive press component', () => {
    const rate = Calc.computeEstateIncomeRate({ olivePressCount: 3 }, TUNING);
    expect(rate).toBeCloseTo(3 * ei.olivePressMultiplier);
  });

  it('computes harvest basket component', () => {
    const rate = Calc.computeEstateIncomeRate({ harvestBasketLevel: 5 }, TUNING);
    expect(rate).toBeCloseTo(5 * ei.harvestBasketMultiplier);
  });

  it('computes harvest upgrade component', () => {
    const rate = Calc.computeEstateIncomeRate({ harvestUpgrades: ['a', 'b'] }, TUNING);
    expect(rate).toBeCloseTo(2 * ei.harvestUpgradeMultiplier);
  });

  it('combines all components', () => {
    const snapshot = {
      treeCapacity: 40,
      olivePressCount: 3,
      harvestBasketLevel: 5,
      harvestUpgrades: ['improved_harvesting'],
    };
    const expected =
      40 * ei.treeCapacityMultiplier +
      3 * ei.olivePressMultiplier +
      5 * ei.harvestBasketMultiplier +
      1 * ei.harvestUpgradeMultiplier;
    expect(Calc.computeEstateIncomeRate(snapshot, TUNING)).toBeCloseTo(expected);
  });

  it('never returns negative', () => {
    expect(Calc.computeEstateIncomeRate({ treeCapacity: 0 }, TUNING)).toBeGreaterThanOrEqual(0);
  });
});

// ========================
// getRenownTierState
// ========================
describe('getRenownTierState', () => {
  const tiers = TUNING.renownTiers;

  it('returns Unranked for empty config', () => {
    const result = Calc.getRenownTierState(0, false, []);
    expect(result.tierId).toBeNull();
    expect(result.tierName).toBe("Unranked");
  });

  it('neighborhood at renown 0', () => {
    const result = Calc.getRenownTierState(0, false, tiers);
    expect(result.tierId).toBe("neighborhood");
    expect(result.demandBonus).toBe(0);
  });

  it('neighborhood at renown 25', () => {
    const result = Calc.getRenownTierState(25, false, tiers);
    expect(result.tierId).toBe("neighborhood");
  });

  it('49.9 floors to 49 → still neighborhood', () => {
    const result = Calc.getRenownTierState(49.9, false, tiers);
    expect(result.tierId).toBe("neighborhood");
  });

  it('artisans at renown 50', () => {
    const result = Calc.getRenownTierState(50, false, tiers);
    expect(result.tierId).toBe("artisans");
    expect(result.demandBonus).toBe(0.10);
  });

  it('artisans at renown 100', () => {
    const result = Calc.getRenownTierState(100, false, tiers);
    expect(result.tierId).toBe("artisans");
  });

  it('nobles at renown 150', () => {
    const result = Calc.getRenownTierState(150, false, tiers);
    expect(result.tierId).toBe("nobles");
    expect(result.demandBonus).toBe(0.25);
  });

  it('nobles at renown 250', () => {
    const result = Calc.getRenownTierState(250, false, tiers);
    expect(result.tierId).toBe("nobles");
  });

  it('countryside limit at max renown', () => {
    const result = Calc.getRenownTierState(300, false, tiers);
    expect(result.tierName).toBe("Countryside Limit");
    expect(result.progressPct).toBe(100);
    expect(result.progressText).toBe("MAX");
  });

  it('countryside limit when renownCapped is true', () => {
    const result = Calc.getRenownTierState(200, true, tiers);
    expect(result.tierName).toBe("Countryside Limit");
    expect(result.progressText).toBe("MAX");
  });

  it('progress percentage mid-tier (neighborhood)', () => {
    // neighborhood: 0-49, at renown 25 → 25/49 ≈ 51%
    const result = Calc.getRenownTierState(25, false, tiers);
    expect(result.progressPct).toBeCloseTo((25 / 49) * 100, 0);
  });

  it('progress percentage mid-tier (artisans)', () => {
    // artisans: 50-149, at renown 100 → (100-50)/(149-50) = 50/99
    const result = Calc.getRenownTierState(100, false, tiers);
    expect(result.progressPct).toBeCloseTo((50 / 99) * 100, 0);
  });

  it('demandBonus matches config for each tier', () => {
    for (const tier of tiers) {
      const result = Calc.getRenownTierState(tier.minRenown, false, tiers);
      expect(result.demandBonus).toBe(tier.demandBonus);
    }
  });

  it('handles non-finite renown gracefully', () => {
    const result = Calc.getRenownTierState(NaN, false, tiers);
    expect(result.renownValue).toBe(0);
    expect(result.tierId).toBe("neighborhood");
  });
});

// ========================
// getMarketPermanentPriceMultiplier
// ========================
describe('getMarketPermanentPriceMultiplier', () => {
  const base = TUNING.market.price.baseMultiplier;
  const upgrade = TUNING.market.price.upgradeMultiplier;

  it('returns base with 0 upgrades', () => {
    expect(Calc.getMarketPermanentPriceMultiplier(0, TUNING)).toBeCloseTo(base);
  });

  it('adds upgrade multiplier per upgrade', () => {
    expect(Calc.getMarketPermanentPriceMultiplier(1, TUNING)).toBeCloseTo(base + upgrade);
    expect(Calc.getMarketPermanentPriceMultiplier(2, TUNING)).toBeCloseTo(base + 2 * upgrade);
    expect(Calc.getMarketPermanentPriceMultiplier(3, TUNING)).toBeCloseTo(base + 3 * upgrade);
  });
});

// ========================
// getMarketEffectivePriceMultiplier
// ========================
describe('getMarketEffectivePriceMultiplier', () => {
  it('equals permanent multiplier without event', () => {
    const perm = Calc.getMarketPermanentPriceMultiplier(1, TUNING);
    expect(Calc.getMarketEffectivePriceMultiplier(1, TUNING)).toBeCloseTo(perm);
  });

  it('multiplies by event multiplier', () => {
    const perm = Calc.getMarketPermanentPriceMultiplier(0, TUNING);
    expect(Calc.getMarketEffectivePriceMultiplier(0, TUNING, 1.5)).toBeCloseTo(perm * 1.5);
  });

  it('handles null event multiplier as 1', () => {
    const perm = Calc.getMarketPermanentPriceMultiplier(2, TUNING);
    expect(Calc.getMarketEffectivePriceMultiplier(2, TUNING, null)).toBeCloseTo(perm);
  });
});

// ========================
// computeManagerTickDecision
// ========================
describe('computeManagerTickDecision', () => {
  it('not hired → inactive, no cost', () => {
    const result = Calc.computeManagerTickDecision(false, 0.2, 100, 0.2);
    expect(result.active).toBe(false);
    expect(result.cost).toBe(0);
  });

  it('hired and can afford → active with cost', () => {
    const dt = 0.2; // 200ms tick
    const salaryPerMin = 0.2;
    const expectedCost = (salaryPerMin / 60) * dt;
    const result = Calc.computeManagerTickDecision(true, salaryPerMin, 100, dt);
    expect(result.active).toBe(true);
    expect(result.cost).toBeCloseTo(expectedCost);
  });

  it('hired but broke → inactive, no cost', () => {
    const result = Calc.computeManagerTickDecision(true, 0.2, 0, 0.2);
    expect(result.active).toBe(false);
    expect(result.cost).toBe(0);
  });

  it('hired with exact cost → active', () => {
    const dt = 1;
    const salaryPerMin = 6; // 0.1/sec
    const exactCost = (salaryPerMin / 60) * dt; // 0.1
    const result = Calc.computeManagerTickDecision(true, salaryPerMin, exactCost, dt);
    expect(result.active).toBe(true);
    expect(result.cost).toBeCloseTo(exactCost);
  });

  it('hired with barely not enough → inactive', () => {
    const dt = 1;
    const salaryPerMin = 6;
    const almostEnough = (salaryPerMin / 60) * dt - 0.001;
    const result = Calc.computeManagerTickDecision(true, salaryPerMin, almostEnough, dt);
    expect(result.active).toBe(false);
  });

  it('cost scales with dt', () => {
    const r1 = Calc.computeManagerTickDecision(true, 0.6, 100, 0.2);
    const r2 = Calc.computeManagerTickDecision(true, 0.6, 100, 1.0);
    expect(r2.cost).toBeCloseTo(r1.cost * 5);
  });

  it('each manager type has correct salary from tuning', () => {
    const managerKeys = ['arborist', 'foreman', 'pressManager', 'quarryManager'];
    for (const key of managerKeys) {
      const salary = TUNING.managers[key].salaryPerMin;
      const result = Calc.computeManagerTickDecision(true, salary, 1000, 0.2);
      expect(result.active).toBe(true);
      expect(result.cost).toBeCloseTo((salary / 60) * 0.2);
    }
  });
});
