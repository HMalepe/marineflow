import { describe, expect, it } from 'vitest';
import {
  FIRST_FOLLOW_UP_TEMPLATES,
  SECOND_FOLLOW_UP_TEMPLATES,
  CLOSING_MESSAGE_TEMPLATES,
  FOLLOW_UP_MESSAGE_SETS,
} from '../app/(dashboard)/settings/follow-up-message-templates.js';
import {
  FOLLOW_UP_MESSAGE_MAX_LENGTH,
  applySalonNameToTemplate,
  canApplyTemplate,
  clampInactivityDelay1,
  clampInactivityDelay2,
  indexOfMatchingTemplate,
  isCustomMessage,
  normalizeMessageForCompare,
  resolveMessageSet,
  resolveTemplateText,
  sanitizeFollowUpMessage,
  sanitizeSalonNameForMessage,
  validateFollowUpMessageLength,
  validateFollowUpSettings,
} from './follow-up-template-utils.js';

const LONG_SALON = 'A'.repeat(120);
const WORST_SALON = `${'X'.repeat(40)} ${'Y'.repeat(40)}`;

describe('follow-up-template-utils — salon name', () => {
  it('replaces placeholder and collapses whitespace in salon name', () => {
    expect(applySalonNameToTemplate('Hello {{salonName}}!', 'Bontle-Entle')).toBe(
      'Hello Bontle-Entle!',
    );
    expect(sanitizeSalonNameForMessage('  Foo\nBar\t  ')).toBe('Foo Bar');
  });

  it('shrinks long salon names so closing templates stay within limit', () => {
    for (const t of CLOSING_MESSAGE_TEMPLATES) {
      const resolved = resolveTemplateText(t, LONG_SALON);
      expect(resolved.length).toBeLessThanOrEqual(FOLLOW_UP_MESSAGE_MAX_LENGTH);
    }
  });

  it('handles worst-case salon name on thank-you template (2 placeholders)', () => {
    const text = resolveTemplateText(CLOSING_MESSAGE_TEMPLATES[0]!, WORST_SALON);
    expect(text.length).toBeLessThanOrEqual(FOLLOW_UP_MESSAGE_MAX_LENGTH);
    expect(text).not.toContain('{{salonName}}');
  });
});

describe('follow-up-template-utils — message hygiene', () => {
  it('sanitizes control characters on save', () => {
    expect(sanitizeFollowUpMessage('  Hi\r\nthere\t  ')).toBe('Hi\nthere');
  });

  it('normalizes whitespace for template matching', () => {
    const raw = FIRST_FOLLOW_UP_TEMPLATES[0]!.text;
    expect(
      isCustomMessage(FIRST_FOLLOW_UP_TEMPLATES, `  ${raw.replace(/\s+/g, ' ')}  `, 'Salon'),
    ).toBe(false);
  });

  it('detects lightly edited copy as custom', () => {
    expect(isCustomMessage(FIRST_FOLLOW_UP_TEMPLATES, 'Totally custom', 'Salon')).toBe(true);
  });

  it('matches template index after whitespace normalize', () => {
    const idx = indexOfMatchingTemplate(
      FIRST_FOLLOW_UP_TEMPLATES,
      FIRST_FOLLOW_UP_TEMPLATES[2]!.text,
      'Any',
    );
    expect(idx).toBe(2);
  });
});

describe('follow-up-template-utils — validation', () => {
  it('rejects messages over 500 chars', () => {
    const v = validateFollowUpMessageLength('x'.repeat(501));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.length).toBe(501);
  });

  it('rejects second follow-up without first', () => {
    const r = validateFollowUpSettings({
      inactivityMessage1: null,
      inactivityMessage2: 'Second only',
      inactivityMessage1DelayMin: 10,
      inactivityMessage2DelayMin: 30,
    });
    expect(r.ok).toBe(false);
  });

  it('rejects delay2 before delay1', () => {
    const r = validateFollowUpSettings({
      inactivityMessage1: 'Hi',
      inactivityMessage1DelayMin: 30,
      inactivityMessage2DelayMin: 15,
    });
    expect(r.ok).toBe(false);
  });

  it('accepts valid full settings', () => {
    const r = validateFollowUpSettings({
      inactivityMessage1: 'Hi',
      inactivityMessage1DelayMin: 10,
      inactivityMessage2: 'Bye',
      inactivityMessage2DelayMin: 30,
      closingMessage: 'Thanks',
    });
    expect(r.ok).toBe(true);
  });
});

describe('follow-up-template-utils — delays', () => {
  it('clamps invalid delay1 to nearest allowed option', () => {
    expect(clampInactivityDelay1(7)).toBe(5);
    expect(clampInactivityDelay1(12)).toBe(10);
    expect(clampInactivityDelay1('bad')).toBe(10);
  });

  it('clamps delay2 to stay after delay1', () => {
    expect(clampInactivityDelay2(10, 10)).toBeGreaterThan(10);
    expect(clampInactivityDelay2(30, 15)).toBe(30);
  });
});

describe('follow-up-template-utils — presets', () => {
  it('all built-in templates fit within limit for typical salon names', () => {
    const salon = 'Bontle-Entle Hair Studio';
    for (const t of [
      ...FIRST_FOLLOW_UP_TEMPLATES,
      ...SECOND_FOLLOW_UP_TEMPLATES,
      ...CLOSING_MESSAGE_TEMPLATES,
    ]) {
      const result = canApplyTemplate(t, salon);
      expect(result.ok).toBe(true);
    }
  });

  it('resolves full message sets with salon name', () => {
    for (const set of FOLLOW_UP_MESSAGE_SETS) {
      const resolved = resolveMessageSet(set, 'Demo Salon');
      expect(resolved.msg1.length).toBeLessThanOrEqual(FOLLOW_UP_MESSAGE_MAX_LENGTH);
      expect(resolved.msg2.length).toBeLessThanOrEqual(FOLLOW_UP_MESSAGE_MAX_LENGTH);
      expect(resolved.closing.length).toBeLessThanOrEqual(FOLLOW_UP_MESSAGE_MAX_LENGTH);
      expect(resolved.closing).toContain('Demo Salon');
    }
  });

  it('compare normalizes newlines', () => {
    expect(normalizeMessageForCompare('a\nb')).toBe('a\nb');
    expect(normalizeMessageForCompare('a  b')).toBe('a b');
  });
});
