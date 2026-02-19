import { describe, it, expect } from 'vitest';
import { TUNING } from './test-utils.js';
import { INVESTMENTS } from './static/js/investments.js';

/** Look up an investment by id */
function inv(id) {
  return INVESTMENTS.find(i => i.id === id);
}

/** Create a minimal default state for testing */
function makeState(overrides = {}) {
  return {
    florinCount: 0,
    stone: 0,
    arboristHired: false,
    foremanHired: false,
    pressManagerHired: false,
    quarryManagerHired: false,
    autoShipOilUnlocked: false,
    upgrades: {},
    shippingCrateLevel: 0,
    quarryPickLevel: 0,
    quarryCartLevel: 0,
    harvestBasketLevel: 0,
    olivePressCount: 1,
    marketAutosellRateUpgrades: 0,
    marketLanesPurchased: 0,
    marketPriceUpgrades: 0,
    ...overrides,
  };
}

// ========================
// Manager Purchases
// ========================
describe('Manager investments', () => {
  const managers = [
    { id: 'arborist', hiredKey: 'arboristHired', tuningPath: 'arborist' },
    { id: 'foreman', hiredKey: 'foremanHired', tuningPath: 'foreman' },
    { id: 'pressManager', hiredKey: 'pressManagerHired', tuningPath: 'pressManager' },
    { id: 'quarryManager', hiredKey: 'quarryManagerHired', tuningPath: 'quarryManager' },
  ];

  for (const mgr of managers) {
    describe(mgr.id, () => {
      const hireCost = TUNING.managers[mgr.tuningPath].hireCost;

      it('canPurchase is false without enough florins', () => {
        const state = makeState({ florinCount: hireCost - 1 });
        expect(inv(mgr.id).canPurchase(state, TUNING)).toBe(false);
      });

      it('canPurchase is true with exact florins', () => {
        const state = makeState({ florinCount: hireCost });
        expect(inv(mgr.id).canPurchase(state, TUNING)).toBe(true);
      });

      it('purchase deducts florins and sets hired flag', () => {
        const state = makeState({ florinCount: hireCost + 10 });
        const result = inv(mgr.id).purchase(state, TUNING);
        expect(result).toBe(true);
        expect(state[mgr.hiredKey]).toBe(true);
        expect(state.florinCount).toBe(10);
      });

      it('cannot double-buy', () => {
        const state = makeState({ florinCount: hireCost * 2, [mgr.hiredKey]: true });
        expect(inv(mgr.id).canPurchase(state, TUNING)).toBe(false);
        expect(inv(mgr.id).purchase(state, TUNING)).toBe(false);
        expect(state.florinCount).toBe(hireCost * 2); // unchanged
      });

      it('isOwned reflects hired state', () => {
        expect(inv(mgr.id).isOwned(makeState(), TUNING)).toBe(false);
        expect(inv(mgr.id).isOwned(makeState({ [mgr.hiredKey]: true }), TUNING)).toBe(true);
      });
    });
  }
});

// ========================
// One-shot Upgrades
// ========================
describe('One-shot upgrades', () => {
  describe('improved_harvesting', () => {
    const cost = TUNING.investments.costs.improved_harvesting;

    it('canPurchase with enough florins', () => {
      const state = makeState({ florinCount: cost });
      expect(inv('improved_harvesting').canPurchase(state, TUNING)).toBe(true);
    });

    it('canPurchase false without florins', () => {
      const state = makeState({ florinCount: cost - 1 });
      expect(inv('improved_harvesting').canPurchase(state, TUNING)).toBe(false);
    });

    it('purchase deducts florins and sets upgrade flag', () => {
      const state = makeState({ florinCount: cost + 5 });
      const result = inv('improved_harvesting').purchase(state, TUNING);
      expect(result).toBe(true);
      expect(state.upgrades.improved_harvesting).toBe(true);
      expect(state.florinCount).toBe(5);
    });

    it('cannot re-purchase', () => {
      const state = makeState({ florinCount: cost, upgrades: { improved_harvesting: true } });
      expect(inv('improved_harvesting').canPurchase(state, TUNING)).toBe(false);
    });
  });
});

// ========================
// Prerequisite Gating
// ========================
describe('Prerequisite gating', () => {
  describe('expand_grove_2 requires expand_grove_1', () => {
    const tier = TUNING.investments.groveExpansion[1];

    it('canPurchase falsy without prerequisite', () => {
      const state = makeState({ florinCount: tier.florinCost, stone: tier.stoneCost });
      expect(inv('expand_grove_2').canPurchase(state, TUNING)).toBeFalsy();
    });

    it('canPurchase true with prerequisite', () => {
      const state = makeState({
        florinCount: tier.florinCost,
        stone: tier.stoneCost,
        upgrades: { expand_grove_1: true },
      });
      expect(inv('expand_grove_2').canPurchase(state, TUNING)).toBe(true);
    });
  });

  describe('expand_grove_3 requires expand_grove_2', () => {
    const tier = TUNING.investments.groveExpansion[2];

    it('canPurchase falsy without prerequisite', () => {
      const state = makeState({
        florinCount: tier.florinCost,
        stone: tier.stoneCost,
        upgrades: { expand_grove_1: true },
      });
      expect(inv('expand_grove_3').canPurchase(state, TUNING)).toBeFalsy();
    });

    it('canPurchase true with prerequisite', () => {
      const state = makeState({
        florinCount: tier.florinCost,
        stone: tier.stoneCost,
        upgrades: { expand_grove_1: true, expand_grove_2: true },
      });
      expect(inv('expand_grove_3').canPurchase(state, TUNING)).toBe(true);
    });
  });

  describe('auto_ship_oil requires pressManager', () => {
    const cost = TUNING.investments.autoShipOil.cost;

    it('canPurchase false without pressManager', () => {
      const state = makeState({ florinCount: cost.florins, stone: cost.stone });
      expect(inv('auto_ship_oil').canPurchase(state, TUNING)).toBe(false);
    });

    it('canPurchase true with pressManager', () => {
      const state = makeState({
        florinCount: cost.florins,
        stone: cost.stone,
        pressManagerHired: true,
      });
      expect(inv('auto_ship_oil').canPurchase(state, TUNING)).toBe(true);
    });
  });
});

// ========================
// Grove Expansion (multi-resource)
// ========================
describe('Grove expansion (florins + stone)', () => {
  for (let i = 0; i < 3; i++) {
    const id = `expand_grove_${i + 1}`;
    const tier = TUNING.investments.groveExpansion[i];
    const prereqs = {};
    for (let j = 0; j < i; j++) prereqs[`expand_grove_${j + 1}`] = true;

    describe(id, () => {
      it('deducts both florins and stone on purchase', () => {
        const state = makeState({
          florinCount: tier.florinCost + 10,
          stone: tier.stoneCost + 5,
          upgrades: { ...prereqs },
        });
        const result = inv(id).purchase(state, TUNING);
        expect(result).toBe(true);
        expect(state.florinCount).toBe(10);
        expect(state.stone).toBe(5);
        expect(state.upgrades[id]).toBe(true);
      });

      it('fails if florins sufficient but stone insufficient', () => {
        const state = makeState({
          florinCount: tier.florinCost,
          stone: tier.stoneCost - 1,
          upgrades: { ...prereqs },
        });
        expect(inv(id).canPurchase(state, TUNING)).toBe(false);
      });

      it('state unchanged on failed purchase', () => {
        const state = makeState({
          florinCount: 0,
          stone: 0,
          upgrades: { ...prereqs },
        });
        const startFlorins = state.florinCount;
        const startStone = state.stone;
        inv(id).purchase(state, TUNING);
        expect(state.florinCount).toBe(startFlorins);
        expect(state.stone).toBe(startStone);
      });
    });
  }
});

// ========================
// Repeatable / Leveled Investments
// ========================
describe('Repeatable investments', () => {
  describe('shipping_crates', () => {
    const cfg = TUNING.investments.shippingCrates;

    it('level increments on purchase', () => {
      const state = makeState({ florinCount: 1000, stone: 100 });
      inv('shipping_crates').purchase(state, TUNING);
      expect(state.shippingCrateLevel).toBe(1);
      inv('shipping_crates').purchase(state, TUNING);
      expect(state.shippingCrateLevel).toBe(2);
    });

    it('cost scales with level', () => {
      const cost0 = cfg.baseCost.florins;
      const cost1 = cfg.baseCost.florins + 1 * cfg.costScale.florins;
      expect(inv('shipping_crates').cost(TUNING, makeState({ shippingCrateLevel: 0 }))).toBe(cost0);
      expect(inv('shipping_crates').cost(TUNING, makeState({ shippingCrateLevel: 1 }))).toBe(cost1);
    });

    it('maxLevel blocks further purchase', () => {
      const state = makeState({ florinCount: 10000, stone: 1000, shippingCrateLevel: cfg.maxLevel });
      expect(inv('shipping_crates').canPurchase(state, TUNING)).toBe(false);
    });

    it('isOwned true at maxLevel', () => {
      expect(inv('shipping_crates').isOwned(makeState({ shippingCrateLevel: cfg.maxLevel }), TUNING)).toBe(true);
      expect(inv('shipping_crates').isOwned(makeState({ shippingCrateLevel: 0 }), TUNING)).toBe(false);
    });
  });

  describe('sharpened_picks', () => {
    const cfg = TUNING.investments.sharpenedPicks;

    it('level increments on purchase', () => {
      const state = makeState({ florinCount: 1000, stone: 100 });
      inv('sharpened_picks').purchase(state, TUNING);
      expect(state.quarryPickLevel).toBe(1);
    });

    it('cost scales with level', () => {
      const cost0 = cfg.baseCost.florins;
      const cost1 = cfg.baseCost.florins + 1 * cfg.costScale.florins;
      expect(inv('sharpened_picks').cost(TUNING, makeState({ quarryPickLevel: 0 }))).toBe(cost0);
      expect(inv('sharpened_picks').cost(TUNING, makeState({ quarryPickLevel: 1 }))).toBe(cost1);
    });

    it('maxLevel blocks further purchase', () => {
      const state = makeState({ florinCount: 10000, stone: 1000, quarryPickLevel: cfg.maxLevel });
      expect(inv('sharpened_picks').canPurchase(state, TUNING)).toBe(false);
    });
  });

  describe('pulley_cart', () => {
    const cfg = TUNING.investments.pulleyCart;

    it('level increments on purchase', () => {
      const state = makeState({ florinCount: 1000, stone: 100 });
      inv('pulley_cart').purchase(state, TUNING);
      expect(state.quarryCartLevel).toBe(1);
    });

    it('maxLevel blocks further purchase', () => {
      const state = makeState({ florinCount: 10000, stone: 1000, quarryCartLevel: cfg.maxLevel });
      expect(inv('pulley_cart').canPurchase(state, TUNING)).toBe(false);
    });
  });

  describe('harvest_baskets', () => {
    const cfg = TUNING.investments.harvestBaskets;

    it('level increments on purchase', () => {
      const state = makeState({ florinCount: 1000, stone: 100 });
      inv('harvest_baskets').purchase(state, TUNING);
      expect(state.harvestBasketLevel).toBe(1);
    });

    it('cost scales with level', () => {
      const cost0 = cfg.baseCost.florins;
      const cost2 = cfg.baseCost.florins + 2 * cfg.costScale.florins;
      expect(inv('harvest_baskets').cost(TUNING, makeState({ harvestBasketLevel: 0 }))).toBe(cost0);
      expect(inv('harvest_baskets').cost(TUNING, makeState({ harvestBasketLevel: 2 }))).toBe(cost2);
    });

    it('maxLevel blocks further purchase', () => {
      const state = makeState({ florinCount: 10000, stone: 1000, harvestBasketLevel: cfg.maxLevel });
      expect(inv('harvest_baskets').canPurchase(state, TUNING)).toBe(false);
    });

    it('isOwned true at maxLevel', () => {
      expect(inv('harvest_baskets').isOwned(makeState({ harvestBasketLevel: cfg.maxLevel }), TUNING)).toBe(true);
    });
  });

  describe('build_olive_press', () => {
    const cfg = TUNING.investments.olivePressExpansion;

    it('level increments from base press count', () => {
      const state = makeState({ florinCount: 1000, stone: 100, olivePressCount: 1 });
      inv('build_olive_press').purchase(state, TUNING);
      expect(state.olivePressCount).toBe(2);
    });

    it('cost scales with additional presses', () => {
      const cost0 = cfg.baseCost.florins; // 0 additional
      const cost1 = cfg.baseCost.florins + 1 * cfg.costScale.florins; // 1 additional
      expect(inv('build_olive_press').cost(TUNING, makeState({ olivePressCount: 1 }))).toBe(cost0);
      expect(inv('build_olive_press').cost(TUNING, makeState({ olivePressCount: 2 }))).toBe(cost1);
    });

    it('maxLevel blocks further purchase', () => {
      const maxCount = 1 + cfg.maxAdditionalPresses;
      const state = makeState({ florinCount: 10000, stone: 1000, olivePressCount: maxCount });
      expect(inv('build_olive_press').canPurchase(state, TUNING)).toBe(false);
    });

    it('isOwned true at max additional presses', () => {
      const maxCount = 1 + cfg.maxAdditionalPresses;
      expect(inv('build_olive_press').isOwned(makeState({ olivePressCount: maxCount }), TUNING)).toBe(true);
    });
  });

  describe('market_autosell_rate', () => {
    const maxUpgrades = TUNING.market.autosell.maxRateUpgrades;

    it('increments rate upgrade count', () => {
      const state = makeState({ florinCount: 1000, stone: 100 });
      inv('market_autosell_rate').purchase(state, TUNING);
      expect(state.marketAutosellRateUpgrades).toBe(1);
    });

    it('maxLevel blocks further purchase', () => {
      const state = makeState({ florinCount: 10000, stone: 1000, marketAutosellRateUpgrades: maxUpgrades });
      expect(inv('market_autosell_rate').canPurchase(state, TUNING)).toBe(false);
    });

    it('isOwned true at max upgrades', () => {
      expect(inv('market_autosell_rate').isOwned(makeState({ marketAutosellRateUpgrades: maxUpgrades }), TUNING)).toBe(true);
    });
  });

  describe('market_autosell_lane', () => {
    const maxLanes = TUNING.market.lanes.maxAdditionalLanes;

    it('increments lane count', () => {
      const state = makeState({ florinCount: 1000, stone: 100 });
      inv('market_autosell_lane').purchase(state, TUNING);
      expect(state.marketLanesPurchased).toBe(1);
    });

    it('maxLevel blocks further purchase', () => {
      const state = makeState({ florinCount: 10000, stone: 1000, marketLanesPurchased: maxLanes });
      expect(inv('market_autosell_lane').canPurchase(state, TUNING)).toBe(false);
    });
  });

  describe('market_trade_deals', () => {
    const maxUpgrades = TUNING.market.price.maxUpgrades;

    it('increments price upgrade count', () => {
      const state = makeState({ florinCount: 1000, stone: 100 });
      inv('market_trade_deals').purchase(state, TUNING);
      expect(state.marketPriceUpgrades).toBe(1);
    });

    it('maxLevel blocks further purchase', () => {
      const state = makeState({ florinCount: 10000, stone: 1000, marketPriceUpgrades: maxUpgrades });
      expect(inv('market_trade_deals').canPurchase(state, TUNING)).toBe(false);
    });

    it('isOwned true at max upgrades', () => {
      expect(inv('market_trade_deals').isOwned(makeState({ marketPriceUpgrades: maxUpgrades }), TUNING)).toBe(true);
    });
  });
});

// ========================
// Resource Deduction Edge Cases
// ========================
describe('Resource deduction', () => {
  it('auto_ship_oil deducts both florins and stone', () => {
    const cost = TUNING.investments.autoShipOil.cost;
    const state = makeState({
      florinCount: cost.florins + 20,
      stone: cost.stone + 5,
      pressManagerHired: true,
    });
    inv('auto_ship_oil').purchase(state, TUNING);
    expect(state.florinCount).toBe(20);
    expect(state.stone).toBe(5);
    expect(state.autoShipOilUnlocked).toBe(true);
  });

  it('market_autosell_rate deducts both florins and stone', () => {
    const cost = TUNING.investments.marketAutosell.rateUpgradeCost;
    const state = makeState({ florinCount: cost.florins, stone: cost.stone });
    inv('market_autosell_rate').purchase(state, TUNING);
    expect(state.florinCount).toBe(0);
    expect(state.stone).toBe(0);
  });

  it('failed purchase leaves state unchanged', () => {
    const state = makeState({ florinCount: 5, stone: 1 });
    const snap = JSON.parse(JSON.stringify(state));
    inv('shipping_crates').purchase(state, TUNING);
    expect(state.florinCount).toBe(snap.florinCount);
    expect(state.stone).toBe(snap.stone);
    expect(state.shippingCrateLevel).toBe(snap.shippingCrateLevel);
  });
});
