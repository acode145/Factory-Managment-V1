// ==============================================================================
// Factory-Management v1 - Unit Conversion & Formatting Utility
// Textile Industry Standard: 1 Yard = 0.9144 Meters (1 Meter ≈ 1.093613 Yards)
// ==============================================================================

export const YARD_TO_METER = 0.9144;
export const METER_TO_YARD = 1 / 0.9144; // 1.093613298337...
export const METERS_TO_YARDS = METER_TO_YARD;

/**
 * Converts meters to yards rounded to specified decimals
 */
export function metersToYards(meters: number, decimals: number = 2): number {
  if (isNaN(meters) || meters === 0) return 0;
  return Number((meters * METER_TO_YARD).toFixed(decimals));
}

/**
 * Converts yards to meters rounded to specified decimals (yards * 0.9144)
 */
export function yardsToMeters(yards: number, decimals: number = 2): number {
  if (isNaN(yards) || yards === 0) return 0;
  return Number((yards * YARD_TO_METER).toFixed(decimals));
}

/**
 * Converts any quantity to canonical standard meters if continuous fabric
 */
export function convertToStandardMeters(qty: number, unit: string): number | null {
  if (unit === "PIECES" || unit === "pcs") return null;
  if (unit === "YARDS" || unit === "yd" || unit === "yds") {
    return yardsToMeters(qty, 2);
  }
  return Number(qty.toFixed(2));
}

/**
 * Formats a metric quantity into dual measurement string: "9,900.00 m (10,826.77 yd)"
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
 * Formats given quantity with its companion unit for continuous fabric or simple count for pieces
 */
export function formatUnitWithCompanion(qty: number, unit: string, decimals: number = 2): { primary: string; secondary: string | null } {
  if (unit === "PIECES" || unit === "pcs") {
    return {
      primary: `${Math.round(qty).toLocaleString()} pcs`,
      secondary: null,
    };
  }

  if (unit === "YARDS" || unit === "yd" || unit === "yds") {
    const equivMeters = yardsToMeters(qty, decimals);
    return {
      primary: `${qty.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} yd`,
      secondary: `≈ ${equivMeters.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} m`,
    };
  }

  // Default METERS
  const equivYards = metersToYards(qty, decimals);
  return {
    primary: `${qty.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} m`,
    secondary: `≈ ${equivYards.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} yd`,
  };
}

/**
 * Computes difference between claimed and measured quantities
 */
export function computeDiscrepancy(challanQty: number, measuredQty: number, unit: string = "METERS") {
  const diff = Number((challanQty - measuredQty).toFixed(2));
  const percent = challanQty > 0 ? Number(((Math.abs(diff) / challanQty) * 100).toFixed(2)) : 0;
  const isShortage = diff > 0;
  const isSurplus = diff < 0;
  const isExact = diff === 0;

  if (unit === "PIECES" || unit === "pcs") {
    const absPcs = Math.abs(Math.round(diff));
    return {
      isShortage,
      isSurplus,
      isExact,
      diffQty: absPcs,
      diffSecondary: 0,
      percent,
      formattedPrimary: `${diff > 0 ? "-" : diff < 0 ? "+" : ""}${absPcs} pcs`,
      formattedSecondary: null,
    };
  }

  // Continuous fabric
  const absQty = Math.abs(diff);
  const equivSecondary = unit === "YARDS" || unit === "yd" ? yardsToMeters(absQty) : metersToYards(absQty);
  const secUnitLabel = unit === "YARDS" || unit === "yd" ? "m" : "yd";
  const primUnitLabel = unit === "YARDS" || unit === "yd" ? "yd" : "m";

  return {
    isShortage,
    isSurplus,
    isExact,
    diffQty: absQty,
    diffSecondary: equivSecondary,
    percent,
    formattedPrimary: `${diff > 0 ? "-" : diff < 0 ? "+" : ""}${absQty.toFixed(2)}${primUnitLabel}`,
    formattedSecondary: `≈ ${diff > 0 ? "-" : diff < 0 ? "+" : ""}${equivSecondary.toFixed(2)}${secUnitLabel}`,
  };
}