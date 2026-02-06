/**
 * Stat formatting helpers for consistent sign-driven display
 * Used by Workers UI and other stat displays
 */

/**
 * Format integer with explicit sign
 * @param {number} n - Integer value
 * @returns {string} e.g., "+6", "0", "-2"
 */
export function formatSignedInt(n) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '0';
}

/**
 * Format a 0..1 chance or delta as signed percentage
 * @param {number} chance01 - Value in 0..1 range (or delta like +0.01)
 * @param {number} decimals - Decimal places (default 0)
 * @returns {string} e.g., "+29%", "-1%", "0%"
 */
export function formatSignedPct(chance01, decimals = 0) {
  const pct = chance01 * 100;
  const rounded = pct.toFixed(decimals);
  const num = parseFloat(rounded);
  
  if (num > 0) return `+${rounded}%`;
  if (num < 0) return `${rounded}%`;
  return `0%`;
}

/**
 * Format seconds with explicit sign, avoiding "-0.0s"
 * @param {number} sec - Duration in seconds
 * @param {number} decimals - Decimal places (default 1)
 * @param {number} zeroEpsilon - Threshold for treating as zero (default 1e-6)
 * @returns {string} e.g., "-3.4s", "+0.1s", "0.0s"
 */
export function formatSignedSeconds(sec, decimals = 1, zeroEpsilon = 1e-6) {
  const rounded = parseFloat(sec.toFixed(decimals));
  
  // Avoid -0.0s display
  if (Math.abs(rounded) < zeroEpsilon) {
    return '0.' + '0'.repeat(decimals) + 's';
  }
  
  if (rounded > 0) return `+${rounded.toFixed(decimals)}s`;
  if (rounded < 0) return `${rounded.toFixed(decimals)}s`;
  return `0.${'0'.repeat(decimals)}s`;
}

/**
 * Join stat parts with bullet separator
 * Filters out null/undefined values
 * @param {Array<string>} parts - Stat strings to join
 * @returns {string} e.g., "Batch +6 • Speed -3.4s • Poor +29%"
 */
export function joinStatPills(parts) {
  return parts.filter(p => p != null).join(' • ');
}
