// Achievements full-screen view — grid rendering, category filters, theme selector

import { TUNING, ACHIEVEMENT_CATEGORIES } from "../tuning.js";

const ACHIEVEMENT_ORDER = Object.keys(TUNING.achievements);

export function initAchievementsView({ onBack, onThemeChange, onAcknowledge }) {
  const backBtn = document.getElementById("achievements-back-btn");
  const gridEl = document.getElementById("achievements-grid");
  const filterBarEl = document.getElementById("achievements-filter-bar");
  const subtitleEl = document.getElementById("achievements-subtitle");
  const themeSelectorEl = document.getElementById("achievements-theme-selector");

  if (backBtn) backBtn.addEventListener("click", onBack);

  let activeFilter = "all";

  // Build filter bar
  function buildFilterBar(state) {
    if (!filterBarEl) return;
    filterBarEl.innerHTML = "";

    // "All" tab
    const allBtn = document.createElement("button");
    const totalEarned = ACHIEVEMENT_ORDER.filter(id => state.achievements[id]).length;
    allBtn.className = `achievements-filter-tab${activeFilter === "all" ? " active" : ""}`;
    allBtn.textContent = `All ${totalEarned}/${ACHIEVEMENT_ORDER.length}`;
    allBtn.addEventListener("click", () => { activeFilter = "all"; render(state); });
    filterBarEl.appendChild(allBtn);

    for (const cat of ACHIEVEMENT_CATEGORIES) {
      const catIds = ACHIEVEMENT_ORDER.filter(id => TUNING.achievements[id].category === cat.id);
      const catEarned = catIds.filter(id => state.achievements[id]).length;
      const btn = document.createElement("button");
      btn.className = `achievements-filter-tab${activeFilter === cat.id ? " active" : ""}`;
      btn.textContent = `${cat.emoji} ${catEarned}/${catIds.length}`;
      btn.title = cat.title;
      btn.addEventListener("click", () => { activeFilter = cat.id; render(state); });
      filterBarEl.appendChild(btn);
    }
  }

  // Build grid
  function buildGrid(state) {
    if (!gridEl) return;
    gridEl.innerHTML = "";

    const filteredIds = activeFilter === "all"
      ? ACHIEVEMENT_ORDER
      : ACHIEVEMENT_ORDER.filter(id => TUNING.achievements[id].category === activeFilter);

    const newIds = state.newAchievementIds || new Set();

    for (const id of filteredIds) {
      const cfg = TUNING.achievements[id];
      const earned = !!state.achievements[id];
      const isHidden = !!cfg.hidden;
      const isNew = earned && newIds.has(id);

      const tile = document.createElement("div");
      tile.className = "achievement-tile";
      if (earned) tile.classList.add("earned");
      else if (isHidden) tile.classList.add("hidden-achievement");
      else tile.classList.add("locked");

      if (isNew) {
        tile.classList.add("new");
        tile.addEventListener("mouseenter", () => {
          tile.classList.remove("new");
          newIds.delete(id);
          onAcknowledge?.();
        }, { once: true });
      }

      // Emoji display
      const emojiEl = document.createElement("div");
      emojiEl.className = "achievement-emoji";
      emojiEl.textContent = earned ? cfg.emoji : (isHidden ? "?" : "?");
      tile.appendChild(emojiEl);

      // Tooltip
      const tooltip = document.createElement("div");
      tooltip.className = "achievement-tooltip";
      if (earned) {
        let bonusText = "";
        if (cfg.globalMult) bonusText = `+${Math.round(cfg.globalMult * 100)}% global APS`;
        if (cfg.clickMult) bonusText = `+${Math.round(cfg.clickMult * 100)}% click power`;
        if (cfg.baseClickBonus) bonusText = `+${cfg.baseClickBonus} base click power`;
        if (cfg.guacProdMult) bonusText = `+${Math.round(cfg.guacProdMult * 100)}% guac production`;
        if (cfg.guacMult) bonusText = `+${Math.round(cfg.guacMult * 100)}% guac multiplier`;
        if (cfg.wisdomMult) bonusText = `+${Math.round(cfg.wisdomMult * 100)}% wisdom`;
        tooltip.innerHTML = `<strong>${cfg.title}</strong><br><span class="achievement-tooltip-bonus">${bonusText}</span>`;
      } else if (isHidden) {
        tooltip.innerHTML = `<strong>???</strong><br><em>???</em>`;
      } else {
        tooltip.innerHTML = `<strong>???</strong><br><em>${cfg.hint}</em>`;
      }
      tile.appendChild(tooltip);

      gridEl.appendChild(tile);
    }
  }

  // Build theme selector
  function buildThemeSelector(state) {
    if (!themeSelectorEl) return;
    const themes = state.unlockedThemes || ["default"];
    if (themes.length <= 1) {
      themeSelectorEl.style.display = "none";
      return;
    }
    themeSelectorEl.style.display = "";
    themeSelectorEl.innerHTML = "";

    const label = document.createElement("span");
    label.className = "muted";
    label.textContent = "Theme: ";
    themeSelectorEl.appendChild(label);

    const select = document.createElement("select");
    select.className = "analyzer-select";
    for (const themeId of themes) {
      const opt = document.createElement("option");
      opt.value = themeId;
      opt.textContent = themeId.charAt(0).toUpperCase() + themeId.slice(1);
      if (themeId === (state.activeTheme || "default")) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => onThemeChange(select.value));
    themeSelectorEl.appendChild(select);
  }

  function render(state) {
    const totalEarned = ACHIEVEMENT_ORDER.filter(id => state.achievements[id]).length;
    if (subtitleEl) subtitleEl.textContent = `${totalEarned} / ${ACHIEVEMENT_ORDER.length} earned`;
    buildFilterBar(state);
    buildGrid(state);
    buildThemeSelector(state);
  }

  return { render };
}
