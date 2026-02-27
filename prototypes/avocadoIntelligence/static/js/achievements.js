// Achievement checker registry.
//
// Each checker takes (state, ctx) and returns true if the achievement is earned.
// `ctx` provides pre-computed values: { aps, guacMult }

import { TUNING } from "./tuning.js";
import * as Calc from "./gameCalc.js";

const SYNERGY_UPGRADE_IDS = Object.entries(TUNING.upgrades)
  .filter(([, cfg]) => cfg.synergyPct)
  .map(([id]) => id);

const ALL_STANDARD_PRODUCERS = [
  "sapling", "seed_bank", "orchard_row", "compost_bin", "drone",
  "greenhouse", "harvest_bot", "exchange", "data_grove", "attention_head", "pit_miner",
  "gpu_cluster", "neural_pit", "synth_orchard", "transformer", "orchard_cloud",
  "quantum_grove", "agi_nexus", "dyson_orchard", "omega_harvest", "foundation_model",
];

const PRODUCERS_UP_TO_PIT_MINER = [
  "sapling", "seed_bank", "orchard_row", "compost_bin", "drone",
  "greenhouse", "harvest_bot", "exchange", "data_grove", "attention_head", "pit_miner",
];

export const ACHIEVEMENT_CHECKERS = {
  // ── 🌱 Seedlings ──
  first_pick:       (state) => (state.totalAvocadosAllTime || 0) > 0,
  hello_world:      (state, ctx) => ctx.aps >= 1,
  batch_processing: (state) => (state.producers.sapling || 0) >= 10,
  first_upgrade:    (state) => Object.values(state.upgrades).filter(Boolean).length >= 1,
  first_epoch:      (state) => {
    let count = 0;
    for (const id of Object.keys(state.producers)) {
      if ((state.producers[id] || 0) >= 5) count++;
    }
    return count >= 3;
  },
  hundred_clicks:   (state) => (state.totalClicksAllTime || 0) >= 100,
  seed_hoarder:     (state) => (state.avocadoCount || 0) >= 10000,
  overfitting:      (state) => !!state.upgrades.strong_thumb && !!state.upgrades.iron_thumb,

  // ── 🏭 Production ──
  feature_extraction: (state, ctx) => ctx.aps >= 100,
  gradient_descent:   (state, ctx) => ctx.aps >= 1000,
  scaling_laws:       (state, ctx) => ctx.aps >= 5000,
  singularity:        (state, ctx) => ctx.aps >= 10000,
  superintelligence:  (state, ctx) => ctx.aps >= 100000,
  million_aps:        (state, ctx) => ctx.aps >= 1000000,
  data_pipeline:      (state) => (state.producers.drone || 0) >= 5 && (state.producers.orchard_row || 0) >= 5,
  deep_network:       (state) => PRODUCERS_UP_TO_PIT_MINER.every(id => (state.producers[id] || 0) >= 1),
  full_stack:         (state) => ALL_STANDARD_PRODUCERS.every(id => (state.producers[id] || 0) >= 1),
  attention_is_all:   (state) => (state.producers.attention_head || 0) >= 1,

  // ── 🥑 Guacamole ──
  guac_online:       (state) => (state.guacCount || 0) > 0,
  loss_convergence:  (state) => (state.guacCount || 0) >= 100,
  guac_reservoir:    (state) => (state.guacCount || 0) >= 1000,
  guac_ocean:        (state) => (state.guacCount || 0) >= 10000,
  guac_universe:     (state) => (state.guacCount || 0) >= 100000,
  refinery_chain:    (state) => (state.producers.guac_refinery || 0) >= 3,
  centrifuge_array:  (state) => (state.producers.guac_centrifuge || 0) >= 3,
  guac_ascendant:    (state, ctx) => (ctx.guacMult || 1) >= 3.0,

  // ── 🔬 Research ──
  five_upgrades:     (state) => Object.values(state.upgrades).filter(Boolean).length >= 5,
  ten_upgrades:      (state) => Object.values(state.upgrades).filter(Boolean).length >= 10,
  twenty_upgrades:   (state) => Object.values(state.upgrades).filter(Boolean).length >= 20,
  forty_upgrades:    (state) => Object.values(state.upgrades).filter(Boolean).length >= 40,
  sixty_upgrades:    (state) => Object.values(state.upgrades).filter(Boolean).length >= 60,
  first_synergy:     (state) => SYNERGY_UPGRADE_IDS.some(id => !!state.upgrades[id]),
  five_synergies:    (state) => SYNERGY_UPGRADE_IDS.filter(id => !!state.upgrades[id]).length >= 5,
  all_synergies:     (state) => SYNERGY_UPGRADE_IDS.every(id => !!state.upgrades[id]),

  // ── ♻️ Prestige ──
  convergence:       (state) => (state.prestigeCount || 0) >= 1,
  fine_tuning:       (state) => (state.prestigeCount || 0) >= 3,
  overfit_prevention:(state) => (state.prestigeCount || 0) >= 5,
  ten_prestiges:     (state) => (state.prestigeCount || 0) >= 10,
  twenty_prestiges:  (state) => (state.prestigeCount || 0) >= 20,
  agi_achieved:      (state) => (state.totalWisdomEarned || 0) >= 50,
  transfer_learning: (state) => {
    const required = ["guac_memory_1", "guac_memory_2", "infinite_guac"];
    return required.every(id => !!state.wisdomUnlocks[id]);
  },
  paperclip_moment:  (state) => (state.totalAvocadosAllTime || 0) >= 1e9,

  // ── 🧬 Distillation ──
  first_distillation: (state) => (state.modelVersion || 0) >= 1,
  architecture_search:(state) => (state.modelVersion || 0) >= 3,
  model_v5:           (state) => (state.modelVersion || 0) >= 5,
  model_v6:           (state) => (state.modelVersion || 0) >= 6,
  double_distill:     (state) => (state.distillationCount || 0) >= 2,
  speed_distill:      (state) => (state.modelVersion || 0) >= 1 && (state.prestigeCount || 0) <= 4,

  // ── 🎁 Gifts ──
  first_gift:        (state) => (state.totalGiftsOpened || 0) >= 1,
  five_gifts:        (state) => (state.totalGiftsOpened || 0) >= 5,
  twenty_gifts:      (state) => (state.totalGiftsOpened || 0) >= 20,
  fifty_gifts:       (state) => (state.totalGiftsOpened || 0) >= 50,
  hundred_gifts:     (state) => (state.totalGiftsOpened || 0) >= 100,
  got_frenzy:        (state) => !!(state.giftEffectsSeen && state.giftEffectsSeen.click_boost),
  wisdom_gift:       (state) => !!(state.giftEffectsSeen && state.giftEffectsSeen.wisdom_grant),

  // ── 🏋️ Training ──
  first_regimen:     (state) => (state.activeRegimens || []).length >= 1,
  dual_regimen:      (state) => (state.activeRegimens || []).length >= 2,
  all_regimens_tried:(state) => {
    const unlocks = ["click_specialization", "scale_specialization", "guac_specialization"];
    return unlocks.every(id => !!state.wisdomUnlocks[id]);
  },
  persistent_full:   (state) => (state.persistentUpgrades || []).length >= 3,

  // ── 📈 Scaling ──
  trillion_alltime:     (state) => (state.totalAvocadosAllTime || 0) >= 1e12,
  quadrillion_alltime:  (state) => (state.totalAvocadosAllTime || 0) >= 1e15,
  sapling_army:         (state) => (state.producers.sapling || 0) >= 50,
  hundred_producers:    (state) => Object.values(state.producers).some(c => c >= 100),
  thousand_clicks:      (state) => (state.totalClicksAllTime || 0) >= 1000,
  ten_thousand_clicks:  (state) => (state.totalClicksAllTime || 0) >= 10000,
  wisdom_50:            (state) => (state.totalWisdomEarned || 0) >= 50,
  wisdom_200:           (state) => (state.totalWisdomEarned || 0) >= 200,

  // ── ✨ Quirky ──
  night_owl:         () => { const h = new Date().getHours(); return h >= 0 && h < 5; },
  sunset_theme:      () => { const h = new Date().getHours(); return h >= 17 && h < 19; },
  matrix_theme:      (state) => {
    let types = 0;
    for (const id of Object.keys(state.producers)) {
      if ((state.producers[id] || 0) >= 1) types++;
    }
    return types >= 10;
  },
  speed_demon:       (state, ctx) => ctx.aps >= 50000,
  click_frenzy_100:  (state) => !!(state._clickFrenzyTriggered),
  patient_zero:      (state) => !!(state._idleAchievementTriggered),
  secret_konami:     (state) => !!(state._konamiTriggered),
  dedication:        (state) => (state.prestigeCount || 0) >= 5 &&
    Object.values(state.upgrades).filter(Boolean).length >= 10 &&
    (state.totalAvocadosAllTime || 0) >= 1e8,
};

/** Check all achievements, return array of newly-earned IDs. */
export function checkAchievements(state, ctx) {
  const newlyEarned = [];
  for (const [id, checker] of Object.entries(ACHIEVEMENT_CHECKERS)) {
    if (state.achievements[id]) continue; // already earned
    if (checker(state, ctx)) {
      newlyEarned.push(id);
    }
  }
  return newlyEarned;
}

/** Achievement display order (matches tuning config order). */
export const ACHIEVEMENT_ORDER = Object.keys(TUNING.achievements);
