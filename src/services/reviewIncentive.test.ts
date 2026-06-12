import { describe, expect, it } from 'vitest';
import {
  REVIEW_TOKEN_RE,
  buildGoogleReviewFollowUpMessage,
  buildReviewClaimUrl,
  buildWhatsAppClaimDeepLink,
  formatReviewReward,
  isValidGoogleReviewUrl,
  normalizeReviewToken,
  parseReviewClaimCommand,
  reviewedClaimErrorMessage,
  resolveGoogleReviewSettings,
  shouldSendGoogleReviewFollowUp,
} from './reviewIncentive.js';

describe('reviewIncentive — token parsing', () => {
  it('normalizes valid tokens to uppercase', () => {
    expect(normalizeReviewToken('rvw-abcd1234')).toBe('RVW-ABCD1234');
    expect(normalizeReviewToken('  RVW-0000FFFF  ')).toBe('RVW-0000FFFF');
  });

  it('rejects malformed tokens', () => {
    expect(normalizeReviewToken('RVW-SHORT')).toBeNull();
    expect(normalizeReviewToken('RVW-ABCD12345')).toBeNull();
    expect(normalizeReviewToken('')).toBeNull();
    expect(normalizeReviewToken('not-a-token')).toBeNull();
    expect(normalizeReviewToken('RVW-ABCD123G')).toBeNull();
  });

  it('matches token regex', () => {
    expect(REVIEW_TOKEN_RE.test('RVW-ABCD1234')).toBe(true);
    expect(REVIEW_TOKEN_RE.test('RVW-00000000')).toBe(true);
  });
});

describe('reviewIncentive — parseReviewClaimCommand', () => {
  it('parses REVIEWED without token', () => {
    expect(parseReviewClaimCommand('REVIEWED')).toEqual({ kind: 'reviewed' });
    expect(parseReviewClaimCommand('reviewed')).toEqual({ kind: 'reviewed' });
    expect(parseReviewClaimCommand('  Reviewed  ')).toEqual({ kind: 'reviewed' });
  });

  it('parses REVIEWED with token', () => {
    expect(parseReviewClaimCommand('REVIEWED RVW-ABCD1234')).toEqual({
      kind: 'reviewed',
      token: 'RVW-ABCD1234',
    });
  });

  it('parses standalone token paste', () => {
    expect(parseReviewClaimCommand('RVW-ABCD1234')).toEqual({
      kind: 'token_only',
      token: 'RVW-ABCD1234',
    });
  });

  it('does not false-positive on casual "reviewed" usage', () => {
    expect(parseReviewClaimCommand('I reviewed my haircut')).toBeNull();
    expect(parseReviewClaimCommand('already reviewed thanks')).toBeNull();
    expect(parseReviewClaimCommand('reviewed the salon on google')).toBeNull();
  });

  it('rejects REVIEWED with invalid token suffix', () => {
    expect(parseReviewClaimCommand('REVIEWED RVW-BAD')).toBeNull();
  });
});

describe('reviewIncentive — send eligibility', () => {
  const validUrl = 'https://g.page/r/test/review';

  it('requires enabled automation, valid URL, consent, and no prior send', () => {
    expect(
      shouldSendGoogleReviewFollowUp({
        googleReviewUrl: validUrl,
        googleReviewEnabled: true,
        marketingConsentStatus: 'ACCEPTED',
        reviewRequestSentAt: null,
      }),
    ).toBe(true);
  });

  it('blocks when automation disabled', () => {
    expect(
      shouldSendGoogleReviewFollowUp({
        googleReviewUrl: validUrl,
        googleReviewEnabled: false,
        marketingConsentStatus: 'ACCEPTED',
      }),
    ).toBe(false);
  });

  it('blocks invalid or missing URLs', () => {
    expect(
      shouldSendGoogleReviewFollowUp({
        googleReviewUrl: 'http://insecure.com',
        googleReviewEnabled: true,
        marketingConsentStatus: 'ACCEPTED',
      }),
    ).toBe(false);
    expect(
      shouldSendGoogleReviewFollowUp({
        googleReviewUrl: '   ',
        googleReviewEnabled: true,
        marketingConsentStatus: 'ACCEPTED',
      }),
    ).toBe(false);
  });

  it('blocks when marketing consent declined', () => {
    expect(
      shouldSendGoogleReviewFollowUp({
        googleReviewUrl: validUrl,
        googleReviewEnabled: true,
        marketingConsentStatus: 'DECLINED',
      }),
    ).toBe(false);
  });

  it('blocks duplicate sends for same appointment', () => {
    expect(
      shouldSendGoogleReviewFollowUp({
        googleReviewUrl: validUrl,
        googleReviewEnabled: true,
        marketingConsentStatus: 'ACCEPTED',
        reviewRequestSentAt: new Date(),
      }),
    ).toBe(false);
  });

  it('validates google review URLs', () => {
    expect(isValidGoogleReviewUrl('https://g.page/r/x/review')).toBe(true);
    expect(isValidGoogleReviewUrl('http://bad')).toBe(false);
    expect(isValidGoogleReviewUrl(null)).toBe(false);
  });
});

describe('reviewIncentive — messaging', () => {
  it('formats reward in rands', () => {
    expect(formatReviewReward(5000)).toBe('R50');
    expect(formatReviewReward(7550)).toBe('R76');
    expect(formatReviewReward(0)).toBe('R0');
    expect(formatReviewReward(-100)).toBe('R0');
  });

  it('builds encoded claim URL', () => {
    expect(buildReviewClaimUrl('RVW-ABCD1234')).toContain(
      '/review-reward/RVW-ABCD1234',
    );
  });

  it('builds WhatsApp deep link with REVIEWED token', () => {
    const link = buildWhatsAppClaimDeepLink({
      twilioWhatsAppFrom: 'whatsapp:+27821234567',
      token: 'RVW-ABCD1234',
    });
    expect(link).toContain('wa.me/27821234567');
    expect(link).toContain('REVIEWED');
    expect(link).toContain('RVW-ABCD1234');
  });

  it('returns null deep link when salon has no WhatsApp number', () => {
    expect(
      buildWhatsAppClaimDeepLink({ twilioWhatsAppFrom: null, token: 'RVW-ABCD1234' }),
    ).toBeNull();
  });

  it('strips markdown injection from admin URLs', () => {
    const body = buildGoogleReviewFollowUpMessage({
      googleReviewUrl: 'https://g.page/r/test_*bold*_/review',
      incentiveEnabled: true,
      incentiveCents: 5000,
      claimUrl: 'https://app.example/review-reward/RVW-TEST1234',
    });
    expect(body).not.toContain('*bold*');
    expect(body).toContain('good or bad');
    expect(body).toContain('R50');
    expect(body).toContain('REVIEWED');
  });

  it('includes incentive claim link when enabled', () => {
    const body = buildGoogleReviewFollowUpMessage({
      googleReviewUrl: 'https://g.page/r/test/review',
      incentiveEnabled: true,
      incentiveCents: 5000,
      claimUrl: 'https://app.example/review-reward/RVW-TEST1234',
    });
    expect(body).toContain('https://app.example/review-reward/RVW-TEST1234');
  });

  it('omits incentive when disabled or zero', () => {
    expect(
      buildGoogleReviewFollowUpMessage({
        googleReviewUrl: 'https://g.page/r/test/review',
        incentiveEnabled: false,
        incentiveCents: 5000,
        claimUrl: 'https://app.example/x',
      }),
    ).not.toContain('R50');

    expect(
      buildGoogleReviewFollowUpMessage({
        googleReviewUrl: 'https://g.page/r/test/review',
        incentiveEnabled: true,
        incentiveCents: 0,
      }),
    ).not.toContain('claim');
  });
});

describe('reviewIncentive — settings resolution', () => {
  it('reads google review settings from salon metadata', () => {
    const settings = resolveGoogleReviewSettings({
      automations: {
        googleReview: { enabled: false, incentiveEnabled: true, incentiveCents: 7500 },
      },
    });
    expect(settings.enabled).toBe(false);
    expect(settings.incentiveEnabled).toBe(true);
    expect(settings.incentiveCents).toBe(7500);
  });

  it('falls back to defaults for empty metadata', () => {
    const settings = resolveGoogleReviewSettings({});
    expect(settings.enabled).toBe(true);
    expect(settings.incentiveEnabled).toBe(true);
    expect(settings.incentiveCents).toBe(5000);
  });
});

describe('reviewIncentive — error messages', () => {
  it('covers every claim failure reason', () => {
    const reasons = [
      'invalid_token',
      'not_found',
      'wrong_customer',
      'expired',
      'no_pending',
    ] as const;
    for (const reason of reasons) {
      expect(reviewedClaimErrorMessage(reason).length).toBeGreaterThan(10);
    }
  });
});
