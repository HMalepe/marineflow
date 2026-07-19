import { DateTime } from 'luxon';
import { getCachedBusinessHours } from '../services/cachedQueries.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function localMinutesNow(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** 0=Sunday .. 6=Saturday — matches Prisma BusinessHour.dayOfWeek / slots.ts */
export function localDayOfWeekSun0(now: Date, timezone: string): number {
  const dt = DateTime.fromJSDate(now, { zone: timezone });
  if (!dt.isValid) return now.getDay();
  return dt.weekday === 7 ? 0 : dt.weekday;
}

export function formatMinutesAsHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseHmToMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function isWithinMinuteRange(nowMin: number, openMin: number, closeMin: number): boolean {
  if (closeMin <= openMin) return nowMin >= openMin || nowMin < closeMin;
  return nowMin >= openMin && nowMin < closeMin;
}

/** Legacy fallback when a salon has no BusinessHour rows yet. */
function isWithinLegacyOpenClose(
  salon: { timezone: string; openTime?: string | null; closeTime?: string | null },
  now: Date,
): boolean {
  const openMin = parseHmToMin(salon.openTime ?? '09:00');
  const closeMin = parseHmToMin(salon.closeTime ?? '17:00');
  return isWithinMinuteRange(localMinutesNow(now, salon.timezone), openMin, closeMin);
}

/**
 * Open/closed for handoff + Hours replies — uses per-day BusinessHour rows
 * (same source as booking slots), not only salon.openTime/closeTime.
 */
export async function isSalonOpenNow(
  salon: {
    id: string;
    timezone: string;
    openTime?: string | null;
    closeTime?: string | null;
  },
  now = new Date(),
): Promise<boolean> {
  const hours = await getCachedBusinessHours(salon.id);
  if (hours.length === 0) {
    return isWithinLegacyOpenClose(salon, now);
  }

  const day = localDayOfWeekSun0(now, salon.timezone);
  const row = hours.find((h) => h.dayOfWeek === day);
  if (!row) return false;

  return isWithinMinuteRange(localMinutesNow(now, salon.timezone), row.openMin, row.closeMin);
}

/** Human-readable weekly hours for the WhatsApp Hours menu. */
export async function formatSalonHoursReply(
  salon: {
    id: string;
    timezone: string;
    openTime?: string | null;
    closeTime?: string | null;
  },
  now = new Date(),
): Promise<string> {
  const hours = await getCachedBusinessHours(salon.id);
  const isOpen = await isSalonOpenNow(salon, now);
  const status = isOpen ? '✅ open' : '🔴 closed';

  if (hours.length === 0) {
    const open = salon.openTime ?? '09:00';
    const close = salon.closeTime ?? '17:00';
    return `🕐 *Business hours*\n\nMon–Sat: ${open} – ${close}\n\nWe are currently ${status}.`;
  }

  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
  // Show Mon→Sun for SA salons
  const order = [1, 2, 3, 4, 5, 6, 0];
  const lines = order.map((d) => {
    const row = byDay.get(d);
    const label = DAY_LABELS[d] ?? `Day ${d}`;
    if (!row) return `${label}: Closed`;
    return `${label}: ${formatMinutesAsHm(row.openMin)} – ${formatMinutesAsHm(row.closeMin)}`;
  });

  return `🕐 *Business hours*\n\n${lines.join('\n')}\n\nWe are currently ${status}.`;
}
