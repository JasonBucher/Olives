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
    group: cfg.synergyPct ? "synergy" : cfg.producerId ? "production" : cfg.clickMult ? "click" : "global",
    cost: () => cfg.cost,
    isUnlocked: (state, ctx) => {
      // Prestige gate: must have completed enough prestiges
      if (cfg.minPrestigeCount && (state.prestigeCount || 0) < cfg.minPrestigeCount) return false;
      // Wisdom unlock gate: must own the specified wisdom unlock
      if (cfg.requiresWisdomUnlock && !state.wisdomUnlocks[cfg.requiresWisdomUnlock]) return false;
      // Prerequisite upgrade must be owned first
      if (cfg.requiresUpgrade && !state.upgrades[cfg.requiresUpgrade]) return false;
      // Guac-gated upgrades: must have enough guac
      if (cfg.guacUnlockAt && (state.guacCount || 0) < cfg.guacUnlockAt) return false;
      // APS-gated upgrades: must have enough APS
      if (cfg.apsUnlockAt && (ctx?.currentAps || 0) < cfg.apsUnlockAt) return false;
      if (cfg.unlockAt <= 0 && !cfg.apsUnlockAt && !cfg.sourceReq) return true;
      // Synergy gate: need N source producers AND N target producers
      if (cfg.sourceReq && cfg.synergySource) {
        if ((state.producers[cfg.synergySource] || 0) < cfg.sourceReq) return false;
      }
      if (cfg.targetReq && cfg.synergyTarget) {
        if ((state.producers[cfg.synergyTarget] || 0) < cfg.targetReq) return false;
      }
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
  makeUpgrade("neural_backprop"),
  makeUpgrade("synth_genome"),
  makeUpgrade("catalytic_convert"),
  makeUpgrade("ultracentrifuge"),
  makeUpgrade("cloud_autoscale"),
  makeUpgrade("quantum_annealing"),
  makeUpgrade("recursive_improve"),
  makeUpgrade("emergent_caps"),
  makeUpgrade("stellar_engineer"),
  makeUpgrade("heat_death_opt"),
  makeUpgrade("global_boost_3"),
  // Multi-tier producer upgrades (55 new)
  // Early (T2–T5)
  makeUpgrade("sapling_t2"),
  makeUpgrade("sapling_t3"),
  makeUpgrade("sapling_t4"),
  makeUpgrade("sapling_t5"),
  makeUpgrade("seed_bank_t2"),
  makeUpgrade("seed_bank_t3"),
  makeUpgrade("seed_bank_t4"),
  makeUpgrade("seed_bank_t5"),
  makeUpgrade("orchard_row_t2"),
  makeUpgrade("orchard_row_t3"),
  makeUpgrade("orchard_row_t4"),
  makeUpgrade("orchard_row_t5"),
  makeUpgrade("compost_bin_t2"),
  makeUpgrade("compost_bin_t3"),
  makeUpgrade("compost_bin_t4"),
  makeUpgrade("compost_bin_t5"),
  makeUpgrade("drone_t2"),
  makeUpgrade("drone_t3"),
  makeUpgrade("drone_t4"),
  makeUpgrade("drone_t5"),
  makeUpgrade("greenhouse_t2"),
  makeUpgrade("greenhouse_t3"),
  makeUpgrade("greenhouse_t4"),
  makeUpgrade("greenhouse_t5"),
  // Mid (T2–T4)
  makeUpgrade("harvest_bot_t2"),
  makeUpgrade("harvest_bot_t3"),
  makeUpgrade("harvest_bot_t4"),
  makeUpgrade("exchange_t2"),
  makeUpgrade("exchange_t3"),
  makeUpgrade("exchange_t4"),
  makeUpgrade("data_grove_t2"),
  makeUpgrade("data_grove_t3"),
  makeUpgrade("data_grove_t4"),
  makeUpgrade("attention_head_t2"),
  makeUpgrade("attention_head_t3"),
  makeUpgrade("attention_head_t4"),
  makeUpgrade("pit_miner_t2"),
  makeUpgrade("pit_miner_t3"),
  makeUpgrade("pit_miner_t4"),
  // Late (T2–T3)
  makeUpgrade("gpu_cluster_t2"),
  makeUpgrade("gpu_cluster_t3"),
  makeUpgrade("gpu_cluster_t4"),
  makeUpgrade("neural_pit_t2"),
  makeUpgrade("neural_pit_t3"),
  makeUpgrade("synth_orchard_t2"),
  makeUpgrade("synth_orchard_t3"),
  makeUpgrade("transformer_t2"),
  makeUpgrade("transformer_t3"),
  makeUpgrade("orchard_cloud_t2"),
  makeUpgrade("orchard_cloud_t3"),
  makeUpgrade("quantum_grove_t2"),
  makeUpgrade("quantum_grove_t3"),
  // Endgame (T2)
  makeUpgrade("agi_nexus_t2"),
  makeUpgrade("dyson_orchard_t2"),
  makeUpgrade("omega_harvest_t2"),
  makeUpgrade("foundation_model_t2"),
  // Cross-producer synergy upgrades (13)
  makeUpgrade("syn_orchard_sapling"),
  makeUpgrade("syn_compost_seed"),
  makeUpgrade("syn_drone_orchard"),
  makeUpgrade("syn_greenhouse_sapling"),
  makeUpgrade("syn_harvest_compost"),
  makeUpgrade("syn_exchange_drone"),
  makeUpgrade("syn_data_greenhouse"),
  makeUpgrade("syn_attn_harvest"),
  makeUpgrade("syn_pit_exchange"),
  makeUpgrade("syn_gpu_data"),
  makeUpgrade("syn_neural_attn"),
  makeUpgrade("syn_synth_sapling"),
  makeUpgrade("syn_transformer_pit"),
].sort((a, b) => a.cost() - b.cost());
