// Investment registry — a flat list of purchasable upgrades / unlocks.
//
// Contract for each entry:
//   {
//     id:          String   — unique key, used in state (e.g. "sharper_pick")
//     title:       String   — display name
//     group:       String   — UI grouping (e.g. "production", "market")
//     cost:        (state, tuning, calc) => Number
//     isUnlocked:  (state, tuning) => Boolean   — visible to player?
//     isOwned:     (state, tuning) => Boolean   — already purchased / maxed?
//     canPurchase: (state, tuning, calc) => Boolean   — meets requirements?
//     purchase:    (state, tuning, calc) => void       — mutate state on buy
//     effectLines: (state, tuning) => String[]   — tooltip / description lines
//   }
//
// Repeatable investments use baseCost + level * costScale and track state as `${id}Level`.

const sharperPick = {
  id: "sharper_pick",
  title: "Sharper Pick",
  group: "production",
  cost: (_state, tuning) => tuning.investments.sharperPickCost,
  isUnlocked: (state, tuning) => state.oliveCount >= tuning.investments.sharperPickUnlockOlives || state.sharperPickOwned,
  isOwned: (state) => !!state.sharperPickOwned,
  canPurchase: (state, tuning, calc) => !sharperPick.isOwned(state, tuning, calc) && state.oliveCount >= sharperPick.cost(state, tuning, calc),
  purchase: (state, tuning, calc) => {
    state.oliveCount -= sharperPick.cost(state, tuning, calc);
    state.sharperPickOwned = true;
  },
  effectLines: () => ["+1 olive per click"],
};

const biggerBaskets = {
  id: "bigger_baskets",
  title: "Bigger Baskets",
  group: "production",
  cost: (state, tuning, calc) => calc.getScaledCost(
    tuning.investments.biggerBasketBaseCost,
    state.biggerBasketsLevel,
    tuning.investments.biggerBasketCostScale,
  ),
  isUnlocked: (state, tuning) => state.oliveCount >= tuning.investments.biggerBasketUnlockOlives || state.biggerBasketsLevel > 0,
  isOwned: () => false,
  canPurchase: (state, tuning, calc) => state.oliveCount >= biggerBaskets.cost(state, tuning, calc),
  purchase: (state, tuning, calc) => {
    state.oliveCount -= biggerBaskets.cost(state, tuning, calc);
    state.biggerBasketsLevel += 1;
  },
  effectLines: (state, tuning) => [
    `Level ${state.biggerBasketsLevel}`,
    `+${tuning.production.basketBonusPerLevel} olive/click per level`,
  ],
};

const marketStall = {
  id: "market_stall",
  title: "Market Stall License",
  group: "market",
  cost: (_state, tuning) => tuning.investments.marketStallCost,
  isUnlocked: (state, tuning) => state.florinCount >= tuning.investments.marketStallUnlockFlorins || state.marketStallOwned,
  isOwned: (state) => !!state.marketStallOwned,
  canPurchase: (state, tuning, calc) => !marketStall.isOwned(state, tuning, calc) && state.florinCount >= marketStall.cost(state, tuning, calc),
  purchase: (state, tuning, calc) => {
    state.florinCount -= marketStall.cost(state, tuning, calc);
    state.marketStallOwned = true;
  },
  effectLines: (state, tuning) => [
    `Oil sell value x${tuning.market.stallBonusMultiplier}`,
    state.marketStallOwned ? "Owned" : "One-time market investment",
  ],
};

export const INVESTMENTS = [sharperPick, biggerBaskets, marketStall];
