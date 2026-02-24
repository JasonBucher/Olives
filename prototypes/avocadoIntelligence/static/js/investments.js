// Investment registry — a flat list of purchasable upgrades / unlocks.
//
// Contract for each entry:
//   {
//     id:          String   — unique key, used in state (e.g. "sharper_pick")
//     title:       String   — display name
//     group:       String   — UI grouping (e.g. "production", "market")
//     cost:        (state, tuning) => Number
//     isUnlocked:  (state, tuning) => Boolean   — visible to player?
//     isOwned:     (state, tuning) => Boolean   — already purchased?
//     canPurchase: (state, tuning) => Boolean   — meets requirements?
//     purchase:    (state, tuning) => void       — mutate state on buy
//     effectLines: (state, tuning) => String[]   — tooltip / description lines
//   }
//
// Repeatable investments use baseCost + level * costScale and track state as `${id}Level`.

import { TUNING } from "./tuning.js";

export const INVESTMENTS = [];
