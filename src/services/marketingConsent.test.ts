import { describe, expect, it } from 'vitest';
import {
  parseMarketingConsentReply,
  parseMarketingConsentStatus,
  isGlobalMarketingOptIn,
  isGlobalMarketingOptOut,
} from './marketingConsent.js';
import { validateCampaignMedia } from './campaigns.js';

describe('parseMarketingConsentReply', () => {
  it('accepts explicit accept/decline keywords', () => {
    expect(parseMarketingConsentReply('ACCEPT')).toBe('accept');
    expect(parseMarketingConsentReply('yes')).toBe('accept');
    expect(parseMarketingConsentReply('DECLINE')).toBe('decline');
    expect(parseMarketingConsentReply('stop')).toBe('decline');
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
