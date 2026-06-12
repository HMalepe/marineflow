import { describe, expect, it } from 'vitest';
import {
  applySalonNameToTemplate,
  clampInactivityDelay1,
  sanitizeFollowUpMessage,
  validateFollowUpSettings,
} from './followUpMessages.js';

describe('followUpMessages (API)', () => {
  it('validates follow-up settings consistently with dashboard', () => {
    expect(
      validateFollowUpSettings({
        inactivityMessage1: 'Hi',
        inactivityMessage1DelayMin: 10,
        inactivityMessage2: 'Still there?',
        inactivityMessage2DelayMin: 30,
        closingMessage: 'Thanks!',
      }).ok,
    ).toBe(true);
  });

  it('rejects overlong messages from API', () => {
    const r = validateFollowUpSettings({
      closingMessage: 'x'.repeat(501),
    });
    expect(r.ok).toBe(false);
  });

  it('sanitizes CRLF from stored messages', () => {
    expect(sanitizeFollowUpMessage('Hello\r\nWorld')).toBe('Hello\nWorld');
  });

  it('shrinks salon name in template for API-side safety', () => {
    const out = applySalonNameToTemplate(
      'Thanks {{salonName}} — {{salonName}}',
      'Z'.repeat(200),
    );
    expect(out.length).toBeLessThanOrEqual(500);
  });

  it('clamps corrupt delay values', () => {
    expect(clampInactivityDelay1(999)).toBe(30);
  });
});
