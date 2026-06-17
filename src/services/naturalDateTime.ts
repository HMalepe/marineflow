import { DateTime } from 'luxon';
import { claudeJson, isAnthropicConfigured } from '../lib/integrations/ai/index.js';
import { logger } from '../lib/logger.js';

export type ParsedDateTime = { localDateStr: string; hour?: number; minute?: number };

const WEEKDAYS: Record<string, number> = {
  sun: 7 % 7, sunday: 7 % 7, // luxon weekday: Mon=1..Sun=7; we normalise to 0=Sun..6=Sat below
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function extractTime(text: string): { hour: number; minute: number } | null {
  // Require an explicit ":mm" or "am/pm" marker — a bare number like the "25" in
  // "25 July" is a day-of-month, not a time, so it must never match here.
  const m = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i) ?? text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (!m) return null;
  let hour = parseInt(m[1]!, 10);
  const minute = m[2] && /^\d+$/.test(m[2]) ? parseInt(m[2], 10) : 0;
  const ampm = (m[2] && !/^\d+$/.test(m[2]) ? m[2] : m[3])?.toLowerCase();
  if (hour > 23 || minute > 59) return null;
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  if (!ampm && hour > 23) return null;
  return { hour, minute };
}

/** Deterministic parse for weekday names, "DD Month"/"Month DD", and explicit DD/MM/YYYY — all with an optional time. */
function parseDeterministic(text: string, timezone: string): ParsedDateTime | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const time = extractTime(t);
  const now = DateTime.now().setZone(timezone).startOf('day');

  // "15 July" / "July 15", optional year — checked before weekday names, since a
  // phrase like "Saturday 25 July" should resolve to the explicit date, not the
  // nearest upcoming Saturday from today.
  const dayMonth = t.match(/\b(\d{1,2})\s+([a-z]+)\b/);
  const monthDay = t.match(/\b([a-z]+)\s+(\d{1,2})\b/);
  const monthName = (dayMonth?.[2] ?? monthDay?.[1])?.toLowerCase();
  const dayNum = dayMonth ? parseInt(dayMonth[1]!, 10) : monthDay ? parseInt(monthDay[2]!, 10) : null;
  if (monthName && dayNum && MONTHS[monthName]) {
    const month = MONTHS[monthName]!;
    const yearMatch = t.match(/\b(20\d{2})\b/);
    let year = yearMatch ? parseInt(yearMatch[1]!, 10) : now.year;
    let dt = DateTime.fromObject({ year, month, day: dayNum }, { zone: timezone });
    if (dt.isValid) {
      if (!yearMatch && dt.startOf('day') < now) {
        dt = dt.plus({ years: 1 });
      }
      return { localDateStr: dt.toISODate()!, ...(time ?? {}) };
    }
  }

  // DD/MM/YYYY
  const slash = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) {
    const dt = DateTime.fromObject(
      { day: parseInt(slash[1]!, 10), month: parseInt(slash[2]!, 10), year: parseInt(slash[3]!, 10) },
      { zone: timezone },
    );
    if (dt.isValid) return { localDateStr: dt.toISODate()!, ...(time ?? {}) };
  }

  // DD/MM (no year) — rolls forward to next year if the date already passed.
  const slashNoYear = t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (slashNoYear) {
    let dt = DateTime.fromObject(
      { day: parseInt(slashNoYear[1]!, 10), month: parseInt(slashNoYear[2]!, 10), year: now.year },
      { zone: timezone },
    );
    if (dt.isValid) {
      if (dt.startOf('day') < now) dt = dt.plus({ years: 1 });
      return { localDateStr: dt.toISODate()!, ...(time ?? {}) };
    }
  }

  // Weekday name, optionally prefixed with "next" — only used when no explicit
  // calendar date was found above.
  const weekdayMatch = t.match(/\b(next\s+)?(sun(day)?|mon(day)?|tue(s|sday)?|wed(s|nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?)\b/);
  if (weekdayMatch) {
    const isNext = Boolean(weekdayMatch[1]);
    const key = weekdayMatch[2]!.replace(/s$/, '').slice(0, 3);
    const wantedLuxonWeekday = WEEKDAYS[weekdayMatch[2]!] ?? WEEKDAYS[key];
    if (wantedLuxonWeekday !== undefined) {
      // Bail to the AI fallback if there's a leftover number we didn't account
      // for (e.g. "15th" in "Saturday 15th", or a spelled-out time like "3
      // thirty") — better to ask Claude than to silently return the nearest
      // Saturday while ignoring a day-of-month or time the customer typed.
      const withoutTime = time ? t.replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b|\b\d{1,2}\s*(am|pm)\b/i, '') : t;
      const withoutWeekday = withoutTime.replace(weekdayMatch[0], '');
      if (/\d/.test(withoutWeekday)) return null;

      const wanted = wantedLuxonWeekday === 0 ? 7 : wantedLuxonWeekday; // luxon Sun=7
      let diff = wanted - now.weekday;
      if (diff <= 0) diff += 7;
      if (isNext) diff += 7;
      const dt = now.plus({ days: diff });
      return { localDateStr: dt.toISODate()!, ...(time ?? {}) };
    }
  }

  return null;
}

/**
 * Parse free-text like "Saturday 15:00", "next Tuesday 2pm", or "15 July 14:00"
 * into a calendar date (+ optional time), so customers can book weeks/months out
 * without scrolling the combined picker. Falls back to a tightly-scoped AI call
 * when the deterministic parser can't make sense of the phrase.
 */
export async function parseNaturalDateTime(
  text: string,
  timezone: string,
): Promise<ParsedDateTime | null> {
  const deterministic = parseDeterministic(text, timezone);
  if (deterministic) return deterministic;

  if (!isAnthropicConfigured()) return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 80) return null;

  try {
    const today = DateTime.now().setZone(timezone);
    const result = await claudeJson<{ date: string | null; hour: number | null; minute: number | null }>({
      system: [
        `Extract a calendar date and optional time from a customer's booking request.`,
        `Today is ${today.toFormat('cccc yyyy-MM-dd')} in timezone ${timezone}.`,
        `Respond ONLY with JSON: {"date": "YYYY-MM-DD" or null, "hour": 0-23 or null, "minute": 0-59 or null}.`,
        `If the message has no identifiable future date, return {"date": null, "hour": null, "minute": null}.`,
      ].join(' '),
      user: trimmed,
      maxTokens: 100,
    });
    if (!result?.date) return null;
    const dt = DateTime.fromISO(result.date, { zone: timezone });
    if (!dt.isValid || dt.startOf('day') < today.startOf('day')) return null;
    return {
      localDateStr: dt.toISODate()!,
      ...(result.hour != null ? { hour: result.hour } : {}),
      ...(result.minute != null ? { minute: result.minute } : {}),
    };
  } catch (err) {
    logger.warn({ err }, 'natural_date_parse_failed');
    return null;
  }
}
