/** Roster API date parsing and range clamping (dashboard GET /roster). */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const ROSTER_MAX_DAYS = 31;

export function parseRosterDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/** Never return more than ROSTER_MAX_DAYS from `from`. */
export function clampRosterEnd(from: Date, to: Date): Date {
  const maxTo = new Date(from.getTime() + (ROSTER_MAX_DAYS - 1) * MS_PER_DAY);
  return to > maxTo ? maxTo : to;
}
