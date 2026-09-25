/**
 * Pakistan Standard Time (PKT - Asia/Karachi, UTC+5) Date Utilities.
 * All factory transactions, challans, transfers, and dashboard displays
 * operate strictly on Pakistan Time and Date.
 */

export const PAKISTAN_TIMEZONE = "Asia/Karachi";

/**
 * Returns today's calendar date in Pakistan (Asia/Karachi) in ISO format (YYYY-MM-DD).
 * Ensures midnight/time-zone shifts don't cause early morning or late night entries
 * to fall into the wrong calendar day.
 */
export function getPakistanTodayIso(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PAKISTAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Format any Date object or ISO timestamp to Pakistan date (DD/MM/YYYY).
 * Irrespective of whether the user or server is in PKT, UTC, US, or Europe,
 * it always renders the exact calendar day in Pakistan.
 */
export function formatPakistanDate(date?: string | Date | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: PAKISTAN_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Format any Date object or ISO timestamp to Pakistan date & time (DD/MM/YYYY, hh:mm A).
 */
export function formatPakistanDateTime(date?: string | Date | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: PAKISTAN_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Parse an incoming user date string (YYYY-MM-DD or DD/MM/YYYY) into a Date object
 * anchored safely at midday (12:00 PM) Pakistan Standard Time (07:00 AM UTC).
 * This guarantees the calendar day remains completely immutable across all time zones.
 */
export function parsePakistanDate(dateStr?: string | null): Date {
  if (!dateStr || !dateStr.trim()) {
    return new Date();
  }
  const clean = dateStr.trim();

  // Pattern: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [year, month, day] = clean.split("-").map(Number);
    // 12:00 PM PKT = 07:00 AM UTC
    return new Date(Date.UTC(year, month - 1, day, 7, 0, 0, 0));
  }

  // Pattern: DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [day, month, year] = clean.split("/").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 7, 0, 0, 0));
  }

  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}
