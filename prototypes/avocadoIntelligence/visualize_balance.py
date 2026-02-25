"""Avocado Intelligence — Balance Visualization Charts"""

import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np
import os

# Match the game's dark theme
BG = "#0f1210"
PANEL = "#151a17"
TEXT = "#e8f0e8"
MUTED = "#8fa896"
GREEN = "#4a7c3f"
ACCENT = "#5a9a4d"

plt.rcParams.update({
    "figure.facecolor": BG,
    "axes.facecolor": PANEL,
    "axes.edgecolor": MUTED,
    "axes.labelcolor": TEXT,
    "xtick.color": MUTED,
    "ytick.color": MUTED,
    "text.color": TEXT,
    "legend.facecolor": PANEL,
    "legend.edgecolor": MUTED,
    "legend.labelcolor": TEXT,
    "font.size": 11,
    "axes.titlesize": 14,
    "axes.titleweight": "bold",
})

COLORS = ["#4a7c3f", "#7ec87e", "#3a9fbf", "#e8c547", "#e87347",
           "#c75da8", "#47b8e0", "#f0a030", "#d04b3d", "#8888cc",
           "#50c878", "#ff6f61", "#6b5b95"]

OUT_DIR = os.path.join(os.path.dirname(__file__), "charts")
os.makedirs(OUT_DIR, exist_ok=True)

# --- Tuning data (from tuning.js) ---
PRODUCERS = {
    "Sapling":          {"baseCost": 10,      "baseRate": 0.2},
    "Orchard Row":      {"baseCost": 100,     "baseRate": 1},
    "Influencer":       {"baseCost": 5,       "baseRate": 0,    "note": "click bonus only"},
    "Drone":            {"baseCost": 1100,    "baseRate": 8},
    "Guac Lab":         {"baseCost": 12000,   "baseRate": 50},
    "Guac Refinery":    {"baseCost": 50000,   "baseRate": 0,    "note": "utility"},
    "Exchange":         {"baseCost": 130000,  "baseRate": 260},
    "Attention Head":   {"baseCost": 800000,  "baseRate": 900},
    "Pit Miner":        {"baseCost": 1.4e6,   "baseRate": 1400},
    "Neural Pit":       {"baseCost": 2e7,     "baseRate": 7800},
    "Transformer":      {"baseCost": 1.5e8,   "baseRate": 28000},
    "Orchard Cloud":    {"baseCost": 3.3e8,   "baseRate": 44000},
    "Foundation Model": {"baseCost": 5e10,    "baseRate": 200000},
}

COST_GROWTH = 1.15

GUAC = {
    "baseConsumption": 50,
    "consumeExponent": 0.85,
    "consumeExponentFloor": 0.5,
    "baseProduction": 1,
    "produceExponent": 1.0,
    "multiplierPerSqrt": 0.10,
}

PRESTIGE = {
    "unlockThreshold": 1e6,
    "divisor": 1000,
    "wisdomMultPerPoint": 0.10,
}

DISTILL_COSTS = [100, 250, 500, 1000, 2000]


def fmt_num(n):
    if n >= 1e9: return f"{n/1e9:.1f}B"
    if n >= 1e6: return f"{n/1e6:.1f}M"
    if n >= 1e3: return f"{n/1e3:.1f}K"
    return f"{n:.0f}"


# ========== CHART 1: Producer Cost Curves ==========
def chart_producer_costs():
    fig, ax = plt.subplots(figsize=(12, 7))
    ax.set_title("Producer Cost Scaling (1.15x per unit)")
    ax.set_xlabel("Units Owned")
    ax.set_ylabel("Cost (avocados)")

    x = np.arange(0, 50)
    producers_with_rate = {k: v for k, v in PRODUCERS.items()
                           if v["baseRate"] > 0 and k != "Foundation Model"}

    for i, (name, p) in enumerate(producers_with_rate.items()):
        costs = p["baseCost"] * (COST_GROWTH ** x)
        ax.plot(x, costs, color=COLORS[i % len(COLORS)], linewidth=2, label=name)

    ax.set_yscale("log")
    ax.legend(loc="upper left", fontsize=9)
    ax.grid(True, alpha=0.15, color=MUTED)
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda v, _: fmt_num(v)))
    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "1_producer_costs.png"), dpi=150)
    plt.close(fig)


# ========== CHART 2: Producer Efficiency (Rate / Cost) ==========
def chart_producer_efficiency():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

    names = []
    base_costs = []
    base_rates = []
    efficiencies = []

    for name, p in PRODUCERS.items():
        if p["baseRate"] > 0 and name != "Foundation Model":
            names.append(name)
            base_costs.append(p["baseCost"])
            base_rates.append(p["baseRate"])
            efficiencies.append(p["baseRate"] / p["baseCost"])

    y = np.arange(len(names))

    # Left: base rate per tier
    ax1.set_title("Base Production Rate by Tier")
    ax1.barh(y, base_rates, color=COLORS[:len(names)], height=0.6)
    ax1.set_yticks(y)
    ax1.set_yticklabels(names, fontsize=9)
    ax1.set_xlabel("Avocados/sec per unit")
    ax1.set_xscale("log")
    ax1.xaxis.set_major_formatter(ticker.FuncFormatter(lambda v, _: fmt_num(v)))
    ax1.invert_yaxis()
    ax1.grid(True, axis="x", alpha=0.15, color=MUTED)

    # Right: efficiency (rate / first-unit cost)
    ax2.set_title("Efficiency: Rate / First-Unit Cost")
    ax2.barh(y, efficiencies, color=COLORS[:len(names)], height=0.6)
    ax2.set_yticks(y)
    ax2.set_yticklabels(names, fontsize=9)
    ax2.set_xlabel("APS per avocado spent")
    ax2.set_xscale("log")
    ax2.invert_yaxis()
    ax2.grid(True, axis="x", alpha=0.15, color=MUTED)

    fig.suptitle("Producer Tier Comparison", fontsize=14, fontweight="bold", y=1.01)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "2_producer_efficiency.png"), dpi=150)
    plt.close(fig)


# ========== CHART 3: Guac System — Consumption vs Production ==========
def chart_guac_system():
    fig, axes = plt.subplots(1, 3, figsize=(16, 5.5))

    labs = np.arange(1, 101)

    # Panel 1: Consumption vs Production
    ax = axes[0]
    ax.set_title("Guac Labs: Consume vs Produce")
    consume = GUAC["baseConsumption"] * (labs ** GUAC["consumeExponent"])
    produce = GUAC["baseProduction"] * (labs ** GUAC["produceExponent"])
    ax.plot(labs, consume, color="#e87347", linewidth=2, label="Avo consumed/s")
    ax.plot(labs, produce, color="#7ec87e", linewidth=2, label="Guac produced/s")
    ax.set_xlabel("Number of Guac Labs")
    ax.set_ylabel("Rate per second")
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.15, color=MUTED)

    # Panel 2: Consume exponent effects
    ax = axes[1]
    ax.set_title("Consumption at Different Exponents")
    for exp, label, color in [
        (0.85, "Base (0.85)", "#e87347"),
        (0.75, "With upgrades (0.75)", "#e8c547"),
        (0.60, "Heavy invest (0.60)", "#3a9fbf"),
        (0.50, "Floor (0.50)", "#7ec87e"),
        (0.35, "Infinite Guac (0.35)", "#4a7c3f"),
    ]:
        c = GUAC["baseConsumption"] * (labs ** exp)
        ax.plot(labs, c, color=color, linewidth=2, label=label)
    ax.set_xlabel("Number of Guac Labs")
    ax.set_ylabel("Avo consumed/s")
    ax.legend(fontsize=8)
    ax.grid(True, alpha=0.15, color=MUTED)

    # Panel 3: Guac multiplier growth
    ax = axes[2]
    ax.set_title("Guac Multiplier Growth")
    guac_amounts = np.arange(0, 2001)
    mult = 1 + np.sqrt(guac_amounts) * GUAC["multiplierPerSqrt"]
    ax.plot(guac_amounts, mult, color=GREEN, linewidth=2.5)
    ax.set_xlabel("Guacamole Accumulated")
    ax.set_ylabel("Guac Multiplier")
    ax.axhline(y=2, color=MUTED, linestyle="--", alpha=0.4, linewidth=1)
    ax.axhline(y=3, color=MUTED, linestyle="--", alpha=0.4, linewidth=1)
    ax.axhline(y=4, color=MUTED, linestyle="--", alpha=0.4, linewidth=1)
    ax.text(200, 2.08, "x2.0 (100 guac)", color=MUTED, fontsize=8)
    ax.text(600, 3.08, "x3.0 (400 guac)", color=MUTED, fontsize=8)
    ax.text(1100, 4.08, "x4.0 (900 guac)", color=MUTED, fontsize=8)
    ax.grid(True, alpha=0.15, color=MUTED)

    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "3_guac_system.png"), dpi=150)
    plt.close(fig)


# ========== CHART 4: Prestige & Wisdom Scaling ==========
def chart_prestige_scaling():
    fig, axes = plt.subplots(1, 3, figsize=(16, 5.5))

    # Panel 1: Wisdom earned vs total avocados
    ax = axes[0]
    ax.set_title("Wisdom Earned per Prestige")
    total = np.logspace(6, 11, 500)  # 1M to 100B
    wisdom = np.floor(np.sqrt(total) / PRESTIGE["divisor"])
    ax.plot(total, wisdom, color=GREEN, linewidth=2.5)
    ax.set_xlabel("Total Avocados This Run")
    ax.set_ylabel("Wisdom Earned")
    ax.set_xscale("log")
    ax.xaxis.set_major_formatter(ticker.FuncFormatter(lambda v, _: fmt_num(v)))
    ax.grid(True, alpha=0.15, color=MUTED)
    # Annotate key points
    for t, label in [(1e6, "1M"), (1e7, "10M"), (1e8, "100M"), (1e9, "1B")]:
        w = np.floor(np.sqrt(t) / PRESTIGE["divisor"])
        ax.annotate(f"{label}\n= {int(w)} wis", xy=(t, w), fontsize=8,
                    color=MUTED, ha="center", va="bottom")

    # Panel 2: Wisdom multiplier
    ax = axes[1]
    ax.set_title("Wisdom Multiplier")
    wisdom_pts = np.arange(0, 101)
    base_mult = 1 + wisdom_pts * PRESTIGE["wisdomMultPerPoint"]
    boosted_mult = 1 + wisdom_pts * (PRESTIGE["wisdomMultPerPoint"] + 0.05)
    ax.plot(wisdom_pts, base_mult, color="#7ec87e", linewidth=2, label="Base (+10%/pt)")
    ax.plot(wisdom_pts, boosted_mult, color="#3a9fbf", linewidth=2, label="With wisdom_boost (+15%/pt)")
    ax.set_xlabel("Wisdom Points")
    ax.set_ylabel("Multiplier")
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.15, color=MUTED)

    # Panel 3: Distillation cost curve
    ax = axes[2]
    ax.set_title("Distillation Costs (Lifetime Wisdom)")
    versions = np.arange(1, len(DISTILL_COSTS) + 1)
    ax.bar(versions, DISTILL_COSTS, color=COLORS[:len(DISTILL_COSTS)], width=0.6)
    for i, cost in enumerate(DISTILL_COSTS):
        ax.text(i + 1, cost + 30, str(cost), ha="center", fontsize=10, color=TEXT)
    ax.set_xlabel("Model Version")
    ax.set_ylabel("Wisdom Cost")
    ax.set_xticks(versions)
    ax.set_xticklabels([f"v{v}.0" for v in versions])
    ax.grid(True, axis="y", alpha=0.15, color=MUTED)

    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "4_prestige_and_distillation.png"), dpi=150)
    plt.close(fig)


# ========== CHART 5: Combined Multiplier Stacking ==========
def chart_multiplier_stacking():
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    # Panel 1: How multipliers stack over a run
    ax = axes[0]
    ax.set_title("Multiplier Stacking Through a Run")

    guac_range = np.arange(0, 501)
    guac_mult = 1 + np.sqrt(guac_range) * GUAC["multiplierPerSqrt"]

    # Simulate wisdom values
    wisdom_values = [0, 5, 10, 20, 50]
    for w in wisdom_values:
        wisdom_mult = 1 + w * PRESTIGE["wisdomMultPerPoint"]
        total = guac_mult * wisdom_mult
        ax.plot(guac_range, total, linewidth=2,
                label=f"Wisdom={w} (x{wisdom_mult:.1f})")

    ax.set_xlabel("Guacamole Accumulated")
    ax.set_ylabel("Total Multiplier (Guac x Wisdom)")
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.15, color=MUTED)

    # Panel 2: Benchmark cumulative bonus progression
    ax = axes[1]
    ax.set_title("Benchmark Global Bonus (Cumulative)")

    benchmark_globals = [
        ("Hello World", 0.02),
        ("Feature Extraction", 0.03),
        ("Gradient Descent", 0.05),
        ("Fine-Tuning", 0.03),
        ("AGI Achieved", 0.05),
        ("Superintelligence", 0.10),
    ]
    names = [b[0] for b in benchmark_globals]
    cumulative = []
    running = 1.0
    for _, bonus in benchmark_globals:
        running += bonus
        cumulative.append(running)

    y = np.arange(len(names))
    bars = ax.barh(y, [c - 1 for c in cumulative], left=1, color=COLORS[:len(names)], height=0.5)
    ax.set_yticks(y)
    ax.set_yticklabels(names, fontsize=9)
    ax.set_xlabel("Global Multiplier from Benchmarks")
    ax.invert_yaxis()
    ax.axvline(x=1, color=MUTED, linestyle="-", alpha=0.3)
    for i, c in enumerate(cumulative):
        ax.text(c + 0.005, i, f"x{c:.2f}", va="center", fontsize=9, color=TEXT)
    ax.set_xlim(0.98, 1.35)
    ax.grid(True, axis="x", alpha=0.15, color=MUTED)

    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "5_multiplier_stacking.png"), dpi=150)
    plt.close(fig)


# ========== CHART 6: Full Game Progression Overview ==========
def chart_game_progression():
    fig, ax = plt.subplots(figsize=(14, 7))
    ax.set_title("Game Progression: APS Milestones & Unlock Gates")

    # Key milestones on a log scale
    milestones = [
        (0.2, "First Sapling", "#4a7c3f"),
        (1, "1 APS (Hello World)", "#7ec87e"),
        (50, "Guac Labs unlock", "#3a9fbf"),
        (100, "100 APS (Feature Extraction)", "#e8c547"),
        (1000, "1K APS (Gradient Descent)", "#e87347"),
        (10000, "10K APS (Singularity)", "#c75da8"),
        (100000, "100K APS (Superintelligence)", "#ff6f61"),
    ]

    # Also show prestige gates
    prestige_gates = [
        (1e6, "Prestige unlocks\n(1M total avo)", "#8888cc"),
    ]

    y_pos = np.arange(len(milestones))
    aps_vals = [m[0] for m in milestones]
    labels = [m[1] for m in milestones]
    colors = [m[2] for m in milestones]

    bars = ax.barh(y_pos, aps_vals, color=colors, height=0.5, alpha=0.85)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=10)
    ax.set_xscale("log")
    ax.set_xlabel("Avocados per Second (APS)")
    ax.invert_yaxis()
    ax.grid(True, axis="x", alpha=0.15, color=MUTED)
    ax.xaxis.set_major_formatter(ticker.FuncFormatter(lambda v, _: fmt_num(v)))

    for i, val in enumerate(aps_vals):
        ax.text(val * 1.3, i, fmt_num(val), va="center", fontsize=9, color=TEXT)

    # Add producer tier annotations on right side
    producer_tiers = [
        (0.2, "Saplings"),
        (8, "Drones"),
        (50, "Guac Labs"),
        (260, "Exchange"),
        (900, "Attn Heads"),
        (7800, "Neural Pit"),
        (44000, "Orch. Cloud"),
    ]
    for aps, name in producer_tiers:
        ax.axvline(x=aps, color=MUTED, linestyle=":", alpha=0.25)

    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "6_game_progression.png"), dpi=150)
    plt.close(fig)


# ========== CHART 7: Distillation Bonus Buildup ==========
def chart_distillation_bonuses():
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_title("Cumulative Distillation Bonuses by Model Version")

    versions = ["v0.0\n(base)", "v1.0", "v2.0", "v3.0", "v4.0", "v5.0"]
    categories = ["APS Mult", "Wisdom Earn", "Guac Prod", "Cost Mult", "All Prod"]

    # Build cumulative values
    data = {
        "APS Mult":    [1.0, 1.5, 1.5, 1.5, 1.5, 1.5],
        "Wisdom Earn": [1.0, 1.2, 1.2, 1.2, 1.2, 1.2],
        "Guac Prod":   [1.0, 1.0, 1.3, 1.3, 1.3, 1.3],
        "Cost Mult":   [1.0, 1.0, 1.0, 0.9, 0.9, 0.9],
        "All Prod":    [1.0, 1.0, 1.0, 1.0, 1.0, 2.0],
    }

    x = np.arange(len(versions))
    width = 0.15
    for i, (cat, vals) in enumerate(data.items()):
        offset = (i - len(categories) / 2 + 0.5) * width
        bars = ax.bar(x + offset, vals, width, label=cat, color=COLORS[i], alpha=0.85)

    ax.set_xticks(x)
    ax.set_xticklabels(versions)
    ax.set_ylabel("Multiplier Value")
    ax.axhline(y=1.0, color=MUTED, linestyle="--", alpha=0.3)
    ax.legend(fontsize=9, loc="upper left")
    ax.grid(True, axis="y", alpha=0.15, color=MUTED)
    ax.set_ylim(0, 2.3)

    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "7_distillation_bonuses.png"), dpi=150)
    plt.close(fig)


# ========== Run all ==========
if __name__ == "__main__":
    chart_producer_costs()
    print("  1/7  Producer cost curves")
    chart_producer_efficiency()
    print("  2/7  Producer efficiency comparison")
    chart_guac_system()
    print("  3/7  Guac system (consume/produce/multiplier)")
    chart_prestige_scaling()
    print("  4/7  Prestige & distillation costs")
    chart_multiplier_stacking()
    print("  5/7  Multiplier stacking")
    chart_game_progression()
    print("  6/7  Game progression milestones")
    chart_distillation_bonuses()
    print("  7/7  Distillation bonus buildup")
    print(f"\nAll charts saved to: {OUT_DIR}/")
