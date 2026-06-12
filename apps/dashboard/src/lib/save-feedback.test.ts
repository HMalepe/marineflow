import { describe, expect, it } from 'vitest';
import { formatSaveSuccess } from '../components/save-feedback.js';
import { SAVE_MESSAGES } from './save-messages.js';

/** Every dashboard save flow should use one of these messages (before the ✓ is appended). */
const STANDARD_SAVE_MESSAGES = [
  SAVE_MESSAGES.changesSaved,
  SAVE_MESSAGES.profileUpdated,
  SAVE_MESSAGES.draftSaved,
  SAVE_MESSAGES.logoSaved,
  SAVE_MESSAGES.logoRemoved,
  'Business hours saved',
  'FAQ added — keep going or click Done',
  'Bot messages saved',
] as const;

describe('formatSaveSuccess edge cases', () => {
  it('1 — appends ✓ to standard “Changes saved” copy', () => {
    expect(formatSaveSuccess(SAVE_MESSAGES.changesSaved)).toBe('Changes saved ✓');
    expect(formatSaveSuccess(SAVE_MESSAGES.profileUpdated)).toBe('Profile updated ✓');
  });

  it('2 — is idempotent when ✓ is already present', () => {
    expect(formatSaveSuccess('Changes saved ✓')).toBe('Changes saved ✓');
    expect(formatSaveSuccess('  Draft saved ✓  ')).toBe('Draft saved ✓');
  });

  it('3 — preserves quoted bot names and special characters', () => {
    expect(formatSaveSuccess('Bot name updated to "Ava"')).toBe('Bot name updated to "Ava" ✓');
    expect(formatSaveSuccess("Location & contact details saved")).toBe(
      'Location & contact details saved ✓',
    );
  });

  it('4 — returns empty string for blank input (component renders nothing)', () => {
    expect(formatSaveSuccess('')).toBe('');
    expect(formatSaveSuccess('   ')).toBe('');
  });

  it('5 — all audited save messages format to non-empty green-tick strings', () => {
    for (const message of STANDARD_SAVE_MESSAGES) {
      const formatted = formatSaveSuccess(message);
      expect(formatted.endsWith('✓')).toBe(true);
      expect(formatted.length).toBeGreaterThan(2);
      expect(formatted).not.toMatch(/✓.*✓/);
    }
  });
});

describe('save message constants', () => {
  it('uses “Changes saved” for edit flows across Services, FAQs, and Roster', () => {
    expect(SAVE_MESSAGES.changesSaved).toBe('Changes saved');
  });
});
