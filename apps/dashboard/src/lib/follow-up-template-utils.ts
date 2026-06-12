import type { FollowUpMessageTemplate } from '@/app/(dashboard)/settings/follow-up-message-templates';

/** WhatsApp-friendly limit for follow-up / closing bot messages (Settings UI + API). */
export const FOLLOW_UP_MESSAGE_MAX_LENGTH = 500;

const FIRST_DELAY_OPTIONS = [5, 10, 15, 20, 30] as const;
const SECOND_DELAY_OPTIONS = [15, 20, 30, 45, 60] as const;

export function sanitizeSalonNameForMessage(name: string): string {
  const cleaned = name.trim().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');
  return cleaned.slice(0, 80) || 'us';
}

export function sanitizeFollowUpMessage(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, ' ').trim();
}

export function validateFollowUpMessageLength(
  text: string,
  max = FOLLOW_UP_MESSAGE_MAX_LENGTH,
): { ok: true } | { ok: false; length: number; max: number } {
  const length = text.length;
  if (length > max) return { ok: false, length, max };
  return { ok: true };
}

export function applySalonNameToTemplate(
  text: string,
  salonName: string,
  maxTotalLength = FOLLOW_UP_MESSAGE_MAX_LENGTH,
): string {
  const placeholders = text.match(/\{\{salonName\}\}/g)?.length ?? 0;
  let name = sanitizeSalonNameForMessage(salonName);

  if (placeholders === 0) {
    return text.slice(0, maxTotalLength);
  }

  const baseLength = text.replace(/\{\{salonName\}\}/g, '').length;
  const budgetForNames = maxTotalLength - baseLength;

  if (budgetForNames < placeholders) {
    return text.replace(/\{\{salonName\}\}/g, '').slice(0, maxTotalLength);
  }

  const maxEachName = Math.floor(budgetForNames / placeholders);
  if (name.length > maxEachName) {
    name = name.slice(0, Math.max(1, maxEachName));
  }

  const resolved = text.replace(/\{\{salonName\}\}/g, name);
  return resolved.length > maxTotalLength ? resolved.slice(0, maxTotalLength) : resolved;
}

export function clampInactivityDelay1(minutes: unknown): number {
  const n = typeof minutes === 'number' ? minutes : parseInt(String(minutes ?? ''), 10);
  if (!Number.isFinite(n)) return 10;
  if (FIRST_DELAY_OPTIONS.includes(n as (typeof FIRST_DELAY_OPTIONS)[number])) return n;
  return FIRST_DELAY_OPTIONS.reduce((best, opt) =>
    Math.abs(opt - n) < Math.abs(best - n) ? opt : best,
  );
}

export function clampInactivityDelay2(minutes: unknown, delay1: number): number {
  const n = typeof minutes === 'number' ? minutes : parseInt(String(minutes ?? ''), 10);
  const valid = SECOND_DELAY_OPTIONS.filter((m) => m > delay1);
  const fallback = valid[0] ?? 30;
  if (!Number.isFinite(n)) return Math.max(fallback, delay1 + 5);
  const allowed = valid.includes(n as (typeof SECOND_DELAY_OPTIONS)[number])
    ? n
    : valid.reduce((best, opt) => (Math.abs(opt - n) < Math.abs(best - n) ? opt : best), fallback);
  return allowed > delay1 ? allowed : valid[valid.length - 1] ?? fallback;
}

export type FollowUpSettingsValidation =
  | { ok: true }
  | { ok: false; field: string; message: string };

export function validateFollowUpSettings(input: {
  inactivityMessage1?: string | null;
  inactivityMessage1DelayMin?: number;
  inactivityMessage2?: string | null;
  inactivityMessage2DelayMin?: number;
  closingMessage?: string | null;
}): FollowUpSettingsValidation {
  const msg1 =
    input.inactivityMessage1 != null ? sanitizeFollowUpMessage(input.inactivityMessage1) : undefined;
  const msg2 =
    input.inactivityMessage2 != null ? sanitizeFollowUpMessage(input.inactivityMessage2) : undefined;
  const closing =
    input.closingMessage != null ? sanitizeFollowUpMessage(input.closingMessage) : undefined;

  const checkLen = (label: string, value: string | undefined) => {
    if (value === undefined) return null;
    const v = validateFollowUpMessageLength(value);
    if (!v.ok) {
      return {
        field: label,
        message: `${label} must be ${v.max} characters or fewer (currently ${v.length}).`,
      };
    }
    return null;
  };

  for (const err of [
    checkLen('First follow-up', msg1),
    checkLen('Second follow-up', msg2),
    checkLen('Closing message', closing),
  ]) {
    if (err) return { ok: false, ...err };
  }

  if (!msg1 && msg2) {
    return {
      ok: false,
      field: 'inactivityMessage2',
      message: 'Add a first follow-up before setting a second follow-up.',
    };
  }

  if (
    input.inactivityMessage1DelayMin !== undefined &&
    input.inactivityMessage2DelayMin !== undefined &&
    input.inactivityMessage2DelayMin <= input.inactivityMessage1DelayMin
  ) {
    return {
      ok: false,
      field: 'inactivityMessage2DelayMin',
      message: 'Second follow-up delay must be later than the first.',
    };
  }

  return { ok: true };
}

export function normalizeMessageForCompare(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

export function resolveTemplateText(template: FollowUpMessageTemplate, salonName: string): string {
  return applySalonNameToTemplate(template.text, salonName);
}

export function indexOfMatchingTemplate(
  templates: FollowUpMessageTemplate[],
  value: string,
  salonName: string,
): number {
  const normalized = normalizeMessageForCompare(value);
  if (!normalized) return 0;
  const idx = templates.findIndex(
    (t) => normalizeMessageForCompare(resolveTemplateText(t, salonName)) === normalized,
  );
  return idx >= 0 ? idx : 0;
}

export function isCustomMessage(
  templates: FollowUpMessageTemplate[],
  value: string,
  salonName: string,
): boolean {
  const normalized = normalizeMessageForCompare(value);
  if (!normalized) return false;
  return !templates.some(
    (t) => normalizeMessageForCompare(resolveTemplateText(t, salonName)) === normalized,
  );
}

export function templateLengthWarning(
  text: string,
): { over: false } | { over: true; length: number; max: number } {
  const v = validateFollowUpMessageLength(text);
  if (v.ok) return { over: false };
  return { over: true, length: v.length, max: v.max };
}

export function canApplyTemplate(
  template: FollowUpMessageTemplate,
  salonName: string,
): { ok: true; text: string } | { ok: false; reason: string; text: string } {
  const text = resolveTemplateText(template, salonName);
  const v = validateFollowUpMessageLength(text);
  if (!v.ok) {
    return {
      ok: false,
      reason: `Too long with your salon name (${v.length}/${v.max} chars) — edit manually or shorten your display name.`,
      text,
    };
  }
  return { ok: true, text };
}

export function resolveMessageSet(
  set: { firstFollowUp: string; secondFollowUp: string; closing: string },
  salonName: string,
): { msg1: string; msg2: string; closing: string } {
  return {
    msg1: applySalonNameToTemplate(set.firstFollowUp, salonName),
    msg2: applySalonNameToTemplate(set.secondFollowUp, salonName),
    closing: applySalonNameToTemplate(set.closing, salonName),
  };
}
