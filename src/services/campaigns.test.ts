import { describe, expect, it } from 'vitest';
import {
  campaignRequiresAudience,
  resolveCampaignScheduleAfterPatch,
  validateCampaignMediaUrl,
} from './campaigns.js';

describe('campaignRequiresAudience', () => {
  it('does not require audience for drafts', () => {
    expect(campaignRequiresAudience({ sendNow: false, scheduledAt: null })).toBe(false);
    expect(campaignRequiresAudience({})).toBe(false);
  });

  it('requires audience for send now', () => {
    expect(campaignRequiresAudience({ sendNow: true, scheduledAt: null })).toBe(true);
  });

  it('requires audience for scheduled delivery', () => {
    expect(campaignRequiresAudience({ scheduledAt: new Date(Date.now() + 60_000) })).toBe(true);
  });
});

describe('resolveCampaignScheduleAfterPatch', () => {
  const existing = new Date('2026-07-01T10:00:00.000Z');

  it('keeps existing schedule when patch omits scheduledAt', () => {
    expect(resolveCampaignScheduleAfterPatch(existing, undefined)).toEqual(existing);
  });

  it('clears schedule when patch sets null (save as draft)', () => {
    expect(resolveCampaignScheduleAfterPatch(existing, null)).toBeNull();
  });

  it('applies new schedule from patch', () => {
    const next = new Date('2026-08-01T10:00:00.000Z');
    expect(resolveCampaignScheduleAfterPatch(null, next)).toEqual(next);
  });
});

describe('validateCampaignMediaUrl', () => {
  it('allows data URLs for local dev uploads', () => {
    expect(validateCampaignMediaUrl('data:image/jpeg;base64,/9j/4AAQ')).toBeNull();
  });

  it('requires HTTPS for public URLs', () => {
    expect(validateCampaignMediaUrl('http://example.com/a.jpg')).toMatch(/HTTPS/i);
    expect(validateCampaignMediaUrl('https://cdn.example.com/a.jpg')).toBeNull();
  });
});
