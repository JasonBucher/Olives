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
    exchange:       { baseCost: 130000, costGrowth: 1.15, baseRate: 260,    title: "Avocado Exchange",   desc: "Publicly traded pits." },
    attention_head: { baseCost: 800000, costGrowth: 1.15, baseRate: 900,    title: "Attention Head",     desc: "Focuses on the ripe ones. All others are masked." },
    pit_miner:      { baseCost: 1.4e6,  costGrowth: 1.15, baseRate: 1400,   title: "Pit Miner",          desc: "Extracting data from pits." },
    neural_pit:     { baseCost: 2e7,    costGrowth: 1.15, baseRate: 7800,   title: "Neural Pit Network", desc: "The pits are thinking." },
    transformer:    { baseCost: 1.5e8,  costGrowth: 1.15, baseRate: 28000,  title: "Transformer Core",   desc: "Self-attention over the entire orchard. Context window: unlimited avocados." },
    orchard_cloud:    { baseCost: 3.3e8,  costGrowth: 1.15, baseRate: 44000,  title: "Orchard Cloud",      desc: "Avocados-as-a-Service. AaaS." },
    foundation_model: { baseCost: 5e10,   costGrowth: 1.15, baseRate: 200000, title: "Foundation Model",   desc: "It learned everything. From avocados. Somehow that was enough." },
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
    // Throughput Clicking chain — scales clicks with base APS (before multipliers)
    throughput_click_1: { cost: 500,   unlockAt: 1,  producerId: "influencer", apsPctPerClick: 0.03, title: "Throughput Clicking I",   desc: "Each click also adds 3% of your base APS." },
    throughput_click_2: { cost: 5000,  unlockAt: 5,  producerId: "influencer", requiresUpgrade: "throughput_click_1", apsPctPerClick: 0.06, title: "Throughput Clicking II",  desc: "Each click also adds 6% of your base APS." },
    throughput_click_3: { cost: 50000, unlockAt: 25, producerId: "influencer", requiresUpgrade: "throughput_click_2", guacUnlockAt: 50, apsPctPerClick: 0.10, title: "Throughput Clicking III", desc: "Each click also adds 10% of your base APS." },
    attention_focus:   { cost: 2e6,   unlockAt: 5,  producerId: "attention_head", prodMult: 2, title: "Multi-Head Attention",  desc: "Attention Heads produce 2x" },
    transformer_scale: { cost: 5e8,   unlockAt: 5,  producerId: "transformer",    prodMult: 2, title: "Scaling Laws",          desc: "Transformer Cores produce 2x" },
  },

  wisdomUnlocks: {
    guac_memory_1:     { wisdomCost: 3,  title: "Guac Memory I",         desc: "produceExponent +0.02 per prestige completed" },
    guac_memory_2:     { wisdomCost: 10, title: "Guac Memory II",        desc: "consumeExponent -0.01 per prestige completed" },
    infinite_guac:     { wisdomCost: 25, title: "Infinite Guac Theory",  desc: "consumeExponent floor lowered from 0.50 to 0.35" },
  },

  benchmarks: {
    first_inference:    { title: "First Inference",               desc: "Click once." },
    hello_world:        { title: "Hello, World",                  desc: "Reach 1 APS.",                          globalMult: 0.02 },
    batch_processing:   { title: "Batch Processing",              desc: "Own 10 Avocado Saplings." },
    overfitting:        { title: "Overfitting",                   desc: "Buy all click upgrades.",               clickMult: 0.05 },
    feature_extraction: { title: "Feature Extraction",            desc: "Reach 100 APS.",                        globalMult: 0.03 },
    first_epoch:        { title: "First Epoch",                   desc: "Own 5+ of any 3 different producers." },
    guac_online:        { title: "Guac Protocol Online",          desc: "Produce first guac.",                   guacProdMult: 0.05 },
    data_pipeline:      { title: "Data Pipeline",                 desc: "Own 5 Irrigation Drones and 5 Orchard Rows." },
    gradient_descent:   { title: "Gradient Descent",              desc: "Reach 1,000 APS.",                      globalMult: 0.05 },
    attention_is_all:   { title: "Attention Is All You Need",     desc: "Own 1 Attention Head." },
    loss_convergence:   { title: "Loss Convergence",              desc: "Accumulate 100 guac.",                  guacMult: 0.03 },
    singularity:        { title: "The Singularity",               desc: "Reach 10,000 APS." },
    convergence:        { title: "Convergence",                   desc: "Prestige for the first time.",          wisdomMult: 0.05 },
    fine_tuning:        { title: "Fine-Tuning",                   desc: "Complete 3 prestiges.",                 globalMult: 0.03 },
    transfer_learning:  { title: "Transfer Learning",             desc: "Buy all 3 wisdom unlocks." },
    agi_achieved:       { title: "AGI Achieved",                  desc: "Accumulate 50 lifetime wisdom.",        globalMult: 0.05 },
    superintelligence:  { title: "Superintelligence",             desc: "Reach 100,000 APS.",                    globalMult: 0.10 },
    paperclip_moment:   { title: "The Paperclip Moment",          desc: "1 billion all-time avocados." },
  },

  hyperparams: {
    cooldownMs: 180000, // 3 minutes
    warmupDurationMs: 60000, // 60 seconds
    learningRate: {
      conservative: { label: "Conservative", desc: "No change.", apsMult: 1, guacConsumeMult: 1 },
      aggressive:   { label: "Aggressive",   desc: "Fast convergence, high compute cost.", apsMult: 1.3, guacConsumeMult: 1.2 },
      warmup:       { label: "Warmup",       desc: "Slow start, strong finish.", apsMult: 0.85, apsMultAfterWarmup: 1.2 },
    },
    batchSize: {
      small: { label: "Small",  desc: "No change.", apsMult: 1, clickMult: 1 },
      large: { label: "Large",  desc: "Parallelism over interactivity.", apsMult: 1.5, clickMult: 0.7 },
      micro: { label: "Micro",  desc: "SGD with momentum. Click harder.", apsMult: 0.8, clickMult: 1.8 },
    },
    regularization: {
      none:         { label: "None",         desc: "No change." },
      dropout:      { label: "Dropout",      desc: "Prevents overfitting to current run.", freezeGuacMult: true, wisdomMult: 1.15 },
      weight_decay: { label: "Weight Decay", desc: "Smaller model, same performance.", costMult: 0.9, globalMult: 0.95 },
    },
  },

  prestige: {
    unlockThreshold: 1e6,         // total avocados this run to unlock prestige
    divisor: 1000,                // wisdom = floor(sqrt(total) / divisor)
    wisdomMultPerPoint: 0.10,     // +10% per wisdom point
  },

  distillation: {
    costs: [100, 250, 500, 1000, 2000], // wisdom cost for each distillation (v1.0 through v5.0)
    bonuses: [
      { apsMult: 1.5, wisdomEarnMult: 1.2, desc: "Base APS x1.5, wisdom earn rate x1.2", flavor: "Knowledge compressed. Inference faster." },
      { baseClickBonus: 1, guacProdMult: 1.3, desc: "+1 base click power, guac production x1.3", flavor: "Attention weights optimized." },
      { costMult: 0.90, startingWisdom: 2, desc: "Producer costs x0.90, +2 starting wisdom on prestige", flavor: "Quantized. Smaller, same performance." },
      { multiplierPerSqrtBonus: 0.02, consumeFloorBonus: -0.05, desc: "Guac mult 0.10\u21920.12, consume floor -0.05", flavor: "Architecture breakthrough." },
      { allProdMult: 2.0, unlocksFoundationModel: true, desc: "All production x2.0, unlock Foundation Model", flavor: "You have built AGI." },
    ],
  },
};

export const PRODUCER_ORDER = [
  "influencer", "sapling", "orchard_row", "drone", "guac_lab", "guac_refinery",
  "exchange", "attention_head", "pit_miner", "neural_pit", "transformer", "orchard_cloud",
  "foundation_model",
];
