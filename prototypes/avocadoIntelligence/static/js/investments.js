// Investment registry — a flat list of purchasable upgrades / unlocks.
//
// Contract for each entry:
//   {
//     id:          String   — unique key, used in state (e.g. "strong_thumb")
//     title:       String   — display name
//     group:       String   — UI grouping (e.g. "click", "production", "global")
//     cost:        (state, tuning) => Number
//     isUnlocked:  (state, tuning) => Boolean   — visible to player?
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
    isUnlocked: (state) => {
      // Prerequisite upgrade must be owned first
      if (cfg.requiresUpgrade && !state.upgrades[cfg.requiresUpgrade]) return false;
      // Guac-gated upgrades: must have enough guac
      if (cfg.guacUnlockAt && (state.guacCount || 0) < cfg.guacUnlockAt) return false;
      if (cfg.unlockAt <= 0) return true;
      // unlockAt means "need this many of the target producer"
      return cfg.producerId ? (state.producers[cfg.producerId] || 0) >= cfg.unlockAt : true;
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
  makeUpgrade("attention_focus"),
  makeUpgrade("transformer_scale"),
];
