import { describe, expect, it } from 'vitest';
import {
  formatSaPhone,
  formatSaPhoneDisplay,
  isValidSaPhoneLocal,
  parseSaLocalPhoneInput,
} from './phone';

describe('parseSaLocalPhoneInput', () => {
  it('strips +27 from full international paste', () => {
    expect(parseSaLocalPhoneInput('+27621234567')).toBe('621234567');
    expect(parseSaLocalPhoneInput('27621234567')).toBe('621234567');
  });

  it('strips duplicate 27 when pasted into national field', () => {
    expect(parseSaLocalPhoneInput('27624760812')).toBe('624760812');
    expect(formatSaPhoneDisplay('27 624 760812')).toBe('62 476 0812');
  });

  it('strips leading 0 national format', () => {
    expect(parseSaLocalPhoneInput('0621234567')).toBe('621234567');
  });

  it('keeps plain local digits', () => {
    expect(parseSaLocalPhoneInput('82 123 4567')).toBe('821234567');
  });
});

describe('formatSaPhone', () => {
  it('builds E.164 from fuzzy input', () => {
    expect(formatSaPhone('+27621234567')).toBe('+27621234567');
    expect(formatSaPhone('27621234567')).toBe('+27621234567');
    expect(formatSaPhone('621234567')).toBe('+27621234567');
  });
});

describe('isValidSaPhoneLocal', () => {
  it('accepts normalized international paste', () => {
    expect(isValidSaPhoneLocal('+27621234567')).toBe(true);
  });
});
