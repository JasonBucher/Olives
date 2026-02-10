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
        `Behavior: Auto-harvest Olive Trees at capacity`,
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
        `Farm Hands (while paid): Growth bonus ×${multiplier} (+${bonusPct}% more from farm hands)`,
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
      const poorMult = tuning.managers.pressManager.poorMultiplier;
      const masterworkBonus = tuning.managers.pressManager.masterworkBonus;
      const poorReduction = ((1 - poorMult) * 100).toFixed(0);
      
      return [
        `Press (while paid): Poor outcomes reduced by ${poorReduction}%, enables Masterwork outcome (+${(masterworkBonus * 100).toFixed(0)}%)`,
        `Ongoing: Salary ${salary} florins/min`,
      ];
    },
  },
  
  // --- Upgrades ---
  {
    id: "standardized_tools",
    title: "Standardized Tools",
    group: "upgrade",
    
    cost: (tuning, state) => tuning.investments.costs.standardized_tools,
    
    isUnlocked: (state, tuning) => true,
    
    canPurchase: (state, tuning) => {
      return !state.upgrades.standardized_tools && 
             state.florinCount >= tuning.investments.costs.standardized_tools;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "standardized_tools");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.costs.standardized_tools;
      state.upgrades.standardized_tools = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const reduction = tuning.harvest.upgrades.standardized_tools.poorFlatReduction;
      return [
        `Harvest: Poor -${reduction.toFixed(2)}`,
      ];
    },
  },
  
  {
    id: "training_program",
    title: "Training Program",
    group: "upgrade",
    
    cost: (tuning, state) => tuning.investments.costs.training_program,
    
    isUnlocked: (state, tuning) => true,
    
    canPurchase: (state, tuning) => {
      return !state.upgrades.training_program && 
             state.florinCount >= tuning.investments.costs.training_program;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "training_program");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.costs.training_program;
      state.upgrades.training_program = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const mult = tuning.harvest.upgrades.training_program.poorMultiplierReduction;
      
      // State-aware preview: compute effective multiplier given current arborist status
      let effectiveMult = 1.0;
      if (state.arboristHired) {
        effectiveMult *= tuning.harvest.arborist.poorReductionMult;
      }
      const afterMult = effectiveMult * mult;
      
      if (state.arboristHired) {
        return [
          `Harvest: Poor multiplier ×${mult} (effective ×${afterMult.toFixed(2)} with Arborist)`,
        ];
      } else {
        return [
          `Harvest: Poor multiplier ×${mult}`,
        ];
      }
    },
  },
  
  {
    id: "selective_picking",
    title: "Selective Picking",
    group: "upgrade",
    
    cost: (tuning, state) => tuning.investments.costs.selective_picking,
    
    isUnlocked: (state, tuning) => true,
    
    canPurchase: (state, tuning) => {
      return !state.upgrades.selective_picking && 
             state.florinCount >= tuning.investments.costs.selective_picking;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "selective_picking");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.costs.selective_picking;
      state.upgrades.selective_picking = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const bonus = tuning.harvest.upgrades.selective_picking.efficientBonus;
      return [
        `Harvest: Efficient +${bonus.toFixed(2)}`,
      ];
    },
  },
  
  {
    id: "ladders_nets",
    title: "Ladders & Nets",
    group: "upgrade",
    
    cost: (tuning, state) => tuning.investments.costs.ladders_nets,
    
    isUnlocked: (state, tuning) => true,
    
    canPurchase: (state, tuning) => {
      return !state.upgrades.ladders_nets && 
             state.florinCount >= tuning.investments.costs.ladders_nets;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "ladders_nets");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.costs.ladders_nets;
      state.upgrades.ladders_nets = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const perHarvester = tuning.harvest.upgrades.ladders_nets.efficientPerHarvester;
      const cap = tuning.harvest.upgrades.ladders_nets.efficientCap;
      
      // State-aware preview: compute current and after-purchase efficient bonus
      if (!state.upgrades.ladders_nets) {
        const currentBonus = 0;
        const afterBonus = Math.min(state.harvesterCount * perHarvester, cap);
        
        if (state.harvesterCount > 0) {
          return [
            `Harvest: Efficient +${currentBonus.toFixed(2)} → +${afterBonus.toFixed(2)} (cap +${cap.toFixed(2)})`,
            `Scales with harvesters: +${perHarvester.toFixed(2)} per harvester`,
          ];
        } else {
          return [
            `Harvest: Efficient scales with harvesters (+${perHarvester.toFixed(2)} each, cap +${cap.toFixed(2)})`,
          ];
        }
      } else {
        // Already owned (shouldn't be visible, but for completeness)
        const currentBonus = Math.min(state.harvesterCount * perHarvester, cap);
        return [
          `Harvest: Efficient +${currentBonus.toFixed(2)} (cap +${cap.toFixed(2)})`,
        ];
      }
    },
  },
  
  {
    id: "quality_inspector",
    title: "Quality Inspector",
    group: "upgrade",
    
    cost: (tuning, state) => tuning.investments.costs.quality_inspector,
    
    isUnlocked: (state, tuning) => true,
    
    canPurchase: (state, tuning) => {
      return !state.upgrades.quality_inspector && 
             state.arboristHired &&
             state.florinCount >= tuning.investments.costs.quality_inspector;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "quality_inspector");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.costs.quality_inspector;
      state.upgrades.quality_inspector = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const bonus = tuning.harvest.upgrades.quality_inspector.efficientBonusWithArborist;
      const lines = [
        `Arborist: Efficient +${bonus.toFixed(2)} (amplifies Arborist benefits)`,
      ];
      
      if (!state.arboristHired) {
        lines.push(`Requires: Arborist`);
      }
      
      return lines;
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

  // --- Shipping Efficiency Upgrades ---
  {
    id: "olive_ship_efficiency_1",
    title: "Olive Ship Efficiency I",
    group: "upgrade",
    
    cost: (tuning, state) => tuning.investments.shippingEfficiency.olives[0].cost,
    
    isUnlocked: (state, tuning) => !state.upgrades.olive_ship_efficiency_1,
    
    canPurchase: (state, tuning) => {
      return !state.upgrades.olive_ship_efficiency_1 && 
             state.florinCount >= tuning.investments.shippingEfficiency.olives[0].cost;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "olive_ship_efficiency_1");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.shippingEfficiency.olives[0].cost;
      state.upgrades.olive_ship_efficiency_1 = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const bonus = tuning.investments.shippingEfficiency.olives[0].capacityBonus;
      return [
        `Market: Olive shipping capacity +${bonus}`,
      ];
    },
  },
  
  {
    id: "olive_ship_efficiency_2",
    title: "Olive Ship Efficiency II",
    group: "upgrade",
    
    cost: (tuning, state) => tuning.investments.shippingEfficiency.olives[1].cost,
    
    isUnlocked: (state, tuning) => state.upgrades.olive_ship_efficiency_1 && !state.upgrades.olive_ship_efficiency_2,
    
    canPurchase: (state, tuning) => {
      return !state.upgrades.olive_ship_efficiency_2 && 
             state.upgrades.olive_ship_efficiency_1 &&
             state.florinCount >= tuning.investments.shippingEfficiency.olives[1].cost;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "olive_ship_efficiency_2");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.shippingEfficiency.olives[1].cost;
      state.upgrades.olive_ship_efficiency_2 = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const bonus = tuning.investments.shippingEfficiency.olives[1].capacityBonus;
      return [
        `Market: Olive shipping capacity +${bonus}`,
      ];
    },
  },
  
  {
    id: "olive_ship_efficiency_3",
    title: "Olive Ship Efficiency III",
    group: "upgrade",
    
    cost: (tuning, state) => tuning.investments.shippingEfficiency.olives[2].cost,
    
    isUnlocked: (state, tuning) => state.upgrades.olive_ship_efficiency_2 && !state.upgrades.olive_ship_efficiency_3,
    
    canPurchase: (state, tuning) => {
      return !state.upgrades.olive_ship_efficiency_3 && 
             state.upgrades.olive_ship_efficiency_2 &&
             state.florinCount >= tuning.investments.shippingEfficiency.olives[2].cost;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "olive_ship_efficiency_3");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.shippingEfficiency.olives[2].cost;
      state.upgrades.olive_ship_efficiency_3 = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const bonus = tuning.investments.shippingEfficiency.olives[2].capacityBonus;
      return [
        `Market: Olive shipping capacity +${bonus}`,
      ];
    },
  },
  
  {
    id: "olive_oil_ship_efficiency_1",
    title: "Olive Oil Ship Efficiency I",
    group: "upgrade",
    
    cost: (tuning, state) => tuning.investments.shippingEfficiency.oliveOil[0].cost,
    
    isUnlocked: (state, tuning) => !state.upgrades.olive_oil_ship_efficiency_1,
    
    canPurchase: (state, tuning) => {
      return !state.upgrades.olive_oil_ship_efficiency_1 && 
             state.florinCount >= tuning.investments.shippingEfficiency.oliveOil[0].cost;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "olive_oil_ship_efficiency_1");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.shippingEfficiency.oliveOil[0].cost;
      state.upgrades.olive_oil_ship_efficiency_1 = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const bonus = tuning.investments.shippingEfficiency.oliveOil[0].capacityBonus;
      return [
        `Market: Olive Oil shipping capacity +${bonus}`,
      ];
    },
  },
  
  {
    id: "olive_oil_ship_efficiency_2",
    title: "Olive Oil Ship Efficiency II",
    group: "upgrade",
    
    cost: (tuning, state) => tuning.investments.shippingEfficiency.oliveOil[1].cost,
    
    isUnlocked: (state, tuning) => state.upgrades.olive_oil_ship_efficiency_1 && !state.upgrades.olive_oil_ship_efficiency_2,
    
    canPurchase: (state, tuning) => {
      return !state.upgrades.olive_oil_ship_efficiency_2 && 
             state.upgrades.olive_oil_ship_efficiency_1 &&
             state.florinCount >= tuning.investments.shippingEfficiency.oliveOil[1].cost;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "olive_oil_ship_efficiency_2");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.shippingEfficiency.oliveOil[1].cost;
      state.upgrades.olive_oil_ship_efficiency_2 = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const bonus = tuning.investments.shippingEfficiency.oliveOil[1].capacityBonus;
      return [
        `Market: Olive Oil shipping capacity +${bonus}`,
      ];
    },
  },
  
  {
    id: "olive_oil_ship_efficiency_3",
    title: "Olive Oil Ship Efficiency III",
    group: "upgrade",
    
    cost: (tuning, state) => tuning.investments.shippingEfficiency.oliveOil[2].cost,
    
    isUnlocked: (state, tuning) => state.upgrades.olive_oil_ship_efficiency_2 && !state.upgrades.olive_oil_ship_efficiency_3,
    
    canPurchase: (state, tuning) => {
      return !state.upgrades.olive_oil_ship_efficiency_3 && 
             state.upgrades.olive_oil_ship_efficiency_2 &&
             state.florinCount >= tuning.investments.shippingEfficiency.oliveOil[2].cost;
    },
    
    purchase: (state, tuning) => {
      const inv = INVESTMENTS.find(i => i.id === "olive_oil_ship_efficiency_3");
      if (!inv.canPurchase(state, tuning)) return false;
      state.florinCount -= tuning.investments.shippingEfficiency.oliveOil[2].cost;
      state.upgrades.olive_oil_ship_efficiency_3 = true;
      return true;
    },
    
    effectLines: (state, tuning) => {
      const bonus = tuning.investments.shippingEfficiency.oliveOil[2].capacityBonus;
      return [
        `Market: Olive Oil shipping capacity +${bonus}`,
      ];
    },
  },
];
