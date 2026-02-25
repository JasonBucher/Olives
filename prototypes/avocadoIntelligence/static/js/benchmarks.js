// Benchmark (achievement) checker registry.
//
// Each checker takes (state, aps) and returns true if the benchmark is earned.
// `aps` is pre-computed total APS passed in from the game loop to avoid recalculating.

import { TUNING } from "./tuning.js";

export const BENCHMARK_CHECKERS = {
  first_inference:    (state) => state.totalAvocadosAllTime > 0,
  hello_world:        (state, aps) => aps >= 1,
  batch_processing:   (state) => (state.producers.sapling || 0) >= 10,
  overfitting:        (state) => !!state.upgrades.strong_thumb && !!state.upgrades.iron_thumb,
  feature_extraction: (state, aps) => aps >= 100,
  first_epoch:        (state) => {
    let count = 0;
    for (const id of Object.keys(state.producers)) {
      if ((state.producers[id] || 0) >= 5) count++;
    }
    return count >= 3;
  },
  guac_online:        (state) => (state.guacCount || 0) > 0,
  data_pipeline:      (state) => (state.producers.drone || 0) >= 5 && (state.producers.orchard_row || 0) >= 5,
  gradient_descent:   (state, aps) => aps >= 1000,
  attention_is_all:   (state) => (state.producers.attention_head || 0) >= 1,
  loss_convergence:   (state) => (state.guacCount || 0) >= 100,
  singularity:        (state, aps) => aps >= 10000,
  convergence:        (state) => (state.prestigeCount || 0) >= 1,
  fine_tuning:        (state) => (state.prestigeCount || 0) >= 3,
  transfer_learning:  (state) => {
    const unlocks = TUNING.wisdomUnlocks;
    for (const id of Object.keys(unlocks)) {
      if (!state.wisdomUnlocks[id]) return false;
    }
    return true;
  },
  agi_achieved:       (state) => (state.totalWisdomEarned || 0) >= 50,
  superintelligence:  (state, aps) => aps >= 100000,
  paperclip_moment:   (state) => (state.totalAvocadosAllTime || 0) >= 1e9,
};

/** Check all benchmarks, return array of newly-earned IDs. */
export function checkBenchmarks(state, aps) {
  const newlyEarned = [];
  for (const [id, checker] of Object.entries(BENCHMARK_CHECKERS)) {
    if (state.benchmarks[id]) continue; // already earned
    if (checker(state, aps)) {
      newlyEarned.push(id);
    }
  }
  return newlyEarned;
}

/** Benchmark display order (matches tuning config order). */
export const BENCHMARK_ORDER = Object.keys(TUNING.benchmarks);
