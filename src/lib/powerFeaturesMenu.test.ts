import { describe, expect, it } from 'vitest';
import {
  buildExtraMenuLines,
  resolveExtendedMenuActions,
  shouldSendReferralPrompt,
  parseWaitlistClaim,
  newWaitlistClaim,
  WAITLIST_CLAIM_TTL_MS,
} from './powerFeaturesMenu.js';

describe('powerFeaturesMenu', () => {
  const metaReferralOnly = {
    automations: { referral: { enabled: true }, membership: { enabled: false } },
  };
  const metaBoth = {
    automations: { referral: { enabled: true }, membership: { enabled: true } },
  };
  const metaMembershipOnly = {
    automations: { referral: { enabled: false }, membership: { enabled: true } },
  };

  it('assigns 9 to referral when alone', () => {
    expect(resolveExtendedMenuActions({ metadata: metaReferralOnly })).toEqual({ referral: 9 });
    expect(buildExtraMenuLines({ metadata: metaReferralOnly })).toEqual(['9 — Refer a friend']);
  });

  it('assigns 9 referral and 10 membership when both on', () => {
    expect(resolveExtendedMenuActions({ metadata: metaBoth })).toEqual({
      referral: 9,
      membership: 10,
    });
  });

  it('assigns 9 to membership when referral off', () => {
    expect(resolveExtendedMenuActions({ metadata: metaMembershipOnly })).toEqual({
      membership: 9,
    });
  });

  it('referral prompt on 1st visit then every 5th (5, 10, 15)', () => {
    expect(shouldSendReferralPrompt(1, [1, 5])).toBe(true);
    expect(shouldSendReferralPrompt(4, [1, 5])).toBe(false);
    expect(shouldSendReferralPrompt(5, [1, 5])).toBe(true);
    expect(shouldSendReferralPrompt(6, [1, 5])).toBe(false);
    expect(shouldSendReferralPrompt(10, [1, 5])).toBe(true);
    expect(shouldSendReferralPrompt(15, [1, 5])).toBe(true);
  });

  it('honours explicit promptAfterVisits list only', () => {
    expect(shouldSendReferralPrompt(3, [1, 3, 7])).toBe(true);
    expect(shouldSendReferralPrompt(4, [1, 3, 7])).toBe(false);
    expect(shouldSendReferralPrompt(7, [1, 3, 7])).toBe(true);
  });

  it('rejects expired waitlist claim', () => {
    const expired = newWaitlistClaim({ serviceId: 'svc1' });
    expired.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect(parseWaitlistClaim(expired)).toBeNull();
  });

  it('accepts valid waitlist claim', () => {
    const claim = newWaitlistClaim({
      serviceId: 'svc1',
      staffId: 'st1',
      slotStart: new Date('2026-06-15T14:00:00Z'),
    });
    expect(parseWaitlistClaim(claim)?.serviceId).toBe('svc1');
    expect(parseWaitlistClaim(claim)?.staffId).toBe('st1');
  });

  it('waitlist claim TTL is 30 minutes', () => {
    expect(WAITLIST_CLAIM_TTL_MS).toBe(1_800_000);
  });
});
