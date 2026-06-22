import { DateTime } from 'luxon';
import { claudeJson, isAnthropicConfigured } from '../lib/integrations/ai/index.js';
import { logger } from '../lib/logger.js';

/** Fast, reliable model for structured date extraction (JSON). */
const DATE_PARSE_MODEL = 'claude-haiku-4-5-20251001';

export type ParsedDateTime = { localDateStr: string; hour?: number; minute?: number };

export type ParseNaturalDateOptions = {
  /** Salon open dates shown in the picker — helps Claude disambiguate "Saturday" etc. */
  availableDates?: string[];
};

const WEEKDAYS: Record<string, number> = {
  sun: 7 % 7, sunday: 7 % 7,
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

function parseDeterministic(text: string, timezone: string): ParsedDateTime | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const time = extractTime(t);
  const now = DateTime.now().setZone(timezone).startOf('day');

  if (/\btoday\b/.test(t)) {
    return { localDateStr: now.toISODate()!, ...(time ?? {}) };
  }
  if (/\btomorrow\b/.test(t)) {
    return { localDateStr: now.plus({ days: 1 }).toISODate()!, ...(time ?? {}) };
  }
  if (/\bday after tomorrow\b/.test(t)) {
    return { localDateStr: now.plus({ days: 2 }).toISODate()!, ...(time ?? {}) };
  }

  const inDays = t.match(/\bin\s+(\d{1,2})\s+days?\b/);
  if (inDays) {
    const n = parseInt(inDays[1]!, 10);
    if (n >= 1 && n <= 90) {
      return { localDateStr: now.plus({ days: n }).toISODate()!, ...(time ?? {}) };
    }
  }

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

  const slash = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) {
    const dt = DateTime.fromObject(
      { day: parseInt(slash[1]!, 10), month: parseInt(slash[2]!, 10), year: parseInt(slash[3]!, 10) },
      { zone: timezone },
    );
    if (dt.isValid) return { localDateStr: dt.toISODate()!, ...(time ?? {}) };
  }

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

  const weekdayMatch = t.match(/\b(next\s+)?(sun(day)?|mon(day)?|tue(s|sday)?|wed(s|nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?)\b/);
  if (weekdayMatch) {
    const isNext = Boolean(weekdayMatch[1]);
    const key = weekdayMatch[2]!.replace(/s$/, '').slice(0, 3);
    const wantedLuxonWeekday = WEEKDAYS[weekdayMatch[2]!] ?? WEEKDAYS[key];
    if (wantedLuxonWeekday !== undefined) {
      const withoutTime = time ? t.replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b|\b\d{1,2}\s*(am|pm)\b/i, '') : t;
      const withoutWeekday = withoutTime.replace(weekdayMatch[0], '');
      if (/\d/.test(withoutWeekday)) return null;
      // "Saturday in October" etc — a month name elsewhere means the customer is
      // naming a specific occurrence, not just the nearest weekday. Defer to Claude.
      if (Object.keys(MONTHS).some((m) => new RegExp(`\\b${m}\\b`).test(withoutWeekday))) return null;

      const wanted = wantedLuxonWeekday === 0 ? 7 : wantedLuxonWeekday;
      let diff = wanted - now.weekday;
      if (diff <= 0) diff += 7;
      if (isNext) diff += 7;
      const dt = now.plus({ days: diff });
      return { localDateStr: dt.toISODate()!, ...(time ?? {}) };
    }
  }

  return null;
}

function looksLikeNaturalLanguage(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

async function parseWithClaude(
  text: string,
  timezone: string,
  options?: ParseNaturalDateOptions,
): Promise<ParsedDateTime | null> {
  if (!isAnthropicConfigured()) {
    logger.warn(
      { textPreview: text.slice(0, 60) },
      'natural_date_ai_skipped — set ANTHROPIC_API_KEY on the API service',
    );
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 120) return null;

  try {
    const today = DateTime.now().setZone(timezone);
    const avail = options?.availableDates?.slice(0, 14) ?? [];
    const availHint =
      avail.length > 0
        ? ` Open booking dates (YYYY-MM-DD): ${avail.join(', ')}. Prefer matching one of these when the customer is vague.`
        : '';

    const result = await claudeJson<{ date: string | null; hour: number | null; minute: number | null }>({
      model: DATE_PARSE_MODEL,
      system: [
        `You extract a calendar date and optional time from a WhatsApp booking message.`,
        `Today is ${today.toFormat('cccc yyyy-MM-dd')} (${timezone}).${availHint}`,
        `South African customers often write DD/MM, weekday names, or "tomorrow".`,
        `Respond ONLY with JSON: {"date":"YYYY-MM-DD"|null,"hour":0-23|null,"minute":0-59|null}.`,
        `Date must be today or in the future. If no date can be inferred, all fields null.`,
      ].join(' '),
      user: trimmed,
      maxTokens: 120,
    });

    if (!result?.date) {
      logger.info({ textPreview: trimmed.slice(0, 60) }, 'natural_date_ai_no_date');
      return null;
    }

    const dt = DateTime.fromISO(result.date, { zone: timezone });
    if (!dt.isValid || dt.startOf('day') < today.startOf('day')) return null;

    logger.info({ date: result.date, textPreview: trimmed.slice(0, 40) }, 'natural_date_ai_parsed');
    return {
      localDateStr: dt.toISODate()!,
      ...(result.hour != null ? { hour: result.hour } : {}),
      ...(result.minute != null ? { minute: result.minute } : {}),
    };
  } catch (err) {
    logger.warn({ err, textPreview: trimmed.slice(0, 60) }, 'natural_date_ai_failed');
    return null;
  }
}

/**
 * Parse free-text like "Saturday 15:00", "next Tuesday 2pm", or "15 July 14:00".
 * Uses deterministic rules first; calls Claude Haiku when needed for natural language.
 */
export async function parseNaturalDateTime(
  text: string,
  timezone: string,
  options?: ParseNaturalDateOptions,
): Promise<ParsedDateTime | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const deterministic = parseDeterministic(trimmed, timezone);
  const natural = looksLikeNaturalLanguage(trimmed);

  // Simple structured phrases — skip API.
  if (deterministic && !natural) return deterministic;

  // Natural language (or ambiguous) — prefer Claude when configured.
  if (natural) {
    const ai = await parseWithClaude(trimmed, timezone, options);
    if (ai) return ai;
    if (deterministic) return deterministic;
    return null;
  }

  if (deterministic) return deterministic;

  return parseWithClaude(trimmed, timezone, options);
}

/** True when the customer typed a menu number (1–10), not a natural date phrase. */
export function isDateMenuNumber(text: string, maxOption: number): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = parseInt(trimmed, 10);
  if (n >= 1 && n <= maxOption) return n;
  return null;
}
