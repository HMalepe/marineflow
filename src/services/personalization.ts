import { DateTime } from 'luxon';

/** Time-of-day greeting in the salon's local timezone. */
export function getTimeGreeting(now: DateTime): string {
  const hour = now.hour;
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * A short, upbeat line a friendly receptionist would say after a customer
 * picks a service/staff/time — rotated so the bot doesn't sound robotic.
 * Picked deterministically off the minute so the same customer doesn't see
 * the same line twice in a row within a fast back-and-forth.
 */
const COMPLIMENTS = [
  'Great choice!',
  'Sharp pick!',
  'Love that one!',
  'Excellent taste!',
  'Nice one!',
  'Solid pick!',
  "That's a popular one!",
  'Good call!',
];

export function pickCompliment(seed = Date.now()): string {
  const idx = Math.floor(seed / 1000) % COMPLIMENTS.length;
  return COMPLIMENTS[idx]!;
}

/**
 * Fixed-date occasions (month/day) plus floating ones we compute per year,
 * surfaced as a one-line nod in the greeting so the bot feels present in the
 * moment rather than generic. Returns null on every other day.
 */
function nthSundayOfMonth(year: number, month: number, n: number): DateTime {
  let d = DateTime.fromObject({ year, month, day: 1 });
  while (d.weekday !== 7) d = d.plus({ days: 1 }); // luxon: Sun=7
  return d.plus({ weeks: n - 1 });
}

export function getOccasionLine(now: DateTime): string | null {
  const { month, day, year } = now;

  const fixed: Record<string, string> = {
    '1-1': "Happy New Year! 🎉 Hope it's off to a great start.",
    '2-14': "Happy Valentine's Day! 💕 Looking sharp for someone special?",
    '10-31': 'Happy Halloween! 🎃',
    '12-24': "Christmas Eve already! 🎄 Let's get you sorted before the big day.",
    '12-25': 'Merry Christmas! 🎄',
    '12-31': "Happy New Year's Eve! 🥂",
  };
  const key = `${month}-${day}`;
  if (fixed[key]) return fixed[key]!;

  // Father's Day — 3rd Sunday of June (US/UK/SA convention).
  const fathersDay = nthSundayOfMonth(year, 6, 3);
  if (now.hasSame(fathersDay, 'day')) return "Happy Father's Day! 👔";

  // Mother's Day (US/SA) — 2nd Sunday of May.
  const mothersDay = nthSundayOfMonth(year, 5, 2);
  if (now.hasSame(mothersDay, 'day')) return "Happy Mother's Day! 💐";

  return null;
}

/** True when today is the customer's birthday, local to the salon's timezone. */
export function isBirthdayToday(now: DateTime, dateOfBirth: Date | null | undefined): boolean {
  if (!dateOfBirth) return false;
  const dob = DateTime.fromJSDate(dateOfBirth);
  return dob.month === now.month && dob.day === now.day;
}
