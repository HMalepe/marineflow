import { describe, expect, it } from 'vitest';
import { postLoginDestination, sanitizePostLoginRedirect } from './post-login-redirect.js';

describe('post-login-redirect', () => {
  describe('sanitizePostLoginRedirect', () => {
    it('accepts internal dashboard paths', () => {
      expect(sanitizePostLoginRedirect('/settings')).toBe('/settings');
      expect(sanitizePostLoginRedirect('/appointments')).toBe('/appointments');
      expect(sanitizePostLoginRedirect('/customers/abc-123')).toBe('/customers/abc-123');
    });

    it('preserves query strings on internal paths', () => {
      expect(sanitizePostLoginRedirect('/roster?addStaff=1')).toBe('/roster?addStaff=1');
    });

    it('rejects external and dangerous URLs', () => {
      expect(sanitizePostLoginRedirect('https://evil.com')).toBeNull();
      expect(sanitizePostLoginRedirect('//evil.com')).toBeNull();
      expect(sanitizePostLoginRedirect('javascript:alert(1)')).toBeNull();
      expect(sanitizePostLoginRedirect('/settings/../admin')).toBeNull();
    });

    it('rejects login paths to avoid loops', () => {
      expect(sanitizePostLoginRedirect('/login')).toBeNull();
      expect(sanitizePostLoginRedirect('/login?redirect=/settings')).toBeNull();
    });

    it('rejects empty and relative paths', () => {
      expect(sanitizePostLoginRedirect('')).toBeNull();
      expect(sanitizePostLoginRedirect('settings')).toBeNull();
      expect(sanitizePostLoginRedirect(null)).toBeNull();
    });
  });

  describe('postLoginDestination', () => {
    it('falls back to overview when redirect is invalid', () => {
      expect(postLoginDestination('https://evil.com')).toBe('/');
      expect(postLoginDestination(null)).toBe('/');
    });

    it('returns sanitized path when valid', () => {
      expect(postLoginDestination('/conversations')).toBe('/conversations');
    });
  });
});
