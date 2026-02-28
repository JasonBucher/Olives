// Centralized tuning constants for Avocado Intelligence.
// Rule: zero hardcoded game numbers elsewhere. Every balance-relevant
// value lives here so you can tweak the feel in one place.

export const TUNING = {
  production: {
    baseClickYield: 1,   // avocados per click
    tickMs: 200,          // main loop interval
  },

  producers: {
    sapling:          { baseCost: 15,       costGrowth: 1.15, baseRate: 0.1,      title: "Avocado Sapling",    desc: "A tiny tree. Dreams of guac." },
    seed_bank:        { baseCost: 100,      costGrowth: 1.15, baseRate: 0.8,      title: "Seed Bank",          desc: "Stores genetic potential. Grows interest." },
    orchard_row:      { baseCost: 1100,     costGrowth: 1.15, baseRate: 8,        title: "Orchard Row",        desc: "Now we're farming." },
    compost_bin:      { baseCost: 12000,    costGrowth: 1.15, baseRate: 47,       title: "Compost Bin",        desc: "Garbage in, fertilizer out. Nature's neural net." },
    drone:            { baseCost: 130000,   costGrowth: 1.15, baseRate: 260,      title: "Irrigation Drone",   desc: "Flies over. Waters things. Judges you." },
    greenhouse:       { baseCost: 1.4e6,    costGrowth: 1.15, baseRate: 1400,     title: "Greenhouse",         desc: "Controlled environment. Uncontrolled ambitions." },
    harvest_bot:      { baseCost: 20e6,     costGrowth: 1.15, baseRate: 7800,     title: "Harvest Bot",        desc: "Picks faster than you. Doesn't need lunch." },
    guac_lab:         { baseCost: 50000,  costGrowth: 1.15, baseRate: 50,     title: "Guacamole Lab",      desc: "Peer-reviewed guac recipes. Consumes avocados to produce guac." },
    guac_refinery:    { baseCost: 150000, costGrowth: 1.15, baseRate: 0,      title: "Guac Refinery",      desc: "Optimizes lab throughput. Each refinery lowers consumption scaling.", requiresWisdomUnlock: "unlock_refinery" },
    guac_centrifuge:  { baseCost: 500000, costGrowth: 1.15, baseRate: 0,      title: "Guac Centrifuge",    desc: "Spins faster. Separates more. Consumes less.", requiresWisdomUnlock: "unlock_centrifuge" },
    exchange:         { baseCost: 280e6,   costGrowth: 1.15, baseRate: 44000,    title: "Avocado Exchange",   desc: "Publicly traded pits." },
    data_grove:       { baseCost: 3.9e9,   costGrowth: 1.15, baseRate: 260000,  title: "Data Grove",         desc: "Every tree is a data point. The forest is the model." },
    attention_head:   { baseCost: 55e9,    costGrowth: 1.15, baseRate: 1.6e6,   title: "Attention Head",     desc: "Focuses on the ripe ones. All others are masked." },
    pit_miner:        { baseCost: 830e9,   costGrowth: 1.15, baseRate: 10e6,    title: "Pit Miner",          desc: "Extracting data from pits." },
    gpu_cluster:      { baseCost: 12e12,   costGrowth: 1.15, baseRate: 65e6,    title: "GPU Cluster",        desc: "Training on avocado data. 8xH100s. Still not enough.", minPrestigeCount: 2 },
    neural_pit:       { baseCost: 180e12,  costGrowth: 1.15, baseRate: 430e6,   title: "Neural Pit Network", desc: "The pits are thinking." },
    synth_orchard:    { baseCost: 2.9e15,  costGrowth: 1.15, baseRate: 2.9e9,   title: "Synthetic Orchard",  desc: "Lab-grown trees. Real avocados. Nobody can tell.", minPrestigeCount: 4 },
    transformer:      { baseCost: 46e15,   costGrowth: 1.15, baseRate: 21e9,    title: "Transformer Core",   desc: "Self-attention over the entire orchard. Context window: unlimited avocados." },
    orchard_cloud:    { baseCost: 780e15,  costGrowth: 1.15, baseRate: 150e9,   title: "Orchard Cloud",      desc: "Avocados-as-a-Service. AaaS." },
    quantum_grove:    { baseCost: 14e18,   costGrowth: 1.15, baseRate: 1.1e12,  title: "Quantum Grove",      desc: "The avocados exist in superposition until picked.", minPrestigeCount: 7 },
    agi_nexus:        { baseCost: 290e18,  costGrowth: 1.15, baseRate: 8.3e12,  title: "AGI Nexus",          desc: "It understands avocados. Truly understands them.", minPrestigeCount: 10 },
    dyson_orchard:    { baseCost: 7.3e21,  costGrowth: 1.15, baseRate: 64e12,   title: "Dyson Orchard",      desc: "Harvesting the energy of a star. For avocados.", minPrestigeCount: 14 },
    omega_harvest:    { baseCost: 210e21,  costGrowth: 1.15, baseRate: 510e12,  title: "Omega Harvest",      desc: "The final harvest. Or is it?", minPrestigeCount: 18 },
    foundation_model: { baseCost: 1.5e21,  costGrowth: 1.15, baseRate: 8.3e12,  title: "Foundation Model",   desc: "It learned everything. From avocados. Somehow that was enough." },
  },

  // Global producer milestones — free multipliers at owned-count thresholds.
  // Layered on top of tiered upgrade multipliers (which cost avocados).
  milestones: [
    { count: 10,  mult: 1.5 },
    { count: 25,  mult: 2 },
    { count: 50,  mult: 2 },
    { count: 75,  mult: 2 },
    { count: 100, mult: 3 },
    { count: 150, mult: 3 },
    { count: 200, mult: 4 },
    { count: 250, mult: 5 },
  ],

  guac: {
    baseConsumption: 200,       // base avocado consumption rate per lab
    consumeExponent: 0.85,      // sublinear scaling: consume = base * n^exp
    consumeExponentFloor: 0.70, // minimum consume exponent (prevents n^0 exploit)
    baseProduction: 1,          // guac produced per lab at base
    produceExponent: 1.0,       // guac output scaling: produce = base * n^exp
    multiplierCoeff: 0.03,      // controls ramp speed of asymptotic guac multiplier
    guacMultCap: 8.0,           // asymptotic cap for guac multiplier (never quite reached)
    guacMaintenanceRate: 0.5,   // avo/sec consumed per unit of guac held (maintenance cost)
    labUnlockAps: 50,           // avocados/sec needed to buy guac labs
  },

  upgrades: {
    strong_thumb:       { cost: 100,     unlockAt: 0,  clickMult: 2,   title: "Strong Thumb",         desc: "Seed Capital: 2x click power" },
    iron_thumb:         { cost: 500,     unlockAt: 0,  clickMult: 2,   title: "Iron Thumb",           desc: "Series A(vocado): another 2x clicking" },
    efficient_saplings: { cost: 40,      unlockAt: 5,  producerId: "sapling",     prodMult: 2, title: "Ripeness Algorithms v1", desc: "Saplings produce 2x" },
    drip_irrigation:    { cost: 1540,    unlockAt: 5,  producerId: "orchard_row", prodMult: 2, title: "Drip Irrigation",        desc: "Orchard Rows produce 2x" },
    drone_swarm:        { cost: 182000,  unlockAt: 5,  producerId: "drone",       prodMult: 2, title: "Guac GPUs",              desc: "Drones produce 2x" },
    lab_coats:          { cost: 500000,  unlockAt: 5,  producerId: "guac_lab",    prodMult: 2, title: "Lab Coats",              desc: "Guac Labs produce 2x", requiresWisdomUnlock: "unlock_lab_coats" },
    global_boost_1:     { cost: 10000,   unlockAt: 0,  globalMult: 1.5, title: "Orchard-as-a-Service", desc: "All production +50%" },
    global_boost_2:     { cost: 500000,  unlockAt: 0,  globalMult: 2,   title: "Pit-to-Cloud Pipeline", desc: "All production 2x" },
    guac_unlock:        { cost: 25000,   unlockAt: 0,  unlocksGuac: true, title: "Guacamole Protocol",  desc: "Unlocks guac processing", deprecated: true },
    wisdom_boost:       { cost: 1e6,     unlockAt: 0,  wisdomMult: 0.05,  minPrestigeCount: 1, title: "AGI (Avocado General Intelligence)", desc: "Wisdom bonus +50% more effective", deprecated: true },
    // Guac tuning upgrades
    guac_recycler:      { cost: 120000,  unlockAt: 5,  producerId: "guac_lab", consumeExpDelta: -0.05, title: "Guac Recycler",          desc: "Lab consumption scaling -0.05", requiresWisdomUnlock: "unlock_guac_recycler" },
    bulk_fermentation:  { cost: 200000,  unlockAt: 10, producerId: "guac_lab", consumeExpDelta: -0.05, title: "Bulk Fermentation",       desc: "Lab consumption scaling -0.05 more", requiresWisdomUnlock: "unlock_bulk_fermentation" },
    superlinear_synth:  { cost: 100000,  guacUnlockAt: 25,  produceExpDelta: +0.05,  title: "Superlinear Synthesis",  desc: "Guac output scaling +0.05", requiresWisdomUnlock: "unlock_superlinear_synth" },
    exponential_ripen:  { cost: 500000,  guacUnlockAt: 100, produceExpDelta: +0.10,  title: "Exponential Ripening",   desc: "Guac output scaling +0.10", requiresWisdomUnlock: "unlock_exponential_ripen" },
    concentrate_proto:  { cost: 200000,  unlockAt: 10, producerId: "guac_lab", baseProdMult: 1.5, title: "Concentrate Protocol",  desc: "Base guac output x1.5", requiresWisdomUnlock: "unlock_concentrate_proto" },
    // Throughput Clicking chain — scales clicks with base APS (before multipliers)
    throughput_click_1: { cost: 500,     apsUnlockAt: 1,     apsPctPerClick: 0.05, title: "Throughput Clicking I",   desc: "Each click also adds 5% of your base APS." },
    throughput_click_2: { cost: 5000,   apsUnlockAt: 10,   requiresUpgrade: "throughput_click_1", apsPctPerClick: 0.10, title: "Throughput Clicking II",  desc: "Each click also adds 10% of your base APS." },
    throughput_click_3: { cost: 50000,  apsUnlockAt: 100,  requiresUpgrade: "throughput_click_2", guacUnlockAt: 50, apsPctPerClick: 0.15, title: "Throughput Clicking III", desc: "Each click also adds 15% of your base APS." },
    throughput_click_4: { cost: 500000, apsUnlockAt: 1000, requiresUpgrade: "throughput_click_3", apsPctPerClick: 0.20, title: "Throughput Clicking IV",  desc: "Each click also adds 20% of your base APS." },
    throughput_click_5: { cost: 5000000, apsUnlockAt: 10000, requiresUpgrade: "throughput_click_4", apsPctPerClick: 0.25, title: "Throughput Clicking V", desc: "Each click also adds 25% of your base APS." },
    dark_pool:         { cost: 392e6,        unlockAt: 5,  producerId: "exchange",       prodMult: 2, title: "Dark Pool Access",       desc: "Avocado Exchanges produce 2x" },
    pit_optimization:  { cost: 1.16e12,      unlockAt: 5,  producerId: "pit_miner",      prodMult: 2, title: "Pit Optimization",       desc: "Pit Miners produce 2x" },
    attention_focus:   { cost: 77e9,         unlockAt: 5,  producerId: "attention_head", prodMult: 2, title: "Multi-Head Attention",  desc: "Attention Heads produce 2x" },
    transformer_scale: { cost: 64.4e15,      unlockAt: 5,  producerId: "transformer",    prodMult: 2, title: "Scaling Laws",          desc: "Transformer Cores produce 2x" },
    // New producer upgrades
    seed_catalog:      { cost: 140,          unlockAt: 5,  producerId: "seed_bank",   prodMult: 2, title: "Seed Catalog",       desc: "Seed Banks produce 2x" },
    hot_compost:       { cost: 16800,        unlockAt: 5,  producerId: "compost_bin", prodMult: 2, title: "Hot Composting",      desc: "Compost Bins produce 2x" },
    climate_control:   { cost: 1.96e6,       unlockAt: 5,  producerId: "greenhouse",  prodMult: 2, title: "Climate Control",     desc: "Greenhouses produce 2x" },
    harvest_fleet:     { cost: 28e6,         unlockAt: 5,  producerId: "harvest_bot", prodMult: 2, title: "Harvest Fleet",       desc: "Harvest Bots produce 2x" },
    data_lake:         { cost: 5.46e9,       unlockAt: 5,  producerId: "data_grove",  prodMult: 2, title: "Data Lake",           desc: "Data Groves produce 2x" },
    gpu_overclock:     { cost: 16.8e12,      unlockAt: 5,  producerId: "gpu_cluster", prodMult: 2, title: "GPU Overclocking",    desc: "GPU Clusters produce 2x" },
    neural_backprop:   { cost: 252e12,       unlockAt: 5,  producerId: "neural_pit",      prodMult: 2, title: "Backpropagation",            desc: "Neural Pit Networks produce 2x" },
    synth_genome:      { cost: 4.06e15,      unlockAt: 5,  producerId: "synth_orchard",   prodMult: 2, title: "Genetic Algorithm",           desc: "Synthetic Orchards produce 2x" },
    catalytic_convert: { cost: 400000,  unlockAt: 3,  producerId: "guac_refinery",   consumeExpDelta: -0.05, title: "Catalytic Converter", desc: "Consumption scaling -0.05", requiresWisdomUnlock: "unlock_catalytic_convert" },
    ultracentrifuge:   { cost: 900000,  unlockAt: 3,  producerId: "guac_centrifuge", produceExpDelta: +0.05, title: "Ultracentrifuge",      desc: "Guac output scaling +0.05", requiresWisdomUnlock: "unlock_ultracentrifuge" },
    cloud_autoscale:   { cost: 1.09e18,      unlockAt: 5,  producerId: "orchard_cloud",   prodMult: 2, title: "Auto-Scaling",                desc: "Orchard Clouds produce 2x" },
    quantum_annealing: { cost: 19.6e18,      unlockAt: 5,  producerId: "quantum_grove",   prodMult: 2, title: "Quantum Annealing",           desc: "Quantum Groves produce 2x" },
    recursive_improve: { cost: 406e18,       unlockAt: 5,  producerId: "agi_nexus",       prodMult: 2, title: "Recursive Self-Improvement",  desc: "AGI Nexuses produce 2x" },
    emergent_caps:     { cost: 2.1e21,       unlockAt: 5,  producerId: "foundation_model", prodMult: 2, title: "Emergent Capabilities",      desc: "Foundation Models produce 2x" },
    stellar_engineer:  { cost: 10.2e21,      unlockAt: 5,  producerId: "dyson_orchard",   prodMult: 2, title: "Stellar Engineering",         desc: "Dyson Orchards produce 2x" },
    heat_death_opt:    { cost: 294e21,       unlockAt: 5,  producerId: "omega_harvest",   prodMult: 2, title: "Heat Death Optimization",     desc: "Omega Harvests produce 2x" },
    global_boost_3:    { cost: 5e7,     unlockAt: 0,  globalMult: 2, title: "Distributed Training", desc: "All production 2x" },

    // ── Cross-Producer Synergy Upgrades ──────────────────────────
    // Later "source" producer boosts earlier "target" by X% per source unit owned.
    // Gate: sourceReq of source producer AND targetReq of target producer.
    // Sapling is the "hub" target — 3 different sources boost it.
    syn_orchard_sapling:    { cost: 5000,     synergySource: "orchard_row",    synergyTarget: "sapling",        synergyPct: 0.05, sourceReq: 5,  targetReq: 10, title: "Root Network Protocol",          desc: "Each Orchard Row optimizes Sapling output by +5%" },
    syn_compost_seed:       { cost: 50000,    synergySource: "compost_bin",    synergyTarget: "seed_bank",      synergyPct: 0.05, sourceReq: 3,  targetReq: 5,  title: "Organic Data Pipeline",          desc: "Each Compost Bin enriches Seed Bank output by +5%" },
    syn_drone_orchard:      { cost: 500000,   synergySource: "drone",          synergyTarget: "orchard_row",    synergyPct: 0.04, sourceReq: 3,  targetReq: 5,  title: "Aerial Feature Mapping",         desc: "Each Drone maps Orchard Row output by +4%" },
    syn_greenhouse_sapling: { cost: 5e6,      synergySource: "greenhouse",     synergyTarget: "sapling",        synergyPct: 0.04, sourceReq: 1,  targetReq: 10, title: "Controlled Growth Parameters",   desc: "Each Greenhouse nurtures Sapling output by +4%" },
    syn_harvest_compost:    { cost: 70e6,     synergySource: "harvest_bot",    synergyTarget: "compost_bin",    synergyPct: 0.03, sourceReq: 1,  targetReq: 5,  title: "Feedback Recycling",             desc: "Each Harvest Bot feeds Compost Bin output by +3%" },
    syn_exchange_drone:     { cost: 1e9,      synergySource: "exchange",       synergyTarget: "drone",          synergyPct: 0.03, sourceReq: 1,  targetReq: 5,  title: "Market-Driven Routing",          desc: "Each Exchange optimizes Drone output by +3%" },
    syn_data_greenhouse:    { cost: 14e9,     synergySource: "data_grove",     synergyTarget: "greenhouse",     synergyPct: 0.02, sourceReq: 1,  targetReq: 3,  title: "Environmental Model Training",   desc: "Each Data Grove improves Greenhouse output by +2%" },
    syn_attn_harvest:       { cost: 200e9,    synergySource: "attention_head", synergyTarget: "harvest_bot",    synergyPct: 0.02, sourceReq: 1,  targetReq: 5,  title: "Attention-Guided Harvesting",    desc: "Each Attention Head focuses Harvest Bot output by +2%" },
    syn_pit_exchange:       { cost: 3e12,     synergySource: "pit_miner",      synergyTarget: "exchange",       synergyPct: 0.02, sourceReq: 1,  targetReq: 3,  title: "Derivative Extraction",          desc: "Each Pit Miner yields Exchange output by +2%" },
    syn_gpu_data:           { cost: 40e12,    synergySource: "gpu_cluster",    synergyTarget: "data_grove",     synergyPct: 0.02, sourceReq: 1,  targetReq: 3,  title: "Accelerated Analytics",          desc: "Each GPU Cluster boosts Data Grove output by +2%" },
    syn_neural_attn:        { cost: 600e12,   synergySource: "neural_pit",     synergyTarget: "attention_head", synergyPct: 0.02, sourceReq: 1,  targetReq: 3,  title: "Deep Attention Networks",        desc: "Each Neural Pit amplifies Attention Head output by +2%" },
    syn_synth_sapling:      { cost: 10e15,    synergySource: "synth_orchard",  synergyTarget: "sapling",        synergyPct: 0.02, sourceReq: 1,  targetReq: 15, title: "Synthetic Growth Factors",       desc: "Each Synthetic Orchard enhances Sapling output by +2%" },
    syn_transformer_pit:    { cost: 150e15,   synergySource: "transformer",    synergyTarget: "pit_miner",      synergyPct: 0.01, sourceReq: 1,  targetReq: 3,  title: "Embedding Extraction",           desc: "Each Transformer Core optimizes Pit Miner output by +1%" },

    // ── Multi-Tier Producer Upgrades ──────────────────────────────
    // cost = floor(baseCost × tierK × 1.15^threshold)
    // tierK: T2=5, T3=10, T4=15, T5=20

    // Early producers (T2–T5): sapling, seed_bank, orchard_row, compost_bin, drone, greenhouse
    sapling_t2:        { cost: 1646,               unlockAt: 25,  producerId: "sapling",      prodMult: 2, title: "Ripeness Algorithms v2",    desc: "Saplings produce 2x" },
    sapling_t3:        { cost: 108366,              unlockAt: 50,  producerId: "sapling",      prodMult: 2, title: "Root Network Protocol",     desc: "Saplings produce 2x (cumulative 8x)" },
    sapling_t4:        { cost: 176147018,           unlockAt: 100, producerId: "sapling",      prodMult: 2, title: "Photosynthesis Overclocking", desc: "Saplings produce 2x (cumulative 16x)" },
    sapling_t5:        { cost: 254510701921,        unlockAt: 150, producerId: "sapling",      prodMult: 2, title: "Arboreal Neural Mesh",      desc: "Saplings produce 2x (cumulative 32x)" },
    seed_bank_t2:      { cost: 5761,                unlockAt: 25,  producerId: "seed_bank",    prodMult: 2, title: "Genome Indexer",             desc: "Seed Banks produce 2x" },
    seed_bank_t3:      { cost: 379280,              unlockAt: 50,  producerId: "seed_bank",    prodMult: 2, title: "CRISPR Seed Editor",         desc: "Seed Banks produce 2x (cumulative 8x)" },
    seed_bank_t4:      { cost: 616514562,           unlockAt: 100, producerId: "seed_bank",    prodMult: 2, title: "Synthetic Germplasm",        desc: "Seed Banks produce 2x (cumulative 16x)" },
    seed_bank_t5:      { cost: 890787456722,        unlockAt: 150, producerId: "seed_bank",    prodMult: 2, title: "Infinite Seed Theorem",      desc: "Seed Banks produce 2x (cumulative 32x)" },
    orchard_row_t2:    { cost: 16459,               unlockAt: 25,  producerId: "orchard_row",  prodMult: 2, title: "Precision Pruning",          desc: "Orchard Rows produce 2x" },
    orchard_row_t3:    { cost: 1083657,             unlockAt: 50,  producerId: "orchard_row",  prodMult: 2, title: "Autonomous Row Management",  desc: "Orchard Rows produce 2x (cumulative 8x)" },
    orchard_row_t4:    { cost: 1761470176,          unlockAt: 100, producerId: "orchard_row",  prodMult: 2, title: "Fractal Planting Patterns",  desc: "Orchard Rows produce 2x (cumulative 16x)" },
    orchard_row_t5:    { cost: 2545107019207,       unlockAt: 150, producerId: "orchard_row",  prodMult: 2, title: "Infinite Orchard Hypothesis", desc: "Orchard Rows produce 2x (cumulative 32x)" },
    compost_bin_t2:    { cost: 65838,               unlockAt: 25,  producerId: "compost_bin",  prodMult: 2, title: "Thermophilic Optimization",  desc: "Compost Bins produce 2x" },
    compost_bin_t3:    { cost: 4334630,             unlockAt: 50,  producerId: "compost_bin",  prodMult: 2, title: "Microbial Ensemble Learning", desc: "Compost Bins produce 2x (cumulative 8x)" },
    compost_bin_t4:    { cost: 7045880704,          unlockAt: 100, producerId: "compost_bin",  prodMult: 2, title: "Zero-Waste Inference",       desc: "Compost Bins produce 2x (cumulative 16x)" },
    compost_bin_t5:    { cost: 10180428076828,      unlockAt: 150, producerId: "compost_bin",  prodMult: 2, title: "Entropy Reversal Engine",    desc: "Compost Bins produce 2x (cumulative 32x)" },
    drone_t2:          { cost: 181054,              unlockAt: 25,  producerId: "drone",        prodMult: 2, title: "Swarm Intelligence",         desc: "Drones produce 2x" },
    drone_t3:          { cost: 11920232,            unlockAt: 50,  producerId: "drone",        prodMult: 2, title: "Formation Flying Protocol",  desc: "Drones produce 2x (cumulative 8x)" },
    drone_t4:          { cost: 19376171937,         unlockAt: 100, producerId: "drone",        prodMult: 2, title: "Drone Hivemind",             desc: "Drones produce 2x (cumulative 16x)" },
    drone_t5:          { cost: 27996177211277,      unlockAt: 150, producerId: "drone",        prodMult: 2, title: "Autonomous Airspace Control", desc: "Drones produce 2x (cumulative 32x)" },
    greenhouse_t2:     { cost: 658379,              unlockAt: 25,  producerId: "greenhouse",   prodMult: 2, title: "Spectral Light Tuning",      desc: "Greenhouses produce 2x" },
    greenhouse_t3:     { cost: 43346298,            unlockAt: 50,  producerId: "greenhouse",   prodMult: 2, title: "Atmospheric Gradient Descent", desc: "Greenhouses produce 2x (cumulative 8x)" },
    greenhouse_t4:     { cost: 70458807042,         unlockAt: 100, producerId: "greenhouse",   prodMult: 2, title: "Biome Simulation Engine",    desc: "Greenhouses produce 2x (cumulative 16x)" },
    greenhouse_t5:     { cost: 101804280768279,     unlockAt: 150, producerId: "greenhouse",   prodMult: 2, title: "Pocket Dimension Agriculture", desc: "Greenhouses produce 2x (cumulative 32x)" },

    // Mid producers (T2–T4): harvest_bot, exchange, data_grove, attention_head, pit_miner
    harvest_bot_t2:    { cost: 7406764,             unlockAt: 25,  producerId: "harvest_bot",    prodMult: 2, title: "Reinforcement Harvesting",  desc: "Harvest Bots produce 2x" },
    harvest_bot_t3:    { cost: 487645849,           unlockAt: 50,  producerId: "harvest_bot",    prodMult: 2, title: "Predictive Ripeness Model",  desc: "Harvest Bots produce 2x (cumulative 8x)" },
    harvest_bot_t4:    { cost: 792661579223,        unlockAt: 100, producerId: "harvest_bot",    prodMult: 2, title: "Self-Replicating Harvesters", desc: "Harvest Bots produce 2x (cumulative 16x)" },
    exchange_t2:       { cost: 21397319,            unlockAt: 25,  producerId: "exchange",       prodMult: 2, title: "High-Frequency Pit Trading", desc: "Exchanges produce 2x" },
    exchange_t3:       { cost: 1408754674,          unlockAt: 50,  producerId: "exchange",       prodMult: 2, title: "Derivatives Market",         desc: "Exchanges produce 2x (cumulative 8x)" },
    exchange_t4:       { cost: 2289911228866,       unlockAt: 100, producerId: "exchange",       prodMult: 2, title: "Quantum Arbitrage",          desc: "Exchanges produce 2x (cumulative 16x)" },
    data_grove_t2:     { cost: 57608167,            unlockAt: 25,  producerId: "data_grove",     prodMult: 2, title: "Feature Engineering",        desc: "Data Groves produce 2x" },
    data_grove_t3:     { cost: 3792801046,          unlockAt: 50,  producerId: "data_grove",     prodMult: 2, title: "Data Lakehouse",             desc: "Data Groves produce 2x (cumulative 8x)" },
    data_grove_t4:     { cost: 6165145616176,       unlockAt: 100, producerId: "data_grove",     prodMult: 2, title: "Synthetic Data Generator",   desc: "Data Groves produce 2x (cumulative 16x)" },
    attention_head_t2: { cost: 131675810,           unlockAt: 25,  producerId: "attention_head", prodMult: 2, title: "Cross-Attention Fusion",     desc: "Attention Heads produce 2x" },
    attention_head_t3: { cost: 8669259533,          unlockAt: 50,  producerId: "attention_head", prodMult: 2, title: "Flash Attention",            desc: "Attention Heads produce 2x (cumulative 8x)" },
    attention_head_t4: { cost: 14091761408403,      unlockAt: 100, producerId: "attention_head", prodMult: 2, title: "Infinite Context Window",    desc: "Attention Heads produce 2x (cumulative 16x)" },
    pit_miner_t2:      { cost: 230432668,           unlockAt: 25,  producerId: "pit_miner",      prodMult: 2, title: "Deep Pit Extraction",        desc: "Pit Miners produce 2x" },
    pit_miner_t3:      { cost: 15171204182,         unlockAt: 50,  producerId: "pit_miner",      prodMult: 2, title: "Pit Fusion Reactor",         desc: "Pit Miners produce 2x (cumulative 8x)" },
    pit_miner_t4:      { cost: 24660582464706,      unlockAt: 100, producerId: "pit_miner",      prodMult: 2, title: "Subatomic Pit Mining",       desc: "Pit Miners produce 2x (cumulative 16x)" },

    // Late producers (T2–T3, gpu_cluster gets T4 for P2-gated payoff): gpu_cluster, neural_pit, synth_orchard, transformer, orchard_cloud, quantum_grove
    gpu_cluster_t2:    { cost: 822973815,           unlockAt: 25,  producerId: "gpu_cluster",    prodMult: 2, title: "Tensor Core Unlocking",      desc: "GPU Clusters produce 2x" },
    gpu_cluster_t3:    { cost: 54182872079,         unlockAt: 50,  producerId: "gpu_cluster",    prodMult: 2, title: "Wafer-Scale Compute",        desc: "GPU Clusters produce 2x (cumulative 8x)" },
    gpu_cluster_t4:    { cost: 88073508802520,      unlockAt: 100, producerId: "gpu_cluster",    prodMult: 2, title: "Exascale Parallelism",       desc: "GPU Clusters produce 2x (cumulative 16x)" },
    neural_pit_t2:     { cost: 3291895262,          unlockAt: 25,  producerId: "neural_pit",     prodMult: 2, title: "Residual Connections",       desc: "Neural Pit Networks produce 2x" },
    neural_pit_t3:     { cost: 216731488317,        unlockAt: 50,  producerId: "neural_pit",     prodMult: 2, title: "Mixture of Pits",            desc: "Neural Pit Networks produce 2x (cumulative 8x)" },
    synth_orchard_t2:  { cost: 4937842893,          unlockAt: 25,  producerId: "synth_orchard",  prodMult: 2, title: "Epigenetic Memory",          desc: "Synthetic Orchards produce 2x" },
    synth_orchard_t3:  { cost: 325097232475,        unlockAt: 50,  producerId: "synth_orchard",  prodMult: 2, title: "De Novo Genome Synthesis",   desc: "Synthetic Orchards produce 2x (cumulative 8x)" },
    transformer_t2:    { cost: 24689214465,         unlockAt: 25,  producerId: "transformer",    prodMult: 2, title: "Sparse Attention",           desc: "Transformer Cores produce 2x" },
    transformer_t3:    { cost: 1625486162376,       unlockAt: 50,  producerId: "transformer",    prodMult: 2, title: "Chain-of-Thought Pruning",   desc: "Transformer Cores produce 2x (cumulative 8x)" },
    orchard_cloud_t2:  { cost: 54316271823,         unlockAt: 25,  producerId: "orchard_cloud",  prodMult: 2, title: "Edge Deployment",            desc: "Orchard Clouds produce 2x" },
    orchard_cloud_t3:  { cost: 3576069557227,       unlockAt: 50,  producerId: "orchard_cloud",  prodMult: 2, title: "Multi-Region Replication",   desc: "Orchard Clouds produce 2x (cumulative 8x)" },
    quantum_grove_t2:  { cost: 82297381549,         unlockAt: 25,  producerId: "quantum_grove",  prodMult: 2, title: "Quantum Error Correction",   desc: "Quantum Groves produce 2x" },
    quantum_grove_t3:  { cost: 5418287207920,       unlockAt: 50,  producerId: "quantum_grove",  prodMult: 2, title: "Topological Qubit Orchard",  desc: "Quantum Groves produce 2x (cumulative 8x)" },

    // Endgame producers (T2 only): agi_nexus, dyson_orchard, omega_harvest, foundation_model
    agi_nexus_t2:        { cost: 822973815495,      unlockAt: 25,  producerId: "agi_nexus",        prodMult: 2, title: "Instrumental Convergence",  desc: "AGI Nexuses produce 2x" },
    dyson_orchard_t2:    { cost: 13167581047916,    unlockAt: 25,  producerId: "dyson_orchard",    prodMult: 2, title: "Dyson Swarm Optimization",  desc: "Dyson Orchards produce 2x" },
    omega_harvest_t2:    { cost: 164594763098948,   unlockAt: 25,  producerId: "omega_harvest",    prodMult: 2, title: "Vacuum Energy Extraction",  desc: "Omega Harvests produce 2x" },
    foundation_model_t2: { cost: 8229738154947,     unlockAt: 25,  producerId: "foundation_model", prodMult: 2, title: "Constitutional Alignment",  desc: "Foundation Models produce 2x" },
  },

  wisdomUnlocks: {
    // ── Branch 1: Orchard Roots (8 nodes, 48w) ──
    starter_seedlings:   { wisdomCost: 1,  requires: null,                branch: "orchard_roots",     title: "Starter Seedlings",      desc: "Start each run with 3 saplings", effect: { startingProducers: { sapling: 3 } } },
    quick_sprout:        { wisdomCost: 2,  requires: "starter_seedlings", branch: "orchard_roots",     title: "Quick Sprout",           desc: "Start each run with 50 avocados", effect: { startingAvocados: 50 } },
    fertile_soil:        { wisdomCost: 3,  requires: "starter_seedlings", branch: "orchard_roots",     title: "Fertile Soil",           desc: "Producer costs -5%", effect: { producerCostMult: 0.95 } },
    muscle_memory:       { wisdomCost: 4,  requires: "starter_seedlings", branch: "orchard_roots",     title: "Muscle Memory",          desc: "Clicks +50%", effect: { clickMult: 1.5 } },
    deep_roots:          { wisdomCost: 5,  requires: "quick_sprout",      branch: "orchard_roots",     title: "Deep Roots",             desc: "Start each run with 5 saplings and 2 seed banks", effect: { startingProducers: { sapling: 5, seed_bank: 2 } } },
    ancient_grove:       { wisdomCost: 15, requires: "deep_roots",        branch: "orchard_roots",     title: "Ancient Grove",          desc: "Start each run with 500 avocados, 8 saplings, 3 seed banks", effect: { startingAvocados: 500, startingProducers: { sapling: 8, seed_bank: 3, orchard_row: 1 } } },
    rich_compost:        { wisdomCost: 8,  requires: "fertile_soil",      branch: "orchard_roots",     title: "Rich Compost",           desc: "Producer costs -10% (replaces Fertile Soil)", effect: { producerCostMult: 0.90 } },
    thick_skin:          { wisdomCost: 10, requires: "muscle_memory",     branch: "orchard_roots",     title: "Thick Skin",             desc: "Clicks +100% (replaces Muscle Memory)", effect: { clickMult: 2.0 } },

    // ── Branch 2: Guac Economy (13 nodes, 71w) ──
    guac_protocol:           { wisdomCost: 2,  requires: null,                    branch: "guac_economy",      title: "Guacamole Protocol",     desc: "Unlocks guac processing", effect: { unlocksGuac: true }, autoGrant: true },
    unlock_guac_recycler:    { wisdomCost: 2,  requires: "guac_protocol",         branch: "guac_economy",      title: "Guac Recycler Theory",   desc: "Unlocks research: guac lab consumption -0.05" },
    unlock_bulk_fermentation:{ wisdomCost: 3,  requires: "unlock_guac_recycler",  branch: "guac_economy",      title: "Fermentation Science",   desc: "Unlocks research: guac lab consumption -0.05 more" },
    unlock_catalytic_convert:{ wisdomCost: 4,  requires: "unlock_bulk_fermentation", branch: "guac_economy",   title: "Catalysis Research",     desc: "Unlocks research: refinery consumption -0.05" },
    unlock_refinery:         { wisdomCost: 2,  requires: "guac_protocol",         branch: "guac_economy",      title: "Refinery Blueprints",    desc: "Unlocks Guac Refinery building" },
    unlock_centrifuge:       { wisdomCost: 5,  requires: "unlock_refinery",       branch: "guac_economy",      title: "Centrifuge Engineering", desc: "Unlocks Guac Centrifuge building" },
    unlock_ultracentrifuge:  { wisdomCost: 5,  requires: "unlock_centrifuge",     branch: "guac_economy",      title: "Ultra Spin Theory",      desc: "Unlocks research: centrifuge output +0.05" },
    unlock_concentrate_proto:{ wisdomCost: 3,  requires: "guac_protocol",         branch: "guac_economy",      title: "Concentrate Theory",     desc: "Unlocks research: base guac output x1.5" },
    unlock_superlinear_synth:{ wisdomCost: 4,  requires: "unlock_concentrate_proto", branch: "guac_economy",   title: "Superlinear Theory",     desc: "Unlocks research: guac output +0.05" },
    unlock_exponential_ripen:{ wisdomCost: 6,  requires: "unlock_superlinear_synth", branch: "guac_economy",   title: "Exponential Growth Lab", desc: "Unlocks research: guac output +0.10" },
    unlock_lab_coats:        { wisdomCost: 4,  requires: "guac_protocol",         branch: "guac_economy",      title: "Lab Safety Standards",   desc: "Unlocks research: Guac Labs 2x" },
    guac_sommelier:          { wisdomCost: 8,  requires: "guac_protocol",         branch: "guac_economy",      title: "Guac Sommelier",         desc: "Guac multiplier coefficient +0.005", effect: { guacCoeffBonus: 0.005 } },
    guac_singularity:        { wisdomCost: 20, requires: "guac_sommelier",        branch: "guac_economy",      title: "Guac Singularity",       desc: "Guac multiplier coefficient +0.01 more", effect: { guacCoeffBonus: 0.01 } },

    // ── Branch 3: Wisdom Amplification (8 nodes, 76w) ──
    inner_peace:         { wisdomCost: 2,  requires: null,              branch: "wisdom_amp",        title: "Inner Peace",            desc: "Wisdom bonus +20% more effective", effect: { wisdomMultBonus: 0.02 } },
    wisdom_boost:        { wisdomCost: 3,  requires: "inner_peace",    branch: "wisdom_amp",        title: "AGI (Avocado General Intelligence)", desc: "Wisdom bonus +50% more effective", effect: { wisdomMultBonus: 0.05 } },
    recursive_insight:   { wisdomCost: 12, requires: "wisdom_boost",   branch: "wisdom_amp",        title: "Recursive Insight",      desc: "Wisdom earn rate +25%", effect: { wisdomEarnMult: 1.25 } },
    guac_memory_1:       { wisdomCost: 3,  requires: "inner_peace",    branch: "wisdom_amp",        title: "Guac Memory I",          desc: "produceExponent +0.02 per prestige" },
    guac_memory_2:       { wisdomCost: 10, requires: "guac_memory_1",  branch: "wisdom_amp",        title: "Guac Memory II",         desc: "consumeExponent -0.01 per prestige" },
    infinite_guac:       { wisdomCost: 25, requires: "guac_memory_2",  branch: "wisdom_amp",        title: "Infinite Guac Theory",   desc: "consumeExponent floor lowered from 0.70 to 0.55" },
    efficient_composting:{ wisdomCost: 6,  requires: "inner_peace",    branch: "wisdom_amp",        title: "Efficient Composting",   desc: "Prestige threshold lowered to 1.5M", effect: { prestigeThreshold: 1.5e6 } },
    accelerated_decay:   { wisdomCost: 15, requires: "efficient_composting", branch: "wisdom_amp",  title: "Accelerated Decay",      desc: "Prestige threshold lowered to 750K (replaces Efficient Composting)", effect: { prestigeThreshold: 750000 } },

    // ── Branch 4: Neural Architecture (7 nodes, 89w) ──
    backpropagation:     { wisdomCost: 2,  requires: null,                  branch: "neural_arch",       title: "Backpropagation",        desc: "All production +5%", effect: { globalApsMult: 1.05 } },
    weight_initialization:{ wisdomCost: 4, requires: "backpropagation",     branch: "neural_arch",       title: "Weight Initialization",  desc: "All production +10%", effect: { globalApsMult: 1.10 } },
    batch_normalization: { wisdomCost: 10, requires: "weight_initialization", branch: "neural_arch",     title: "Batch Normalization",    desc: "All production +20% (stacks)", effect: { globalApsMult: 1.20 } },
    residual_connections:{ wisdomCost: 25, requires: "batch_normalization", branch: "neural_arch",       title: "Residual Connections",   desc: "All production +50% (stacks)", effect: { globalApsMult: 1.50 } },
    dropout_prevention:  { wisdomCost: 5,  requires: "backpropagation",     branch: "neural_arch",       title: "Dropout Prevention",     desc: "Achievement bonuses +25% more effective", effect: { achievementBonusMult: 1.25 } },
    gradient_clipping:   { wisdomCost: 8,  requires: "backpropagation",     branch: "neural_arch",       title: "Gradient Clipping",      desc: "Research costs -10%", effect: { researchCostMult: 0.90 } },
    adaptive_learning:   { wisdomCost: 20, requires: "gradient_clipping",   branch: "neural_arch",       title: "Adaptive Learning",      desc: "Research costs -20% (replaces Gradient Clipping)", effect: { researchCostMult: 0.80 } },

    // placeholder effect on root nodes without mechanical effects — the node itself is the gate

    // ── Branch 5: Training Data (5 nodes, 32w) ──
    curriculum_learning: { wisdomCost: 3,  requires: null,                   branch: "training_data",     title: "Curriculum Learning",    desc: "Unlocks Training Regimens. +1 base click yield.", effect: { baseClickBonus: 1 } },
    click_specialization:{ wisdomCost: 4,  requires: "curriculum_learning",  branch: "training_data",     title: "Click Specialization",   desc: "Unlocks Click Focus regimen: clicks 3x, producers -30%" },
    scale_specialization:{ wisdomCost: 4,  requires: "curriculum_learning",  branch: "training_data",     title: "Scale Specialization",   desc: "Unlocks Scale Focus regimen: producers +50%, clicks -50%" },
    guac_specialization: { wisdomCost: 6,  requires: "curriculum_learning",  branch: "training_data",     title: "Guac Specialization",    desc: "Unlocks Guac Focus regimen: guac output 2x, production -20%" },
    dual_curriculum:     { wisdomCost: 15, requires: "curriculum_learning",  branch: "training_data",     title: "Dual Curriculum",        desc: "Equip 2 regimens at once" },

    // ── Branch 6: Persistent Memory (4 nodes, 48w) ──
    flash_memory:        { wisdomCost: 5,  requires: null,              branch: "persistent_memory", title: "Flash Memory",           desc: "Keep 1 research upgrade through prestige", effect: { persistentSlots: 1 } },
    l1_cache:            { wisdomCost: 10, requires: "flash_memory",    branch: "persistent_memory", title: "L1 Cache",               desc: "Keep 2 research upgrades through prestige (replaces Flash Memory)", effect: { persistentSlots: 2 } },
    l2_cache:            { wisdomCost: 25, requires: "l1_cache",        branch: "persistent_memory", title: "L2 Cache",               desc: "Keep 3 research upgrades through prestige (replaces L1 Cache)", effect: { persistentSlots: 3 } },
    selective_recall:    { wisdomCost: 8,  requires: "flash_memory",    branch: "persistent_memory", title: "Selective Recall",       desc: "Auto-select the most expensive research upgrades for persistent slots" },

    // ── Branch 7: Reinforcement Learning (5 nodes, 43w) ──
    reinforcement_learning:{ wisdomCost: 3,  requires: null,                      branch: "reinforcement_learning", title: "Reward Signal",      desc: "Gift spawn rate ×1.5", effect: { giftSpawnMult: 1.5 } },
    gift_scholarship:      { wisdomCost: 4,  requires: "reinforcement_learning",  branch: "reinforcement_learning", title: "Exploration Bonus",  desc: "Gifts can grant free research upgrades", effect: { unlocksGiftEffect: "free_purchase" } },
    gift_of_wisdom:        { wisdomCost: 6,  requires: "reinforcement_learning",  branch: "reinforcement_learning", title: "Reward Shaping",     desc: "Gifts can grant wisdom points", effect: { unlocksGiftEffect: "wisdom_grant" } },
    quality_control:       { wisdomCost: 20, requires: "reinforcement_learning",  branch: "reinforcement_learning", title: "Quality Control",    desc: "Removes negative gift effects", effect: { removeNegativeGifts: true } },
    epsilon_greedy:        { wisdomCost: 10, requires: "reinforcement_learning",  branch: "reinforcement_learning", title: "Epsilon-Greedy",     desc: "Gift spawn rate ×2 more. 2 gifts on screen.", effect: { giftSpawnMult: 2.0, giftMaxOnScreen: 2 } },

    // ── Branch 8: Inference Engine (5 nodes, 68w) ──
    knowledge_distillation:{ wisdomCost: 5,  requires: null,                      branch: "inference_engine",  title: "Knowledge Distillation", desc: "Distillation costs -10%", effect: { distillCostMult: 0.90 } },
    pruning_algorithm:     { wisdomCost: 8,  requires: "knowledge_distillation",  branch: "inference_engine",  title: "Pruning Algorithm",      desc: "Distillation costs -25% (replaces Knowledge Distillation)", effect: { distillCostMult: 0.75 } },
    quantization:          { wisdomCost: 10, requires: "knowledge_distillation",  branch: "inference_engine",  title: "Quantization",           desc: "Distillation bonuses +20% more effective", effect: { distillBonusMult: 1.20 } },
    model_merging:         { wisdomCost: 15, requires: "knowledge_distillation",  branch: "inference_engine",  title: "Model Merging",          desc: "Distillation bonuses +50% more effective (stacks)", effect: { distillBonusMult: 1.50 } },
    emergent_capability:   { wisdomCost: 30, requires: "model_merging",           branch: "inference_engine",  title: "Emergent Capability",    desc: "Unlocks Model v6.0 distillation tier" },
  },

  wisdomBranches: {
    orchard_roots:     { title: "Orchard Roots",        color: "#7ec87e" },
    guac_economy:      { title: "Guac Economy",          color: "#4a7c3f" },
    wisdom_amp:        { title: "Wisdom Amplification",  color: "#c8a2c8" },
    neural_arch:       { title: "Neural Architecture",   color: "#4a8cc7" },
    training_data:     { title: "Training Data",         color: "#e8a438" },
    persistent_memory: { title: "Persistent Memory",     color: "#d4af37" },
    reinforcement_learning: { title: "Reinforcement Learning", color: "#e06c75" },
    inference_engine:  { title: "Inference Engine",       color: "#c0392b" },
  },

  trainingRegimens: {
    click_focus: { title: "Click Focus",  desc: "Clicks 3x, producers -30%",  clickMult: 3.0, producerMult: 0.70, requiresUnlock: "click_specialization" },
    scale_focus: { title: "Scale Focus",  desc: "Producers +50%, clicks -50%", clickMult: 0.50, producerMult: 1.50, requiresUnlock: "scale_specialization" },
    guac_focus:  { title: "Guac Focus",   desc: "Guac 2x, production -20%",   guacOutputMult: 2.0, producerMult: 0.80, requiresUnlock: "guac_specialization" },
  },

  achievements: {
    // ── 🌱 Seedlings (8) ──
    first_pick:        { emoji: "🌱", title: "First Pick",               hint: "Every journey begins with a single...",            baseClickBonus: 1, category: "seedlings" },
    hello_world:       { emoji: "🌱", title: "Hello, World",             hint: "Your first words in avocado...",                    clickMult: 0.02, category: "seedlings" },
    batch_processing:  { emoji: "🌱", title: "Batch Processing",         hint: "Quantity has a quality all its own...",             clickMult: 0.01, category: "seedlings" },
    first_upgrade:     { emoji: "🌱", title: "Peer Review",              hint: "Knowledge compounds...",                            clickMult: 0.01, category: "seedlings" },
    first_epoch:       { emoji: "🌱", title: "First Epoch",              hint: "Diversify your portfolio of trees...",              clickMult: 0.02, category: "seedlings" },
    hundred_clicks:    { emoji: "🌱", title: "Carpal Tunnel Initiate",   hint: "Click, click, click...",                            baseClickBonus: 2, category: "seedlings" },
    seed_hoarder:      { emoji: "🌱", title: "Seed Hoarder",             hint: "Save up for a rainy day...",                        clickMult: 0.01, category: "seedlings" },
    overfitting:       { emoji: "🌱", title: "Overfitting",              hint: "Max out your manual labor...",                      baseClickBonus: 3, category: "seedlings" },

    // ── 🏭 Production (10) ──
    feature_extraction:{ emoji: "🏭", title: "Feature Extraction",       hint: "Triple digits per second...",                       clickMult: 0.03, category: "production" },
    gradient_descent:  { emoji: "🏭", title: "Gradient Descent",         hint: "Four digits of throughput...",                      clickMult: 0.05, category: "production" },
    scaling_laws:      { emoji: "🏭", title: "Scaling Laws",             hint: "The curve steepens...",                             clickMult: 0.03, category: "production" },
    singularity:       { emoji: "🏭", title: "The Singularity",          hint: "Five zeroes...",                                    clickMult: 0.05, category: "production" },
    superintelligence: { emoji: "🏭", title: "Superintelligence",        hint: "Six digits. The orchard hums...",                   clickMult: 0.25, category: "production" },
    million_aps:       { emoji: "🏭", title: "Compute Saturated",        hint: "Seven figures of throughput...",                    clickMult: 0.25, category: "production" },
    data_pipeline:     { emoji: "🏭", title: "Data Pipeline",            hint: "Air and soil, working together...",                 clickMult: 0.02, category: "production" },
    deep_network:      { emoji: "🏭", title: "Deep Network",             hint: "One of everything, up to the miners...",           clickMult: 0.03, category: "production" },
    full_stack:        { emoji: "🏭", title: "Full Stack",               hint: "A complete orchard infrastructure...",              clickMult: 0.05, category: "production" },
    attention_is_all:  { emoji: "🏭", title: "Attention Is All You Need",hint: "Focus on what matters...",                          clickMult: 0.03, category: "production" },

    // ── 🥑 Guacamole (8) ──
    guac_online:       { emoji: "🥑", title: "Guac Protocol Online",     hint: "Your first batch of guac...",                       guacProdMult: 0.05, category: "guacamole" },
    loss_convergence:  { emoji: "🥑", title: "Loss Convergence",         hint: "Triple-digit guac reserves...",                     guacMult: 0.03, category: "guacamole" },
    guac_reservoir:    { emoji: "🥑", title: "Guac Reservoir",           hint: "A thousand units of green gold...",                 guacMult: 0.05, category: "guacamole" },
    guac_ocean:        { emoji: "🥑", title: "Guac Ocean",               hint: "An ocean of guacamole...",                          guacMult: 0.05, category: "guacamole" },
    guac_universe:     { emoji: "🥑", title: "Guac Universe",            hint: "Guac beyond comprehension...",                      guacMult: 0.08, category: "guacamole" },
    refinery_chain:    { emoji: "🥑", title: "Supply Chain",             hint: "Multiple layers of refinement...",                  guacProdMult: 0.03, category: "guacamole" },
    centrifuge_array:  { emoji: "🥑", title: "Centrifuge Array",         hint: "The spin cycle never stops...",                     guacProdMult: 0.03, category: "guacamole" },
    guac_ascendant:    { emoji: "🥑", title: "Guac Ascendant",           hint: "Your guac multiplier reaches a milestone...",       guacMult: 0.05, category: "guacamole" },

    // ── 🔬 Research (8) ──
    five_upgrades:     { emoji: "🔬", title: "Literature Review",        hint: "Consume knowledge systematically...",               clickMult: 0.01, category: "research" },
    ten_upgrades:      { emoji: "🔬", title: "Research Grant",           hint: "Funded and focused...",                             clickMult: 0.02, category: "research" },
    twenty_upgrades:   { emoji: "🔬", title: "Tenure Track",             hint: "Deep expertise developing...",                      clickMult: 0.03, category: "research" },
    forty_upgrades:    { emoji: "🔬", title: "Distinguished Professor",  hint: "The lab is full of papers...",                      clickMult: 0.03, category: "research" },
    sixty_upgrades:    { emoji: "🔬", title: "Nobel Committee",          hint: "Most of the known research...",                     clickMult: 0.15, category: "research" },
    first_synergy:     { emoji: "🔬", title: "Cross-Pollination",        hint: "Two producers, working together...",                clickMult: 0.02, category: "research" },
    five_synergies:    { emoji: "🔬", title: "Research Network",         hint: "A web of interconnected discoveries...",            clickMult: 0.03, category: "research" },
    all_synergies:     { emoji: "🔬", title: "Unified Field Theory",     hint: "Every connection mapped...",                        clickMult: 0.15, category: "research" },

    // ── ♻️ Prestige (8) ──
    convergence:       { emoji: "♻️", title: "Convergence",              hint: "The first compost cycle...",                        wisdomMult: 0.05, category: "prestige" },
    fine_tuning:       { emoji: "♻️", title: "Fine-Tuning",              hint: "Three rounds of refinement...",                     clickMult: 0.03, category: "prestige" },
    overfit_prevention:{ emoji: "♻️", title: "Overfit Prevention",       hint: "Five cycles of learning...",                        wisdomMult: 0.05, category: "prestige" },
    ten_prestiges:     { emoji: "♻️", title: "Compost Veteran",          hint: "Double digits of decay...",                         clickMult: 0.05, category: "prestige" },
    twenty_prestiges:  { emoji: "♻️", title: "Compost Addict",           hint: "You can stop any time...",                          wisdomMult: 0.03, category: "prestige" },
    agi_achieved:      { emoji: "♻️", title: "AGI Achieved",             hint: "Accumulate deep wisdom...",                         clickMult: 0.05, category: "prestige" },
    transfer_learning: { emoji: "♻️", title: "Transfer Learning",       hint: "Master the guac memory upgrades...",                clickMult: 0.03, category: "prestige" },
    paperclip_moment:  { emoji: "♻️", title: "The Paperclip Moment",     hint: "A billion avocados across all time...",             clickMult: 0.15, category: "prestige" },

    // ── 🧬 Distillation (6) ──
    first_distillation:{ emoji: "🧬", title: "First Distillation",       hint: "Compress the model for the first time...",          clickMult: 0.05, category: "distillation" },
    architecture_search:{ emoji: "🧬", title: "Architecture Search",     hint: "Three versions deep...",                            clickMult: 0.05, category: "distillation" },
    model_v5:          { emoji: "🧬", title: "Production Ready",         hint: "The penultimate version...",                        clickMult: 0.20, category: "distillation" },
    model_v6:          { emoji: "🧬", title: "Emergent Intelligence",    hint: "The final form...",                                 clickMult: 0.25, category: "distillation" },
    double_distill:    { emoji: "🧬", title: "Double Down",              hint: "Two distillations complete...",                     clickMult: 0.03, category: "distillation" },
    speed_distill:     { emoji: "🧬", title: "Speed Run",                hint: "Distill before your fifth compost...",              wisdomMult: 0.03, category: "distillation" },

    // ── 🎁 Gifts (7) ──
    first_gift:        { emoji: "🎁", title: "Unboxing",                 hint: "Open your first gift...",                           clickMult: 0.01, category: "gifts" },
    five_gifts:        { emoji: "🎁", title: "Gift Collector",           hint: "A handful of surprises...",                         clickMult: 0.02, category: "gifts" },
    twenty_gifts:      { emoji: "🎁", title: "Dedicated Unboxer",        hint: "Never miss a present...",                           clickMult: 0.02, category: "gifts" },
    fifty_gifts:       { emoji: "🎁", title: "Gift Goblin",              hint: "Fifty boxes opened...",                             globalMult: 0.03, category: "gifts" },
    hundred_gifts:     { emoji: "🎁", title: "Santa's Helper",           hint: "Triple digits of gifts...",                         clickMult: 0.03, category: "gifts" },
    got_frenzy:        { emoji: "🎁", title: "Click Frenzy Survivor",    hint: "Experience the frenzy...",                          globalMult: 0.02, category: "gifts" },
    wisdom_gift:       { emoji: "🎁", title: "Enlightened Delivery",     hint: "Wisdom from an unexpected source...",               wisdomMult: 0.02, category: "gifts" },

    // ── 🏋️ Training (4) ──
    first_regimen:     { emoji: "🏋️", title: "Training Montage",         hint: "Choose a focus for the first time...",              clickMult: 0.02, category: "training" },
    dual_regimen:      { emoji: "🏋️", title: "Dual Wielder",             hint: "Two regimens at once...",                           clickMult: 0.03, category: "training" },
    all_regimens_tried:{ emoji: "🏋️", title: "Jack of All Trades",       hint: "Try every regimen at least once...",                clickMult: 0.02, category: "training" },
    persistent_full:   { emoji: "🏋️", title: "Total Recall",             hint: "Fill all memory slots...",                          clickMult: 0.03, category: "training" },

    // ── 📈 Scaling (8) ──
    trillion_alltime:  { emoji: "📈", title: "Trillion Club",            hint: "Twelve zeroes of lifetime avocados...",             clickMult: 0.03, category: "scaling" },
    quadrillion_alltime:{ emoji: "📈", title: "Quadrillion Orchard",     hint: "Fifteen zeroes...",                                 clickMult: 0.05, category: "scaling" },
    sapling_army:      { emoji: "📈", title: "Sapling Army",             hint: "Fifty little trees...",                             baseClickBonus: 3, category: "scaling" },
    hundred_producers: { emoji: "📈", title: "Mass Production",          hint: "A hundred units of one type...",                    baseClickBonus: 5, category: "scaling" },
    thousand_clicks:   { emoji: "📈", title: "Keyboard Warrior",         hint: "A thousand manual picks...",                        baseClickBonus: 5, category: "scaling" },
    ten_thousand_clicks:{ emoji: "📈", title: "Click Singularity",       hint: "Ten thousand deliberate actions...",                baseClickBonus: 15, category: "scaling" },
    wisdom_50:         { emoji: "📈", title: "Deep Knowledge",           hint: "Half a hundred wisdom...",                          wisdomMult: 0.03, category: "scaling" },
    wisdom_200:        { emoji: "📈", title: "Wisdom Overflow",          hint: "Two hundred points of wisdom...",                   wisdomMult: 0.05, category: "scaling" },

    // ── ✨ Quirky (8) — unique effects ──
    night_owl:         { emoji: "🌙", title: "Night Owl",                hint: "Burn the midnight oil...",                          clickMult: 0.01, category: "quirky", quirkyEffect: "theme_midnight" },
    sunset_theme:      { emoji: "🌅", title: "Golden Hour",              hint: "The sun sets on the orchard...",                    clickMult: 0.01, category: "quirky", quirkyEffect: "theme_sunset" },
    matrix_theme:      { emoji: "💚", title: "There Is No Avocado",      hint: "See the code behind the guac...",                   clickMult: 0.01, category: "quirky", quirkyEffect: "theme_matrix" },
    speed_demon:       { emoji: "⚡", title: "Speed Demon",              hint: "Velocity incarnate...",                             clickMult: 0.02, category: "quirky", quirkyEffect: "speed_lines" },
    click_frenzy_100:  { emoji: "🔥", title: "Frenzy Mode",              hint: "Click like the wind...",                            baseClickBonus: 5, category: "quirky", quirkyEffect: "click_particles" },
    patient_zero:      { emoji: "🐌", title: "Patient Zero",             hint: "Good things come to those who wait...",             clickMult: 0.02, category: "quirky", quirkyEffect: "title_afk" },
    secret_konami:     { emoji: "🕹️", title: "???",                      hint: "???",                                              clickMult: 0.03, category: "quirky", quirkyEffect: "title_contra", hidden: true },
    dedication:        { emoji: "🏆", title: "Dedication",               hint: "Return to the orchard again and again...",          clickMult: 0.03, category: "quirky", quirkyEffect: "title_permanent" },
  },

  themes: {
    default:  {},
    midnight: { "--bg": "#0a0e1a", "--panel": "#11162a", "--primary": "#4a6cc7", "--text": "#d8e0f0", "--muted": "#7889a6" },
    sunset:   { "--bg": "#1a120a", "--panel": "#211a12", "--primary": "#c78a3f", "--text": "#f0e8d8", "--muted": "#a69878" },
    matrix:   { "--bg": "#000000", "--panel": "#0a0f0a", "--primary": "#00cc33", "--text": "#00ff41", "--muted": "#00994d" },
  },

  prestige: {
    unlockThreshold: 3e6,         // total avocados this run to unlock prestige
    divisor: 30,                  // wisdom = floor(cbrt(total) / divisor)
    scalingRoot: 3,               // 3 = cube root, 2 = square root
    wisdomMultPerPoint: 0.10,     // +10% per wisdom point
    firstPrestigeBonus: 3,        // bonus wisdom on first prestige
  },

  reveal: {
    costThreshold: 0.6,           // reveal when player has >= 60% of cost
    producerLookahead: 2,         // max unowned standard producers visible
    guacProducerLookahead: 1,     // max unowned guac producers visible
    upgradeLookahead: 3,          // max unowned research upgrades visible
  },

  wrappedGift: {
    spawnChancePerTick: 0.002,    // ~1 gift per 90-120s
    minCooldownMs: 30000,         // 30s min between gifts
    maxOnScreen: 1,               // base max (epsilon_greedy → 2)

    spawnInDuration: 1500,        // ms
    breatheDuration: 10000,
    fadeOutDuration: 3000,

    fontSizes: [32, 48, 64, 80],

    effects: {
      aps_boost:     { weight: 25, text: "APS Boost!",      field: "aps",   mult: 2.0,  durationMs: 30000 },
      click_boost:   { weight: 20, text: "Click Frenzy!",   field: "click", mult: 3.0,  durationMs: 15000 },
      aps_drain:     { weight: 10, text: "Bug Report...",    field: "aps",   mult: 0.5,  durationMs: 20000, negative: true },
      click_drain:   { weight: 8,  text: "Carpal Tunnel!",  field: "click", mult: 0.5,  durationMs: 15000, negative: true },
      free_purchase: { weight: 8,  text: "Free Upgrade!",   requiresWisdomUnlock: "gift_scholarship" },
      wisdom_grant:  { weight: 5,  text: "Enlightenment!",  wisdomAmount: 1, requiresWisdomUnlock: "gift_of_wisdom" },
      guac_boost:    { weight: 12, text: "Guac Surge!",      field: "guac",  mult: 2.0,  durationMs: 30000 },
      guac_drain:    { weight: 6,  text: "Moldy Batch...",   field: "guac",  mult: 0.5,  durationMs: 20000, negative: true },
      guac_rot:      { weight: 6,  text: "Guac Rot!",       guacLossPct: 0.25, negative: true },
      empty:         { weight: 15, text: "Empty Box..." },
      avocado_rain:  { weight: 9,  text: "Avocado Rain!",   apsSeconds: 60 },
    },
  },

  distillation: {
    costs: [100, 250, 500, 1000, 2000, 4000], // wisdom cost for each distillation (v1.0 through v6.0)
    bonuses: [
      { apsMult: 1.5, wisdomEarnMult: 1.2, desc: "Base APS x1.5, wisdom earn rate x1.2", flavor: "Knowledge compressed. Inference faster." },
      { baseClickBonus: 1, guacProdMult: 1.3, desc: "+1 base click power, guac production x1.3", flavor: "Attention weights optimized." },
      { costMult: 0.90, startingWisdom: 2, desc: "Producer costs x0.90, +2 starting wisdom on prestige", flavor: "Quantized. Smaller, same performance." },
      { multiplierCoeffBonus: 0.01, consumeFloorBonus: -0.05, desc: "Guac mult coeff +0.01, consume floor -0.05", flavor: "Architecture breakthrough." },
      { allProdMult: 2.0, unlocksFoundationModel: true, desc: "All production x2.0, unlock Foundation Model", flavor: "You have built AGI." },
      { apsMult: 2.0, wisdomEarnMult: 1.5, allProdMult: 1.5, desc: "APS x2.0, all prod x1.5, wisdom earn x1.5", flavor: "Emergent properties detected. The avocados understand themselves." },
    ],
  },
};

// Standard producers — middle column
export const PRODUCER_ORDER = [
  "sapling", "seed_bank", "orchard_row", "compost_bin", "drone",
  "greenhouse", "harvest_bot", "exchange", "data_grove",
  "attention_head", "pit_miner", "gpu_cluster",
  "neural_pit", "synth_orchard", "transformer",
  "orchard_cloud", "quantum_grove", "agi_nexus",
  "dyson_orchard", "omega_harvest", "foundation_model",
];

// Guac producers — left column, own section
export const GUAC_PRODUCER_ORDER = ["guac_lab", "guac_refinery", "guac_centrifuge"];

// Wisdom tree branch render order
export const WISDOM_BRANCH_ORDER = [
  "orchard_roots", "guac_economy", "wisdom_amp",
  "neural_arch", "training_data", "persistent_memory", "reinforcement_learning", "inference_engine",
];

// Achievement categories — display order and labels
export const ACHIEVEMENT_CATEGORIES = [
  { id: "seedlings",    emoji: "🌱", title: "Seedlings" },
  { id: "production",   emoji: "🏭", title: "Production" },
  { id: "guacamole",    emoji: "🥑", title: "Guacamole" },
  { id: "research",     emoji: "🔬", title: "Research" },
  { id: "prestige",     emoji: "♻️", title: "Prestige" },
  { id: "distillation", emoji: "🧬", title: "Distillation" },
  { id: "gifts",        emoji: "🎁", title: "Gifts" },
  { id: "training",     emoji: "🏋️", title: "Training" },
  { id: "scaling",      emoji: "📈", title: "Scaling" },
  { id: "quirky",       emoji: "✨", title: "Quirky" },
];
