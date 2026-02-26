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
    guac_unlock:        { cost: 25000,   unlockAt: 0,  unlocksGuac: true, title: "Guacamole Protocol",  desc: "Unlocks guac processing" },
    wisdom_boost:       { cost: 1e6,     unlockAt: 0,  wisdomMult: 0.05,  minPrestigeCount: 1, title: "AGI (Avocado General Intelligence)", desc: "Wisdom bonus +50% more effective" },
    // Guac tuning upgrades
    guac_recycler:      { cost: 120000,  unlockAt: 5,  producerId: "guac_lab", consumeExpDelta: -0.05, title: "Guac Recycler",          desc: "Lab consumption scaling -0.05", requiresWisdomUnlock: "unlock_guac_recycler" },
    bulk_fermentation:  { cost: 200000,  unlockAt: 10, producerId: "guac_lab", consumeExpDelta: -0.05, title: "Bulk Fermentation",       desc: "Lab consumption scaling -0.05 more", requiresWisdomUnlock: "unlock_bulk_fermentation" },
    superlinear_synth:  { cost: 100000,  guacUnlockAt: 25,  produceExpDelta: +0.05,  title: "Superlinear Synthesis",  desc: "Guac output scaling +0.05", requiresWisdomUnlock: "unlock_superlinear_synth" },
    exponential_ripen:  { cost: 500000,  guacUnlockAt: 100, produceExpDelta: +0.10,  title: "Exponential Ripening",   desc: "Guac output scaling +0.10", requiresWisdomUnlock: "unlock_exponential_ripen" },
    concentrate_proto:  { cost: 200000,  unlockAt: 10, producerId: "guac_lab", baseProdMult: 1.5, title: "Concentrate Protocol",  desc: "Base guac output x1.5", requiresWisdomUnlock: "unlock_concentrate_proto" },
    // Throughput Clicking chain — scales clicks with base APS (before multipliers)
    throughput_click_1: { cost: 500,   apsUnlockAt: 1,   apsPctPerClick: 0.03, title: "Throughput Clicking I",   desc: "Each click also adds 3% of your base APS." },
    throughput_click_2: { cost: 5000,  apsUnlockAt: 10,  requiresUpgrade: "throughput_click_1", apsPctPerClick: 0.06, title: "Throughput Clicking II",  desc: "Each click also adds 6% of your base APS." },
    throughput_click_3: { cost: 50000, apsUnlockAt: 100, requiresUpgrade: "throughput_click_2", guacUnlockAt: 50, apsPctPerClick: 0.10, title: "Throughput Clicking III", desc: "Each click also adds 10% of your base APS." },
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
    guac_memory_1:            { wisdomCost: 3,  title: "Guac Memory I",           desc: "produceExponent +0.02 per prestige completed" },
    guac_memory_2:            { wisdomCost: 10, title: "Guac Memory II",          desc: "consumeExponent -0.01 per prestige completed" },
    infinite_guac:            { wisdomCost: 25, title: "Infinite Guac Theory",    desc: "consumeExponent floor lowered from 0.70 to 0.55" },
    unlock_guac_recycler:     { wisdomCost: 2,  title: "Guac Recycler Theory",    desc: "Unlocks a research upgrade that reduces guac lab consumption scaling by 0.05" },
    unlock_refinery:          { wisdomCost: 2,  title: "Refinery Blueprints",     desc: "Unlocks the Guac Refinery building — each refinery lowers consumption scaling by 0.01" },
    unlock_bulk_fermentation: { wisdomCost: 3,  title: "Fermentation Science",    desc: "Unlocks a research upgrade that reduces guac lab consumption scaling by another 0.05" },
    unlock_concentrate_proto: { wisdomCost: 3,  title: "Concentrate Theory",      desc: "Unlocks a research upgrade that multiplies base guac output by 1.5x" },
    unlock_superlinear_synth: { wisdomCost: 4,  title: "Superlinear Theory",      desc: "Unlocks a research upgrade that boosts guac output scaling exponent by +0.05" },
    unlock_lab_coats:         { wisdomCost: 4,  title: "Lab Safety Standards",    desc: "Unlocks a research upgrade that doubles Guac Lab production (2x)" },
    unlock_catalytic_convert: { wisdomCost: 4,  title: "Catalysis Research",      desc: "Unlocks a research upgrade that reduces refinery consumption scaling by 0.05" },
    unlock_centrifuge:        { wisdomCost: 5,  title: "Centrifuge Engineering",  desc: "Unlocks the Guac Centrifuge building — each centrifuge boosts guac output scaling by +0.05" },
    unlock_ultracentrifuge:   { wisdomCost: 5,  title: "Ultra Spin Theory",       desc: "Unlocks a research upgrade that boosts centrifuge guac output scaling by +0.05" },
    unlock_exponential_ripen: { wisdomCost: 6,  title: "Exponential Growth Lab",  desc: "Unlocks a research upgrade that boosts guac output scaling exponent by +0.10" },
  },

  benchmarks: {
    // Early
    first_inference:    { title: "First Inference",               desc: "Click once.",                           clickMult: 0.02, phase: "Early" },
    hello_world:        { title: "Hello, World",                  desc: "Reach 1 APS.",                          globalMult: 0.02, phase: "Early" },
    batch_processing:   { title: "Batch Processing",              desc: "Own 10 Avocado Saplings.",              globalMult: 0.01, phase: "Early" },
    overfitting:        { title: "Overfitting",                   desc: "Buy all click upgrades.",               clickMult: 0.05, phase: "Early" },
    feature_extraction: { title: "Feature Extraction",            desc: "Reach 100 APS.",                        globalMult: 0.03, phase: "Early" },
    first_epoch:        { title: "First Epoch",                   desc: "Own 5+ of any 3 different producers.",  globalMult: 0.02, phase: "Early" },
    // Mid
    guac_online:        { title: "Guac Protocol Online",          desc: "Produce first guac.",                   guacProdMult: 0.05, phase: "Mid" },
    data_pipeline:      { title: "Data Pipeline",                 desc: "Own 5 Irrigation Drones and 5 Orchard Rows.", globalMult: 0.02, phase: "Mid" },
    gradient_descent:   { title: "Gradient Descent",              desc: "Reach 1,000 APS.",                      globalMult: 0.05, phase: "Mid" },
    deep_network:       { title: "Deep Network",                  desc: "Own 1 of every standard producer up to Pit Miner.", globalMult: 0.03, phase: "Mid" },
    scaling_laws:       { title: "Scaling Laws",                  desc: "Reach 5,000 APS.",                      globalMult: 0.03, phase: "Mid" },
    attention_is_all:   { title: "Attention Is All You Need",     desc: "Own 1 Attention Head.",                 globalMult: 0.03, phase: "Mid" },
    loss_convergence:   { title: "Loss Convergence",              desc: "Accumulate 100 guac.",                  guacMult: 0.03, phase: "Mid" },
    singularity:        { title: "The Singularity",               desc: "Reach 10,000 APS.",                     globalMult: 0.05, phase: "Mid" },
    guac_reservoir:     { title: "Guac Reservoir",                desc: "Accumulate 1,000 guac.",                guacMult: 0.05, phase: "Mid" },
    // Prestige
    convergence:        { title: "Convergence",                   desc: "Prestige for the first time.",          wisdomMult: 0.05, phase: "Prestige" },
    fine_tuning:        { title: "Fine-Tuning",                   desc: "Complete 3 prestiges.",                 globalMult: 0.03, phase: "Prestige" },
    overfit_prevention: { title: "Overfit Prevention",            desc: "Complete 5 prestiges.",                 wisdomMult: 0.05, phase: "Prestige" },
    transfer_learning:  { title: "Transfer Learning",             desc: "Buy all 3 scaling wisdom unlocks.",     globalMult: 0.03, phase: "Prestige" },
    agi_achieved:       { title: "AGI Achieved",                  desc: "Accumulate 50 lifetime wisdom.",        globalMult: 0.05, phase: "Prestige" },
    superintelligence:  { title: "Superintelligence",             desc: "Reach 100,000 APS.",                    globalMult: 0.10, phase: "Prestige" },
    paperclip_moment:   { title: "The Paperclip Moment",          desc: "1 billion all-time avocados.",          globalMult: 0.05, phase: "Prestige" },
    // Endgame
    first_distillation: { title: "First Distillation",            desc: "Distill to Model v1.0.",                globalMult: 0.05, phase: "Endgame" },
    architecture_search:{ title: "Architecture Search",           desc: "Reach Model v3.0.",                     globalMult: 0.05, phase: "Endgame" },
    guac_ocean:         { title: "Guac Ocean",                    desc: "Accumulate 10,000 guac.",               guacMult: 0.05, phase: "Endgame" },
    million_aps:        { title: "Compute Saturated",             desc: "Reach 1,000,000 APS.",                  globalMult: 0.10, phase: "Endgame" },
    full_stack:         { title: "Full Stack",                    desc: "Own 1 of every standard producer.",     globalMult: 0.05, phase: "Endgame" },
  },

  prestige: {
    unlockThreshold: 1e7,         // total avocados this run to unlock prestige
    divisor: 750,                 // wisdom = floor(sqrt(total) / divisor)
    wisdomMultPerPoint: 0.10,     // +10% per wisdom point
  },

  reveal: {
    costThreshold: 0.6,           // reveal when player has >= 60% of cost
    producerLookahead: 2,         // max unowned standard producers visible
    guacProducerLookahead: 1,     // max unowned guac producers visible
    upgradeLookahead: 3,          // max unowned research upgrades visible
  },

  distillation: {
    costs: [100, 250, 500, 1000, 2000], // wisdom cost for each distillation (v1.0 through v5.0)
    bonuses: [
      { apsMult: 1.5, wisdomEarnMult: 1.2, desc: "Base APS x1.5, wisdom earn rate x1.2", flavor: "Knowledge compressed. Inference faster." },
      { baseClickBonus: 1, guacProdMult: 1.3, desc: "+1 base click power, guac production x1.3", flavor: "Attention weights optimized." },
      { costMult: 0.90, startingWisdom: 2, desc: "Producer costs x0.90, +2 starting wisdom on prestige", flavor: "Quantized. Smaller, same performance." },
      { multiplierCoeffBonus: 0.01, consumeFloorBonus: -0.05, desc: "Guac mult coeff +0.01, consume floor -0.05", flavor: "Architecture breakthrough." },
      { allProdMult: 2.0, unlocksFoundationModel: true, desc: "All production x2.0, unlock Foundation Model", flavor: "You have built AGI." },
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
