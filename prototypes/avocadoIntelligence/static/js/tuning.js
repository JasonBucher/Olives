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
    influencer:    { baseCost: 5,      costGrowth: 1.11, baseRate: 0, clickBonus: 0.1, title: "Avocado Influencer", desc: "Posts reel. Gets clicks. +0.1 click power each." },
    drone:         { baseCost: 1100,   costGrowth: 1.15, baseRate: 8,      title: "Irrigation Drone",   desc: "Flies over. Waters things. Judges you." },
    guac_lab:      { baseCost: 12000,  costGrowth: 1.15, baseRate: 50,     title: "Guacamole Lab",      desc: "Peer-reviewed guac recipes. Consumes avocados to produce guac." },
    guac_refinery: { baseCost: 50000,  costGrowth: 1.15, baseRate: 0,      title: "Guac Refinery",      desc: "Optimizes lab throughput. Each refinery lowers consumption scaling." },
    exchange:      { baseCost: 130000, costGrowth: 1.15, baseRate: 260,    title: "Avocado Exchange",   desc: "Publicly traded pits." },
    pit_miner:     { baseCost: 1.4e6,  costGrowth: 1.15, baseRate: 1400,   title: "Pit Miner",          desc: "Extracting data from pits." },
    neural_pit:    { baseCost: 2e7,    costGrowth: 1.15, baseRate: 7800,   title: "Neural Pit Network", desc: "The pits are thinking." },
    orchard_cloud: { baseCost: 3.3e8,  costGrowth: 1.15, baseRate: 44000,  title: "Orchard Cloud",      desc: "Avocados-as-a-Service. AaaS." },
  },

  guac: {
    baseConsumption: 50,        // base avocado consumption rate per lab
    consumeExponent: 0.85,      // sublinear scaling: consume = base * n^exp
    consumeExponentFloor: 0.5,  // minimum consume exponent (prevents n^0 exploit)
    baseProduction: 1,          // guac produced per lab at base
    produceExponent: 1.0,       // guac output scaling: produce = base * n^exp
    multiplierPerSqrt: 0.10,    // guac multiplier = 1 + sqrt(guac) * this
    labUnlockAps: 50,           // avocados/sec needed to buy guac labs
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
    wisdom_boost:       { cost: 1e6,     unlockAt: 0,  wisdomMult: 0.05,  title: "AGI (Avocado General Intelligence)", desc: "Wisdom bonus +50% more effective" },
    // Guac tuning upgrades
    guac_recycler:      { cost: 50000,   unlockAt: 5,  producerId: "guac_lab", consumeExpDelta: -0.05, title: "Guac Recycler",          desc: "Lab consumption scaling -0.05" },
    bulk_fermentation:  { cost: 200000,  unlockAt: 10, producerId: "guac_lab", consumeExpDelta: -0.05, title: "Bulk Fermentation",       desc: "Lab consumption scaling -0.05 more" },
    superlinear_synth:  { cost: 100000,  guacUnlockAt: 25,  produceExpDelta: +0.05,  title: "Superlinear Synthesis",  desc: "Guac output scaling +0.05" },
    exponential_ripen:  { cost: 500000,  guacUnlockAt: 100, produceExpDelta: +0.10,  title: "Exponential Ripening",   desc: "Guac output scaling +0.10" },
    concentrate_proto:  { cost: 75000,   unlockAt: 10, producerId: "guac_lab", baseProdMult: 1.5, title: "Concentrate Protocol",  desc: "Base guac output x1.5" },
    // Throughput Clicking chain — scales clicks with APS
    throughput_click_1: { cost: 500,   unlockAt: 1,  producerId: "influencer", apsPctPerClick: 0.01, title: "Throughput Clicking I",   desc: "Each click also adds 1% of your APS." },
    throughput_click_2: { cost: 5000,  unlockAt: 5,  producerId: "influencer", requiresUpgrade: "throughput_click_1", apsPctPerClick: 0.02, title: "Throughput Clicking II",  desc: "Each click also adds 2% of your APS." },
    throughput_click_3: { cost: 50000, unlockAt: 25, producerId: "influencer", requiresUpgrade: "throughput_click_2", guacUnlockAt: 50, apsPctPerClick: 0.05, title: "Throughput Clicking III", desc: "Each click also adds 5% of your APS." },
  },

  wisdomUnlocks: {
    guac_memory_1:     { wisdomCost: 3,  title: "Guac Memory I",         desc: "produceExponent +0.02 per prestige completed" },
    guac_memory_2:     { wisdomCost: 10, title: "Guac Memory II",        desc: "consumeExponent -0.01 per prestige completed" },
    infinite_guac:     { wisdomCost: 25, title: "Infinite Guac Theory",  desc: "consumeExponent floor lowered from 0.50 to 0.35" },
  },

  prestige: {
    unlockThreshold: 1e6,         // total avocados this run to unlock prestige
    divisor: 1000,                // wisdom = floor(sqrt(total) / divisor)
    wisdomMultPerPoint: 0.10,     // +10% per wisdom point
  },
};

export const PRODUCER_ORDER = [
  "influencer", "sapling", "orchard_row", "drone", "guac_lab", "guac_refinery",
  "exchange", "pit_miner", "neural_pit", "orchard_cloud",
];
