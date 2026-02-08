/**
 * Logger Module
 * 
 * Provides a unified logging system with Player and Debug tabs for multiple channels.
 * Each channel (farm, market, etc.) can log to either or both tabs.
 */

const MAX_LINES = 60;

let containers = {
  farmPlayer: null,
  farmDebug: null,
  marketPlayer: null,
  marketDebug: null,
};

/**
 * Initialize the logger with references to log containers
 */
export function initLogger({ farmPlayerEl, farmDebugEl, marketPlayerEl, marketDebugEl }) {
  containers.farmPlayer = farmPlayerEl;
  containers.farmDebug = farmDebugEl;
  containers.marketPlayer = marketPlayerEl;
  containers.marketDebug = marketDebugEl;
}

/**
 * Internal function to add a log line to a container
 */
function addLogLine(container, text, color = null) {
  if (!container) {
    console.warn('Logger: Container not initialized');
    return;
  }

  const div = document.createElement("div");
  div.className = "line";
  if (color) {
    div.classList.add(`log-${color}`);
  }
  div.textContent = text;
  container.prepend(div);

  // Cap lines
  while (container.children.length > MAX_LINES) {
    container.removeChild(container.lastChild);
  }
}

/**
 * Log to the Player tab only
 */
export function logPlayer({ channel, text, color = null }) {
  const containerKey = `${channel}Player`;
  addLogLine(containers[containerKey], text, color);
}

/**
 * Log to the Debug tab only
 */
export function logDebug({ channel, text, color = null }) {
  const containerKey = `${channel}Debug`;
  addLogLine(containers[containerKey], text, color);
}

/**
 * Log to both Player and Debug tabs (optionally with different messages/colors)
 */
export function logEvent({ channel, playerText, debugText, playerColor = null, debugColor = null }) {
  if (playerText) {
    logPlayer({ channel, text: playerText, color: playerColor });
  }
  if (debugText) {
    logDebug({ channel, text: debugText, color: debugColor });
  }
}

/**
 * Clear a specific log container
 */
export function clearLog(channel, tab) {
  const containerKey = `${channel}${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
  const container = containers[containerKey];
  if (container) {
    container.innerHTML = '';
  }
}
