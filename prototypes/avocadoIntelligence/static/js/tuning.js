// Centralized tuning constants for Avocado Intelligence.
// Rule: zero hardcoded game numbers elsewhere. Every balance-relevant
// value lives here so you can tweak the feel in one place.

export const TUNING = {
  production: {
    baseClickYield: 1,   // avocados per click
    tickMs: 200,          // main loop interval
  },

  producers: {
    sapling:       { baseCost: 10,     costGrowth: 1.15, baseRate: 0.2,    title: "Avocado Sapling",    desc: "A tiny tree. Dreams of guac." },
    orchard_row:   { baseCost: 100,    costGrowth: 1.15, baseRate: 1,      title: "Orchard Row",        desc: "Now we're farming." },
    drone:         { baseCost: 1100,   costGrowth: 1.15, baseRate: 8,      title: "Irrigation Drone",   desc: "Flies over. Waters things. Judges you." },
    guac_lab:      { baseCost: 12000,  costGrowth: 1.15, baseRate: 47,     title: "Guacamole Lab",      desc: "Peer-reviewed guac recipes." },
    exchange:      { baseCost: 130000, costGrowth: 1.15, baseRate: 260,    title: "Avocado Exchange",   desc: "Publicly traded pits." },
    pit_miner:     { baseCost: 1.4e6,  costGrowth: 1.15, baseRate: 1400,   title: "Pit Miner",          desc: "Extracting data from pits." },
    neural_pit:    { baseCost: 2e7,    costGrowth: 1.15, baseRate: 7800,   title: "Neural Pit Network", desc: "The pits are thinking." },
    orchard_cloud: { baseCost: 3.3e8,  costGrowth: 1.15, baseRate: 44000,  title: "Orchard Cloud",      desc: "Avocados-as-a-Service. AaaS." },
  },

  guac: {
    avocadosPerGuac: 100,    // conversion ratio
    labConversionRate: 0.5,  // guac/sec per guac_lab owned
  },

  upgrades: {
    strong_thumb:       { cost: 100,     unlockAt: 0,  clickMult: 2,   title: "Strong Thumb",         desc: "Seed Capital: 2x click power" },
    iron_thumb:         { cost: 500,     unlockAt: 0,  clickMult: 2,   title: "Iron Thumb",           desc: "Series A(vocado): another 2x clicking" },
    efficient_saplings: { cost: 1000,    unlockAt: 10, producerId: "sapling",     prodMult: 2, title: "Ripeness Algorithms v1", desc: "Saplings produce 2x" },
    drip_irrigation:    { cost: 5000,    unlockAt: 5,  producerId: "orchard_row", prodMult: 2, title: "Drip Irrigation",        desc: "Orchard Rows produce 2x" },
    drone_swarm:        { cost: 50000,   unlockAt: 5,  producerId: "drone",       prodMult: 2, title: "Guac GPUs",              desc: "Drones produce 2x" },
    lab_coats:          { cost: 200000,  unlockAt: 5,  producerId: "guac_lab",    prodMult: 2, title: "Lab Coats",              desc: "Guac Labs produce 2x" },
    global_boost_1:     { cost: 10000,   unlockAt: 0,  globalMult: 1.5, title: "Orchard-as-a-Service", desc: "All production +50%" },
    global_boost_2:     { cost: 500000,  unlockAt: 0,  globalMult: 2,   title: "Pit-to-Cloud Pipeline", desc: "All production 2x" },
    guac_unlock:        { cost: 5000,    unlockAt: 0,  unlocksGuac: true, title: "Guacamole Protocol",  desc: "Unlocks guac processing" },
    wisdom_boost:       { cost: 1e6,     unlockAt: 0,  wisdomMult: 0.5,  title: "AGI (Avocado General Intelligence)", desc: "Wisdom bonus +50% more effective" },
  },

  prestige: {
    unlockThreshold: 1e6,      // total avocados this run
    wisdomDivisor: 1e6,        // wisdom = floor((total/divisor)^exp)
    wisdomExponent: 0.5,       // sqrt scaling
    wisdomMultPerPoint: 0.02,  // +2% per wisdom point
  },
};

export const PRODUCER_ORDER = [
  "sapling", "orchard_row", "drone", "guac_lab",
  "exchange", "pit_miner", "neural_pit", "orchard_cloud",
];
