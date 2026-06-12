import { describe, expect, it } from 'vitest';
import {
  isValidPasswordManagerEmail,
  loginUrlAfterPasswordChange,
  normalizeEmailForPasswordManager,
  normalizePhoneForPasswordManager,
  parseLoginRedirectParams,
  resolvePasswordManagerUsername,
} from './password-manager.js';

function params(entries: Record<string, string>): URLSearchParams {
  return new URLSearchParams(entries);
}

describe('password-manager', () => {
  describe('normalizeEmailForPasswordManager', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmailForPasswordManager('  User@Salon.COM  ')).toBe('user@salon.com');
    });

    it('returns empty for whitespace-only', () => {
      expect(normalizeEmailForPasswordManager('   ')).toBe('');
    });
  });

  describe('isValidPasswordManagerEmail', () => {
    it('accepts valid emails', () => {
      expect(isValidPasswordManagerEmail('owner@salon.co.za')).toBe(true);
    });

    it('rejects malformed emails', () => {
      expect(isValidPasswordManagerEmail('not-an-email')).toBe(false);
      expect(isValidPasswordManagerEmail('@missing.com')).toBe(false);
      expect(isValidPasswordManagerEmail('')).toBe(false);
    });

    it('rejects overlong emails', () => {
      const long = `${'a'.repeat(250)}@b.com`;
      expect(isValidPasswordManagerEmail(long)).toBe(false);
    });
  });

  describe('normalizePhoneForPasswordManager', () => {
    it('accepts E.164 +27 numbers', () => {
      expect(normalizePhoneForPasswordManager('+27821234567')).toBe('+27821234567');
    });

    it('accepts 9-digit local SA numbers', () => {
      expect(normalizePhoneForPasswordManager('821234567')).toBe('+27821234567');
    });

    it('accepts spaced local display', () => {
      expect(normalizePhoneForPasswordManager('82 123 4567')).toBe('+27821234567');
    });

    it('rejects too short numbers', () => {
      expect(normalizePhoneForPasswordManager('12345')).toBeNull();
      expect(normalizePhoneForPasswordManager('')).toBeNull();
    });

    it('rejects garbage input', () => {
      expect(normalizePhoneForPasswordManager('not-a-phone')).toBeNull();
      expect(normalizePhoneForPasswordManager('javascript:alert(1)')).toBeNull();
    });
  });

  describe('resolvePasswordManagerUsername', () => {
    it('prefers phone when available', () => {
      expect(
        resolvePasswordManagerUsername({ email: 'a@b.com', phone: '+27821234567' }),
      ).toEqual({ type: 'phone', value: '+27821234567' });
    });

    it('prefers email when preferEmail is set', () => {
      expect(
        resolvePasswordManagerUsername({
          email: 'a@b.com',
          phone: '+27821234567',
          preferEmail: true,
        }),
      ).toEqual({ type: 'email', value: 'a@b.com' });
    });

    it('falls back to email when no phone', () => {
      expect(resolvePasswordManagerUsername({ email: 'a@b.com' })).toEqual({
        type: 'email',
        value: 'a@b.com',
      });
    });

    it('returns null when neither is valid', () => {
      expect(resolvePasswordManagerUsername({ email: '', phone: 'bad' })).toBeNull();
      expect(resolvePasswordManagerUsername({ email: 'invalid', phone: null })).toBeNull();
    });

    it('ignores invalid phone and uses email', () => {
      expect(
        resolvePasswordManagerUsername({ email: 'a@b.com', phone: '123' }),
      ).toEqual({ type: 'email', value: 'a@b.com' });
    });
  });

  describe('parseLoginRedirectParams', () => {
    it('parses password-changed email redirect', () => {
      expect(
        parseLoginRedirectParams(
          params({ passwordChanged: '1', email: 'Owner@Salon.com', tab: 'email' }),
        ),
      ).toEqual({
        passwordChanged: true,
        tab: 'email',
        email: 'owner@salon.com',
        phone: '',
      });
    });

    it('parses password-changed phone redirect', () => {
      expect(
        parseLoginRedirectParams(
          params({ passwordChanged: '1', phone: '821234567', tab: 'whatsapp' }),
        ),
      ).toEqual({
        passwordChanged: true,
        tab: 'whatsapp',
        email: '',
        phone: '+27821234567',
      });
    });

    it('ignores invalid email and phone query params', () => {
      expect(
        parseLoginRedirectParams(
          params({
            passwordChanged: '1',
            email: 'not-valid',
            phone: '123',
            tab: 'email',
          }),
        ),
      ).toEqual({
        passwordChanged: true,
        tab: 'whatsapp',
        email: '',
        phone: '',
      });
    });

    it('falls back to email tab when whatsapp tab has no valid phone but email exists', () => {
      expect(
        parseLoginRedirectParams(
          params({ tab: 'whatsapp', email: 'a@b.com' }),
        ),
      ).toEqual({
        passwordChanged: false,
        tab: 'email',
        email: 'a@b.com',
        phone: '',
      });
    });

    it('treats missing passwordChanged as false', () => {
      expect(parseLoginRedirectParams(params({}))).toEqual({
        passwordChanged: false,
        tab: 'whatsapp',
        email: '',
        phone: '',
      });
    });
  });

  describe('loginUrlAfterPasswordChange', () => {
    it('builds email login redirect', () => {
      expect(loginUrlAfterPasswordChange({ type: 'email', value: 'a@b.com' })).toBe(
        '/login?passwordChanged=1&email=a%40b.com&tab=email',
      );
    });

    it('builds phone login redirect', () => {
      const url = loginUrlAfterPasswordChange({ type: 'phone', value: '+27821234567' });
      expect(url).toContain('passwordChanged=1');
      expect(url).toContain('tab=whatsapp');
      expect(url).toContain(encodeURIComponent('+27821234567'));
    });
  });
});
