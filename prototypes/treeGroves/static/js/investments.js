/**
 * Investments Registry
 * 
 * Design principles:
 * - All numeric UI text must be generated from TUNING/state; no hardcoded numbers in effect lines.
 * - State-aware previews should be computed only when safe (known formulas, no side effects).
 * - Each investment defines its own cost, unlock conditions, purchase logic, and effect descriptions.
 * - Effect lines use short category prefixes (Behavior:, Harvest:, Arborist:, Ongoing:).
 * - Numeric formatting conventions:
 *   - Multipliers: ×0.5
 *   - Additive odds: +0.06
 *   - Reductions: -0.08
 *   - Costs: "50 florins", "salary 0.2 florins/min"
 */

import { computeHarvestOutcomeWeights, BASE_HARVEST_OUTCOMES } from './harvestWeights.js';

/**
 * Registry of all available investments (managers and upgrades)
 * Organized logically by type. UI sorting happens at render time based on group and cost.
 */
export const INVESTMENTS = [
  // --- Managers ---
  {
    id: "arborist",
    title: "Hire an Arborist",
    group: "manager",
    
    cost: (tuning, state) => tuning.managers.arborist.hireCost,
    
    isUnlocked: (state, tuning) => true,
    
    canPurchase: (state, tuning) => {
      return !state.arboristHired && 
             state.florinCount >= tuning.managers.arborist.hireCost;
    },
    
    purchase: (state, tuning) => {
      if (!INVESTMENTS[0].canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.managers.arborist.hireCost;
      state.arboristHired = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const salary = tuning.managers.arborist.salaryPerMin;
      const poorMult = tuning.harvest.arborist.poorReductionMult;
      const efficientBonus = tuning.harvest.arborist.efficientBonus;
      
      return [
        `Behavior: Auto-harvest when batch is ready`,
        `Harvest (while paid): Poor multiplier ×${poorMult}, Efficient +${efficientBonus.toFixed(2)}`,
        `Ongoing: Salary ${salary} florins/min`,
      ];
    },
  },

  {
    id: "foreman",
    title: "Hire a Foreman",
    group: "manager",
    
    cost: (tuning, state) => tuning.managers.foreman.hireCost,
    
    isUnlocked: (state, tuning) => true,
    
    canPurchase: (state, tuning) => {
      return !state.foremanHired && 
             state.florinCount >= tuning.managers.foreman.hireCost;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "foreman");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.managers.foreman.hireCost;
      state.foremanHired = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const salary = tuning.managers.foreman.salaryPerMin;
      const multiplier = tuning.managers.foreman.growthMultiplier;
      const bonusPct = ((multiplier - 1) * 100).toFixed(0);
      
      return [
        `Cultivators (while paid): Growth bonus ×${multiplier} (+${bonusPct}% more from cultivators)`,
        `Ongoing: Salary ${salary} florins/min`,
      ];
    },
  },

  {
    id: "pressManager",
    title: "Hire a Press Manager",
    group: "manager",
    
    cost: (tuning, state) => tuning.managers.pressManager.hireCost,
    
    isUnlocked: (state, tuning) => true,
    
    canPurchase: (state, tuning) => {
      return !state.pressManagerHired && 
             state.florinCount >= tuning.managers.pressManager.hireCost;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "pressManager");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.managers.pressManager.hireCost;
      state.pressManagerHired = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const salary = tuning.managers.pressManager.salaryPerMin;

      const mult = tuning.managers.pressManager.presserMultiplier;
      const pct = Math.round((mult - 1) * 100);
      return [
        `Behavior: Auto-presses olives when available`,
        `Bonus: +${pct}% presser oil output`,
        `Unlocks: Automate Oil Shipments`,
        `Ongoing: Salary ${salary} florins/min`,
      ];
    },
  },
  
  {
    id: "quarryManager",
    title: "Hire a Quarry Manager",
    group: "manager",

    cost: (tuning, state) => tuning.managers.quarryManager.hireCost,

    isUnlocked: (state, tuning) => true,

    canPurchase: (state, tuning) => {
      return !state.quarryManagerHired &&
             state.florinCount >= tuning.managers.quarryManager.hireCost;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "quarryManager");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.managers.quarryManager.hireCost;
      state.quarryManagerHired = true;
      return true;
    },

    effectLines: (state, tuning) => {
      const salary = tuning.managers.quarryManager.salaryPerMin;

      return [
        `Behavior: Auto-quarry continuously`,
        `Ongoing: Salary ${salary} florins/min`,
      ];
    },
  },

  // --- Upgrades ---
  {
    id: "improved_harvesting",
    title: "Improved Harvesting",
    group: "upgrade",

    cost: (tuning, state) => tuning.investments.costs.improved_harvesting,

    isUnlocked: (state, tuning) => true,

    canPurchase: (state, tuning) => {
      return !state.upgrades.improved_harvesting &&
             state.florinCount >= tuning.investments.costs.improved_harvesting;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "improved_harvesting");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.costs.improved_harvesting;
      state.upgrades.improved_harvesting = true;
      return true;
    },

    effectLines: (state, tuning) => {
      const cfg = tuning.harvest.upgrades.improved_harvesting;
      const bonus = cfg.efficientBonus;
      const perHarvester = cfg.efficientPerHarvester;
      const cap = cfg.efficientCap;

      return [
        `Harvest: Efficient +${bonus.toFixed(2)}`,
        `Scales with harvesters: +${perHarvester.toFixed(2)} per harvester (cap +${cap.toFixed(2)})`,
      ];
    },
  },
  
  // --- Grove Expansion Upgrades ---
  {
    id: "expand_grove_1",
    title: "Expand Grove I",
    group: "upgrade",

    cost: (tuning, state) => tuning.investments.groveExpansion[0].florinCost,

    costText: (tuning, state) => {
      const tier = tuning.investments.groveExpansion[0];
      return `${tier.florinCost} florins, ${tier.stoneCost} stone`;
    },

    isUnlocked: (state, tuning) => !state.upgrades.expand_grove_1,

    canPurchase: (state, tuning) => {
      const tier = tuning.investments.groveExpansion[0];
      return !state.upgrades.expand_grove_1 &&
             state.florinCount >= tier.florinCost &&
             state.stone >= tier.stoneCost;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "expand_grove_1");
      if (!inv.canPurchase(state, tuning)) return false;
      const tier = tuning.investments.groveExpansion[0];
      state.florinCount -= tier.florinCost;
      state.stone -= tier.stoneCost;
      if (state.stone < 0) state.stone = 0;
      state.upgrades.expand_grove_1 = true;
      return true;
    },

    effectLines: (state, tuning) => {
      const bonus = tuning.investments.groveExpansion[0].capacityBonus;
      return [
        `Grove: Max trees +${bonus}`,
      ];
    },
  },

  {
    id: "expand_grove_2",
    title: "Expand Grove II",
    group: "upgrade",

    cost: (tuning, state) => tuning.investments.groveExpansion[1].florinCost,

    costText: (tuning, state) => {
      const tier = tuning.investments.groveExpansion[1];
      return `${tier.florinCost} florins, ${tier.stoneCost} stone`;
    },

    isUnlocked: (state, tuning) => state.upgrades.expand_grove_1 && !state.upgrades.expand_grove_2,

    prerequisitesMet: (state, tuning) => !!state.upgrades.expand_grove_1,

    canPurchase: (state, tuning) => {
      const tier = tuning.investments.groveExpansion[1];
      return !state.upgrades.expand_grove_2 &&
             state.upgrades.expand_grove_1 &&
             state.florinCount >= tier.florinCost &&
             state.stone >= tier.stoneCost;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "expand_grove_2");
      if (!inv.canPurchase(state, tuning)) return false;
      const tier = tuning.investments.groveExpansion[1];
      state.florinCount -= tier.florinCost;
      state.stone -= tier.stoneCost;
      if (state.stone < 0) state.stone = 0;
      state.upgrades.expand_grove_2 = true;
      return true;
    },

    effectLines: (state, tuning) => {
      const bonus = tuning.investments.groveExpansion[1].capacityBonus;
      const lines = [
        `Grove: Max trees +${bonus}`,
      ];
      if (!state.upgrades.expand_grove_1) {
        lines.push(`Requires: Expand Grove I`);
      }
      return lines;
    },
  },

  {
    id: "expand_grove_3",
    title: "Expand Grove III",
    group: "upgrade",

    cost: (tuning, state) => tuning.investments.groveExpansion[2].florinCost,

    costText: (tuning, state) => {
      const tier = tuning.investments.groveExpansion[2];
      return `${tier.florinCost} florins, ${tier.stoneCost} stone`;
    },

    isUnlocked: (state, tuning) => state.upgrades.expand_grove_2 && !state.upgrades.expand_grove_3,

    prerequisitesMet: (state, tuning) => !!state.upgrades.expand_grove_2,

    canPurchase: (state, tuning) => {
      const tier = tuning.investments.groveExpansion[2];
      return !state.upgrades.expand_grove_3 &&
             state.upgrades.expand_grove_2 &&
             state.florinCount >= tier.florinCost &&
             state.stone >= tier.stoneCost;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "expand_grove_3");
      if (!inv.canPurchase(state, tuning)) return false;
      const tier = tuning.investments.groveExpansion[2];
      state.florinCount -= tier.florinCost;
      state.stone -= tier.stoneCost;
      if (state.stone < 0) state.stone = 0;
      state.upgrades.expand_grove_3 = true;
      return true;
    },

    effectLines: (state, tuning) => {
      const bonus = tuning.investments.groveExpansion[2].capacityBonus;
      const lines = [
        `Grove: Max trees +${bonus}`,
      ];
      if (!state.upgrades.expand_grove_2) {
        lines.push(`Requires: Expand Grove II`);
      }
      return lines;
    },
  },

  // --- Market Stall Upgrades ---
  {
    id: "market_autosell_rate",
    title: "Improve Market Stall",
    group: "upgrade",

    cost: (tuning, state) => tuning.investments.marketAutosell.rateUpgradeCost.florins,

    costText: (tuning, state) => {
      const cost = tuning.investments.marketAutosell.rateUpgradeCost;
      return `${cost.florins} florins, ${cost.stone} stone`;
    },

    isUnlocked: (state, tuning) => true,

    canPurchase: (state, tuning) => {
      const cost = tuning.investments.marketAutosell.rateUpgradeCost;
      const current = Number(state.marketAutosellRateUpgrades) || 0;
      return current < tuning.market.autosell.maxRateUpgrades &&
             state.florinCount >= cost.florins &&
             state.stone >= cost.stone;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "market_autosell_rate");
      if (!inv.canPurchase(state, tuning)) return false;
      const cost = tuning.investments.marketAutosell.rateUpgradeCost;
      state.florinCount -= cost.florins;
      state.stone -= cost.stone;
      if (state.stone < 0) state.stone = 0;
      state.marketAutosellRateUpgrades = (Number(state.marketAutosellRateUpgrades) || 0) + 1;
      return true;
    },

    effectLines: (state, tuning) => {
      const amount = tuning.market.autosell.rateUpgradeAmount;
      const purchased = Math.min(
        Number(state.marketAutosellRateUpgrades) || 0,
        tuning.market.autosell.maxRateUpgrades
      );
      const max = tuning.market.autosell.maxRateUpgrades;
      return [
        `Market: Auto-selling +${amount.toFixed(2)} / s`,
        `Purchased: ${purchased}/${max}`,
      ];
    },
  },

  {
    id: "market_autosell_lane",
    title: "Hire Vendor",
    group: "upgrade",

    cost: (tuning, state) => tuning.investments.marketAutosell.laneUpgradeCost.florins,

    costText: (tuning, state) => {
      const cost = tuning.investments.marketAutosell.laneUpgradeCost;
      return `${cost.florins} florins, ${cost.stone} stone`;
    },

    isUnlocked: (state, tuning) => true,

    canPurchase: (state, tuning) => {
      const cost = tuning.investments.marketAutosell.laneUpgradeCost;
      const current = Number(state.marketLanesPurchased) || 0;
      return current < tuning.market.lanes.maxAdditionalLanes &&
             state.florinCount >= cost.florins &&
             state.stone >= cost.stone;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "market_autosell_lane");
      if (!inv.canPurchase(state, tuning)) return false;
      const cost = tuning.investments.marketAutosell.laneUpgradeCost;
      state.florinCount -= cost.florins;
      state.stone -= cost.stone;
      if (state.stone < 0) state.stone = 0;
      state.marketLanesPurchased = (Number(state.marketLanesPurchased) || 0) + 1;
      return true;
    },

    effectLines: (state, tuning) => {
      const laneIncrease = tuning.market.lanes.laneUpgradeAmount;
      const purchased = Math.min(
        Number(state.marketLanesPurchased) || 0,
        tuning.market.lanes.maxAdditionalLanes
      );
      const max = tuning.market.lanes.maxAdditionalLanes;
      const laneLabel = laneIncrease === 1 ? "lane" : "lanes";
      return [
        `Market: Auto-selling +${laneIncrease} ${laneLabel}`,
        `Purchased: ${purchased}/${max}`,
      ];
    },
  },

  {
    id: "market_trade_deals",
    title: "Better Trade Deals",
    group: "upgrade",

    cost: (tuning, state) => tuning.investments.marketPrice.upgradeCost.florins,

    costText: (tuning, state) => {
      const cost = tuning.investments.marketPrice.upgradeCost;
      return `${cost.florins} florins, ${cost.stone} stone`;
    },

    isUnlocked: (state, tuning) => true,

    canPurchase: (state, tuning) => {
      const cost = tuning.investments.marketPrice.upgradeCost;
      const current = Number(state.marketPriceUpgrades) || 0;
      return current < tuning.market.price.maxUpgrades &&
             state.florinCount >= cost.florins &&
             state.stone >= cost.stone;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "market_trade_deals");
      if (!inv.canPurchase(state, tuning)) return false;
      const cost = tuning.investments.marketPrice.upgradeCost;
      state.florinCount -= cost.florins;
      state.stone -= cost.stone;
      if (state.stone < 0) state.stone = 0;
      state.marketPriceUpgrades = (Number(state.marketPriceUpgrades) || 0) + 1;
      return true;
    },

    effectLines: (state, tuning) => {
      const bonusPct = tuning.market.price.upgradeMultiplier * 100;
      const purchased = Math.min(
        Number(state.marketPriceUpgrades) || 0,
        tuning.market.price.maxUpgrades
      );
      const max = tuning.market.price.maxUpgrades;
      return [
        `Market: +${bonusPct.toFixed(0)}% florins per unit sold`,
        `Purchased: ${purchased}/${max}`,
      ];
    },
  },

  // --- Olive Press Expansion ---
  {
    id: "build_olive_press",
    title: "Build Olive Press",
    group: "upgrade",

    cost: (tuning, state) => {
      const cfg = tuning.investments.olivePressExpansion;
      const additional = (state.olivePressCount || 1) - 1;
      return cfg.baseCost.florins + additional * cfg.costScale.florins;
    },

    costText: (tuning, state) => {
      const cfg = tuning.investments.olivePressExpansion;
      const additional = (state.olivePressCount || 1) - 1;
      const florins = cfg.baseCost.florins + additional * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + additional * cfg.costScale.stone;
      return `${florins} florins, ${stone} stone`;
    },

    isUnlocked: (state, tuning) => true,

    canPurchase: (state, tuning) => {
      const cfg = tuning.investments.olivePressExpansion;
      const additional = (state.olivePressCount || 1) - 1;
      if (additional >= cfg.maxAdditionalPresses) return false;
      const florins = cfg.baseCost.florins + additional * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + additional * cfg.costScale.stone;
      return state.florinCount >= florins && state.stone >= stone;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "build_olive_press");
      if (!inv.canPurchase(state, tuning)) return false;
      const cfg = tuning.investments.olivePressExpansion;
      const additional = (state.olivePressCount || 1) - 1;
      const florins = cfg.baseCost.florins + additional * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + additional * cfg.costScale.stone;
      state.florinCount -= florins;
      state.stone -= stone;
      if (state.stone < 0) state.stone = 0;
      state.olivePressCount = (state.olivePressCount || 1) + 1;
      return true;
    },

    effectLines: (state, tuning) => {
      const cfg = tuning.investments.olivePressExpansion;
      const additional = (state.olivePressCount || 1) - 1;
      return [
        `Production: Olive Presses +1`,
        `Purchased: ${additional}/${cfg.maxAdditionalPresses}`,
      ];
    },
  },

  // --- Auto-Ship Oil ---
  {
    id: "auto_ship_oil",
    title: "Automate Oil Shipments",
    group: "upgrade",

    cost: (tuning, state) => tuning.investments.autoShipOil.cost.florins,

    costText: (tuning, state) => {
      const cost = tuning.investments.autoShipOil.cost;
      return `${cost.florins} florins, ${cost.stone} stone`;
    },

    isUnlocked: (state, tuning) => !!state.pressManagerHired,

    prerequisitesMet: (state, tuning) => !!state.pressManagerHired,

    canPurchase: (state, tuning) => {
      const cost = tuning.investments.autoShipOil.cost;
      return !state.autoShipOilUnlocked &&
             state.pressManagerHired &&
             state.florinCount >= cost.florins &&
             state.stone >= cost.stone;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "auto_ship_oil");
      if (!inv.canPurchase(state, tuning)) return false;
      const cost = tuning.investments.autoShipOil.cost;
      state.florinCount -= cost.florins;
      state.stone -= cost.stone;
      if (state.stone < 0) state.stone = 0;
      state.autoShipOilUnlocked = true;
      return true;
    },

    effectLines: (state, tuning) => {
      const lines = [
        `Behavior: Auto-ship olive oil to market when available`,
      ];
      if (!state.pressManagerHired) {
        lines.push(`Requires: Press Manager`);
      }
      return lines;
    },
  },

  // --- Quarry Upgrades ---
  {
    id: "pulley_cart",
    title: "Pulley & Cart",
    group: "upgrade",

    cost: (tuning, state) => {
      const cfg = tuning.investments.pulleyCart;
      const level = state.quarryCartLevel || 0;
      return cfg.baseCost.florins + level * cfg.costScale.florins;
    },

    costText: (tuning, state) => {
      const cfg = tuning.investments.pulleyCart;
      const level = state.quarryCartLevel || 0;
      const florins = cfg.baseCost.florins + level * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + level * cfg.costScale.stone;
      return `${florins} florins, ${stone} stone`;
    },

    isUnlocked: (state, tuning) => true,

    canPurchase: (state, tuning) => {
      const cfg = tuning.investments.pulleyCart;
      const level = state.quarryCartLevel || 0;
      if (level >= cfg.maxLevel) return false;
      const florins = cfg.baseCost.florins + level * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + level * cfg.costScale.stone;
      return state.florinCount >= florins && state.stone >= stone;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "pulley_cart");
      if (!inv.canPurchase(state, tuning)) return false;
      const cfg = tuning.investments.pulleyCart;
      const level = state.quarryCartLevel || 0;
      const florins = cfg.baseCost.florins + level * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + level * cfg.costScale.stone;
      state.florinCount -= florins;
      state.stone -= stone;
      if (state.stone < 0) state.stone = 0;
      state.quarryCartLevel = level + 1;
      return true;
    },

    effectLines: (state, tuning) => {
      const cfg = tuning.investments.pulleyCart;
      const level = state.quarryCartLevel || 0;
      const reductionPct = (cfg.reductionPerLevel * 100).toFixed(0);
      return [
        `Quarry: -${reductionPct}% duration`,
        `Purchased: ${level}/${cfg.maxLevel}`,
      ];
    },
  },

  {
    id: "sharpened_picks",
    title: "Sharpened Picks",
    group: "upgrade",

    cost: (tuning, state) => {
      const cfg = tuning.investments.sharpenedPicks;
      const level = state.quarryPickLevel || 0;
      return cfg.baseCost.florins + level * cfg.costScale.florins;
    },

    costText: (tuning, state) => {
      const cfg = tuning.investments.sharpenedPicks;
      const level = state.quarryPickLevel || 0;
      const florins = cfg.baseCost.florins + level * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + level * cfg.costScale.stone;
      return `${florins} florins, ${stone} stone`;
    },

    isUnlocked: (state, tuning) => true,

    canPurchase: (state, tuning) => {
      const cfg = tuning.investments.sharpenedPicks;
      const level = state.quarryPickLevel || 0;
      if (level >= cfg.maxLevel) return false;
      const florins = cfg.baseCost.florins + level * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + level * cfg.costScale.stone;
      return state.florinCount >= florins && state.stone >= stone;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "sharpened_picks");
      if (!inv.canPurchase(state, tuning)) return false;
      const cfg = tuning.investments.sharpenedPicks;
      const level = state.quarryPickLevel || 0;
      const florins = cfg.baseCost.florins + level * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + level * cfg.costScale.stone;
      state.florinCount -= florins;
      state.stone -= stone;
      if (state.stone < 0) state.stone = 0;
      state.quarryPickLevel = level + 1;
      return true;
    },

    effectLines: (state, tuning) => {
      const cfg = tuning.investments.sharpenedPicks;
      const level = state.quarryPickLevel || 0;
      return [
        `Quarry: +${cfg.bonusPerLevel} stone per run`,
        `Purchased: ${level}/${cfg.maxLevel}`,
      ];
    },
  },

  // --- Harvest Baskets ---
  {
    id: "harvest_baskets",
    title: "Harvest Baskets",
    group: "upgrade",

    cost: (tuning, state) => {
      const cfg = tuning.investments.harvestBaskets;
      const level = state.harvestBasketLevel || 0;
      return cfg.baseCost.florins + level * cfg.costScale.florins;
    },

    costText: (tuning, state) => {
      const cfg = tuning.investments.harvestBaskets;
      const level = state.harvestBasketLevel || 0;
      const florins = cfg.baseCost.florins + level * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + level * cfg.costScale.stone;
      return `${florins} florins, ${stone} stone`;
    },

    isUnlocked: (state, tuning) => true,

    canPurchase: (state, tuning) => {
      const cfg = tuning.investments.harvestBaskets;
      const level = state.harvestBasketLevel || 0;
      if (level >= cfg.maxLevel) return false;
      const florins = cfg.baseCost.florins + level * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + level * cfg.costScale.stone;
      return state.florinCount >= florins && state.stone >= stone;
    },

    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "harvest_baskets");
      if (!inv.canPurchase(state, tuning)) return false;
      const cfg = tuning.investments.harvestBaskets;
      const level = state.harvestBasketLevel || 0;
      const florins = cfg.baseCost.florins + level * cfg.costScale.florins;
      const stone = cfg.baseCost.stone + level * cfg.costScale.stone;
      state.florinCount -= florins;
      state.stone -= stone;
      if (state.stone < 0) state.stone = 0;
      state.harvestBasketLevel = level + 1;
      return true;
    },

    effectLines: (state, tuning) => {
      const cfg = tuning.investments.harvestBaskets;
      const level = state.harvestBasketLevel || 0;
      return [
        `Harvest: +${cfg.bonusPerLevel} olives per harvest`,
        `Purchased: ${level}/${cfg.maxLevel}`,
      ];
    },
  },

];
