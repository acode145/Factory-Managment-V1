// ==============================================================================
// Factory-Management v1 - Unit Conversion & Formatting Utility
// Textile Industry Standard: 1 Meter = 1.09361 Yards (1 Yard = 0.9144 Meters)
// ==============================================================================

export const METERS_TO_YARDS = 1.09361;

/**
 * Converts meters to yards rounded to specified decimals
 */
export function metersToYards(meters: number, decimals: number = 2): number {
  if (isNaN(meters) || meters === 0) return 0;
  return Number((meters * METERS_TO_YARDS).toFixed(decimals));
}

/**
 * Converts yards to meters rounded to specified decimals
 */
export function yardsToMeters(yards: number, decimals: number = 2): number {
  if (isNaN(yards) || yards === 0) return 0;
  return Number((yards / METERS_TO_YARDS).toFixed(decimals));
}

/**
 * Formats a metric quantity into dual measurement string: "9,900.00 m (10,826.74 yd)"
 */
export function formatDualUnits(meters: number | null | undefined, decimals: number = 2): string {
  if (meters === null || meters === undefined || isNaN(meters)) return "0.00 m (0.00 yd)";
  const numMeters = Number(meters);
  const numYards = metersToYards(numMeters, decimals);
  return `${numMeters.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} m (${numYards.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} yd)`;
}

/**
 * Computes difference between claimed and measured meters in both units
 */
export function computeDiscrepancy(challanMeters: number, measuredMeters: number) {
  const diffMeters = Number((challanMeters - measuredMeters).toFixed(2));
  const diffYards = metersToYards(Math.abs(diffMeters));
  const percent = challanMeters > 0 ? Number(((Math.abs(diffMeters) / challanMeters) * 100).toFixed(2)) : 0;

  return {
    isShortage: diffMeters > 0,
    isSurplus: diffMeters < 0,
    isExact: diffMeters === 0,
    diffMeters: Math.abs(diffMeters),
    diffYards,
    percent,
    formattedMeters: `${diffMeters > 0 ? "-" : diffMeters < 0 ? "+" : ""}${Math.abs(diffMeters).toFixed(2)}m`,
    formattedYards: `${diffMeters > 0 ? "-" : diffMeters < 0 ? "+" : ""}${diffYards.toFixed(2)}yd`,
  };
}
