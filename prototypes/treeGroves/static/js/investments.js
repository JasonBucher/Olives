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
 * Ordered by: managers first, then upgrades in logical progression
 */
export const INVESTMENTS = [
  // --- Managers ---
  {
    id: "arborist",
    title: "Hire an Arborist",
    
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
      const capacity = tuning.grove.treeCapacity;
      const salary = tuning.managers.arborist.salaryPerMin;
      const poorMult = tuning.harvest.arborist.poorReductionMult;
      const efficientBonus = tuning.harvest.arborist.efficientBonus;
      
      return [
        `Behavior: Auto-harvest at capacity (${capacity}/${capacity})`,
        `Harvest (while paid): Poor multiplier ×${poorMult}, Efficient +${efficientBonus.toFixed(2)}`,
        `Ongoing: Salary ${salary} florins/min`,
      ];
    },
  },
  
  // --- Upgrades ---
  {
    id: "standardized_tools",
    title: "Standardized Tools",
    
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
];
