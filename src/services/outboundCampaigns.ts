import { DateTime } from 'luxon';
import type { SentMessage } from '../lib/integrations/messaging/types.js';

export const WINBACK_INACTIVE_MIN_DAYS = 21;
export const WINBACK_INACTIVE_MAX_DAYS = 60;
export const WINBACK_COOLDOWN_DAYS = 30;
export const WINBACK_DAILY_LIMIT = 50;

export const BIRTHDAY_TREAT_WINDOW_DAYS = 7;
/** Treat claim valid only after we sent the birthday outbound message. */
export const BIRTHDAY_MSG_LOOKBACK_DAYS = 14;
export const BIRTHDAY_TREAT_TAG = 'birthday-treat';

/** True when the provider accepted the message (all channels failed → false). */
export function isOutboundDelivered(result: SentMessage): boolean {
  return Boolean(result.providerMessageId);
}

export function buildWinbackBody(firstName: string | null, salonName: string): string {
  return (
    `Hey ${firstName ?? 'there'}! We miss you at ${salonName}. ` +
    `It's been a while — reply 1 to book your next appointment. ` +
    `Reply STOP to opt out of these messages.`
  );
}

export function buildBirthdayBody(firstName: string | null, salonName: string): string {
  return (
    `Happy birthday ${firstName ?? 'there'}! 🎂 From all of us at ${salonName} — ` +
    `wishing you a wonderful day! As our gift, reply BIRTHDAY for a special treat.`
  );
}

/**
 * True when `now` (salon timezone) is within ±windowDays of the customer's
 * birthday anniversary. Handles year boundaries and 29 Feb → 28 Feb fallback.
 */
export function isWithinBirthdayWindow(
  dateOfBirth: Date,
  timezone: string,
  windowDays = BIRTHDAY_TREAT_WINDOW_DAYS,
  nowInput?: DateTime,
): boolean {
  const now = (nowInput ?? DateTime.now()).setZone(timezone).startOf('day');
  const dob = DateTime.fromJSDate(dateOfBirth, { zone: 'utc' });
  if (!dob.isValid) return false;

  for (const year of [now.year - 1, now.year, now.year + 1]) {
    let anniversary = DateTime.fromObject(
      { year, month: dob.month, day: dob.day },
      { zone: timezone },
    );
    if (!anniversary.isValid && dob.month === 2 && dob.day === 29) {
      anniversary = DateTime.fromObject({ year, month: 2, day: 28 }, { zone: timezone });
    }
    if (!anniversary.isValid) continue;
    if (Math.abs(anniversary.startOf('day').diff(now, 'days').days) <= windowDays) {
      return true;
    }
  }
  return false;
}

/** Month/day for birthday SQL matching in the salon's local timezone. */
export function birthdayPartsForTimezone(
  timezone: string,
  nowInput?: DateTime,
): { month: number; day: number; includeLeapDay: boolean } {
  const today = (nowInput ?? DateTime.now()).setZone(timezone);
  return {
    month: today.month,
    day: today.day,
    includeLeapDay: today.month === 2 && today.day === 28 && !today.isInLeapYear,
  };
}
