import { describe, expect, it } from 'vitest';
import {
  buildPopiaConsentMessage,
  marketingConsentGatePending,
  parseMarketingConsentReply,
  parseMarketingConsentStatus,
  isGlobalMarketingOptIn,
  isGlobalMarketingOptOut,
} from './marketingConsent.js';
import { validateCampaignMedia } from './campaigns.js';

describe('parseMarketingConsentReply', () => {
  it('accepts explicit ACCEPT/DECLINE keywords', () => {
    expect(parseMarketingConsentReply('ACCEPT')).toBe('accept');
    expect(parseMarketingConsentReply('Accept')).toBe('accept');
    expect(parseMarketingConsentReply('DECLINE')).toBe('decline');
    expect(parseMarketingConsentReply('stop')).toBe('decline');
  });

  it('does not treat YES/NO as marketing consent (reserved for booking POPIA)', () => {
    expect(parseMarketingConsentReply('yes')).toBeNull();
    expect(parseMarketingConsentReply('YES')).toBeNull();
    expect(parseMarketingConsentReply('no')).toBeNull();
    expect(parseMarketingConsentReply('NO')).toBeNull();
  });

  it('rejects ambiguous numeric or single-letter replies', () => {
    expect(parseMarketingConsentReply('1')).toBeNull();
    expect(parseMarketingConsentReply('2')).toBeNull();
    expect(parseMarketingConsentReply('y')).toBeNull();
    expect(parseMarketingConsentReply('n')).toBeNull();
    expect(parseMarketingConsentReply('start')).toBeNull();
  });
});

describe('parseMarketingConsentStatus', () => {
  it('parses valid enum values', () => {
    expect(parseMarketingConsentStatus('PENDING')).toBe('PENDING');
    expect(parseMarketingConsentStatus('ACCEPTED')).toBe('ACCEPTED');
    expect(parseMarketingConsentStatus('DECLINED')).toBe('DECLINED');
  });

  it('rejects invalid values', () => {
    expect(parseMarketingConsentStatus('accepted')).toBeNull();
    expect(parseMarketingConsentStatus(true)).toBeNull();
  });
});

describe('global marketing keywords', () => {
  it('detects STOP and ACCEPT shortcuts', () => {
    expect(isGlobalMarketingOptOut('STOP')).toBe(true);
    expect(isGlobalMarketingOptIn('accept')).toBe(true);
    expect(isGlobalMarketingOptOut('yes')).toBe(false);
  });
});

describe('buildPopiaConsentMessage', () => {
  it('mentions POPIA MYDATA and DELETE rights', () => {
    const msg = buildPopiaConsentMessage('Glow Salon');
    expect(msg).toContain('MYDATA');
    expect(msg).toContain('DELETE');
    expect(msg).toContain('POPIA');
  });
});

describe('marketingConsentGatePending', () => {
  it('is true when dashboard toggle on and status pending', () => {
    expect(marketingConsentGatePending({ botAskMarketingConsent: true }, 'PENDING')).toBe(true);
  });

  it('is false when toggle off or already decided', () => {
    expect(marketingConsentGatePending({ botAskMarketingConsent: false }, 'PENDING')).toBe(false);
    expect(marketingConsentGatePending({ botAskMarketingConsent: true }, 'ACCEPTED')).toBe(false);
  });
});

describe('validateCampaignMedia', () => {
  it('requires HTTPS for media URLs', () => {
    expect(
      validateCampaignMedia('http://example.com/a.jpg', 'image'),
    ).toBe('Media URL must use HTTPS.');
    expect(
      validateCampaignMedia('https://cdn.example.com/a.jpg', 'image'),
    ).toBeNull();
  });

  it('requires matching url and type', () => {
    expect(validateCampaignMedia(null, 'image')).toBe(
      'Upload media or remove the attachment type.',
    );
    expect(validateCampaignMedia('https://cdn.example.com/a.jpg', null)).toBe(
      'Choose image or video for the attachment.',
    );
  });
});
