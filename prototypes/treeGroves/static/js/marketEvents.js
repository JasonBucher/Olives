export const MARKET_EVENT_SETTINGS = {
  checkEverySeconds: 10,
  spawnChance: 0.4,
};

export function getMarketEvents(state, tuning) {
  return [
    {
      id: "busyMarket",
      name: "Busy Market",
      weight: 1,
      cooldownSeconds: 60,
      durationSeconds: 30,
      modifiers: {
        autosellRateMultiplier: 2,
      },
      log: {
        start: "Busy Market: auto-selling accelerates.",
        end: "Busy Market ended.",
      },
    },
    {
      id: "highDemand",
      name: "High Demand",
      weight: 1,
      cooldownSeconds: 60,
      durationSeconds: 30,
      modifiers: {
        priceMultiplier: 1.25,
      },
      ui: {
        suffix: "(+25%)",
      },
      log: {
        start: "High Demand: prices up 25%.",
        end: "High Demand ended.",
      },
    },
    {
      id: "bulkBuyer",
      name: "Bulk Buyer",
      weight: 0.8,
      cooldownSeconds: 45,
      durationSeconds: 0,
      requiresInventory: true,
      action: {
        type: "bulkBuy",
        quantity: 25,
      },
      log: {
        start: "Bulk Buyer arrived.",
        end: "Bulk Buyer departed.",
      },
    },
    {
      id: "cardinal",
      name: "The Cardinal",
      weight: 0.08,
      cooldownSeconds: 300,
      durationSeconds: 0,
      requiresInventory: true,
      action: {
        type: "buyAll",
      },
      log: {
        start: "The Cardinal arrived.",
        end: "The Cardinal departed.",
      },
    },
  ];
}
