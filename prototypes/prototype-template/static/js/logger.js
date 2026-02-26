/**
 * Generic DOM logger helper for prototype UIs.
 *
 * Extracted from patterns repeated in avocadoIntelligence and treeGroves:
 * - prepend newest line
 * - cap number of lines
 * - optional color class
 * - optional timestamp decoration
 */

function getIsoTimestamp() {
  return new Date().toISOString();
}

function formatTimestamp(mode, isoTs) {
  if (mode === "iso") return isoTs;
  if (mode === "locale") {
    return new Date(isoTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return "";
}

export function createDomLogger({ container, maxLines = 60, timestamp = "none" }) {
  if (!container) {
    throw new Error("createDomLogger requires a container element");
  }

  return function log(message, { color = null } = {}) {
    const div = document.createElement("div");
    div.className = "line";

    if (color) {
      div.classList.add(`log-${color}`);
    }

    const isoTs = getIsoTimestamp();
    const ts = formatTimestamp(timestamp, isoTs);
    if (timestamp !== "none") {
      div.dataset.ts = isoTs;
    }
    div.textContent = ts ? `[${ts}] ${message}` : message;
    container.prepend(div);

    while (container.children.length > maxLines) {
      container.removeChild(container.lastChild);
    }
  };
}

