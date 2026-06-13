import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUTOMATIONS,
  parseAutomationsFromMetadata,
  validateAutomationsPayload,
} from './automationSettings.js';

describe('automationSettings', () => {
  it('returns defaults for empty metadata', () => {
    const parsed = parseAutomationsFromMetadata({});
    expect(parsed.reminders.enabled).toBe(true);
    expect(parsed.reminders.hoursBefore).toEqual([24, 2]);
    expect(parsed.reactivation.inactiveDays).toEqual([21, 45, 90, 180]);
  });

  it('merges partial automations patch', () => {
    const result = validateAutomationsPayload(
      { reminders: { enabled: false, hoursBefore: [24] } },
      DEFAULT_AUTOMATIONS,
    );
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.reminders.enabled).toBe(false);
      expect(result.reminders.hoursBefore).toEqual([24]);
      expect(result.waitlist.enabled).toBe(true);
    }
  });

  it('rejects empty reminder hours', () => {
    const result = validateAutomationsPayload(
      { reminders: { enabled: true, hoursBefore: [] } },
      DEFAULT_AUTOMATIONS,
    );
    expect(result).toEqual({ error: 'At least one reminder interval is required.' });
  });

  it('clamps corrupt metadata safely', () => {
    const parsed = parseAutomationsFromMetadata({
      automations: {
        reminders: { hoursBefore: [-1, 0, 9999, 2] },
        cancellation: { cancelHoursBefore: 'not-a-number' },
        referral: { rewardCents: -100 },
        googleReview: { incentiveCents: -100 },
      },
    });
    expect(parsed.reminders.hoursBefore).toContain(2);
    expect(parsed.cancellation.cancelHoursBefore).toBe(24);
    expect(parsed.referral.rewardCents).toBe(0);
    expect(parsed.googleReview.incentiveEnabled).toBe(true);
    expect(parsed.googleReview.incentiveCents).toBe(0);
  });
});
