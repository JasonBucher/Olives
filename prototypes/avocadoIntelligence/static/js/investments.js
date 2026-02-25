// Investment registry — a flat list of purchasable upgrades / unlocks.
//
// Contract for each entry:
//   {
//     id:          String   — unique key, used in state (e.g. "strong_thumb")
//     title:       String   — display name
//     group:       String   — UI grouping (e.g. "click", "production", "global")
//     cost:        (state, tuning) => Number
//     isUnlocked:  (state, ctx) => Boolean   — visible to player?
//     isOwned:     (state, tuning) => Boolean   — already purchased?
//     canPurchase: (state, tuning) => Boolean   — meets requirements?
//     purchase:    (state, tuning) => void       — mutate state on buy
//     effectLines: (state, tuning) => String[]   — tooltip / description lines
//   }

import { TUNING } from "./tuning.js";

function makeUpgrade(id) {
  const cfg = TUNING.upgrades[id];
  return {
    id,
    title: cfg.title,
    group: cfg.producerId ? "production" : cfg.clickMult ? "click" : "global",
    cost: () => cfg.cost,
    isUnlocked: (state, ctx) => {
      // Prerequisite upgrade must be owned first
      if (cfg.requiresUpgrade && !state.upgrades[cfg.requiresUpgrade]) return false;
      // Guac-gated upgrades: must have enough guac
      if (cfg.guacUnlockAt && (state.guacCount || 0) < cfg.guacUnlockAt) return false;
      // APS-gated upgrades: must have enough APS
      if (cfg.apsUnlockAt && (ctx?.currentAps || 0) < cfg.apsUnlockAt) return false;
      if (cfg.unlockAt <= 0 && !cfg.apsUnlockAt) return true;
      // Producer-linked: must own at least 1, then check unlockAt threshold
      if (cfg.producerId) {
        if ((state.producers[cfg.producerId] || 0) < 1) return false;
        return (state.producers[cfg.producerId] || 0) >= cfg.unlockAt;
      }
      return !cfg.apsUnlockAt; // apsUnlockAt-only upgrades: already checked above
    },
    isOwned: (state) => !!state.upgrades[id],
    canPurchase: (state) => !state.upgrades[id] && state.avocadoCount >= cfg.cost,
    purchase: (state) => {
      state.avocadoCount -= cfg.cost;
      state.upgrades[id] = true;
    },
    effectLines: () => [cfg.desc],
  };
}

export const INVESTMENTS = [
  makeUpgrade("strong_thumb"),
  makeUpgrade("iron_thumb"),
  makeUpgrade("efficient_saplings"),
  makeUpgrade("drip_irrigation"),
  makeUpgrade("drone_swarm"),
  makeUpgrade("lab_coats"),
  makeUpgrade("global_boost_1"),
  makeUpgrade("global_boost_2"),
  makeUpgrade("guac_unlock"),
  makeUpgrade("wisdom_boost"),
  makeUpgrade("guac_recycler"),
  makeUpgrade("bulk_fermentation"),
  makeUpgrade("superlinear_synth"),
  makeUpgrade("exponential_ripen"),
  makeUpgrade("concentrate_proto"),
  makeUpgrade("throughput_click_1"),
  makeUpgrade("throughput_click_2"),
  makeUpgrade("throughput_click_3"),
  makeUpgrade("dark_pool"),
  makeUpgrade("pit_optimization"),
  makeUpgrade("attention_focus"),
  makeUpgrade("transformer_scale"),
  makeUpgrade("seed_catalog"),
  makeUpgrade("hot_compost"),
  makeUpgrade("climate_control"),
  makeUpgrade("harvest_fleet"),
  makeUpgrade("data_lake"),
  makeUpgrade("gpu_overclock"),
  makeUpgrade("global_boost_3"),
].sort((a, b) => a.cost() - b.cost());
