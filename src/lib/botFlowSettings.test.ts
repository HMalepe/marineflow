import { describe, expect, it } from 'vitest';
import {
  parseBotFlowOrder,
  parseBotFlowSettingsFromMetadata,
  validateBotFlowPayload,
  BUILTIN_FLOW_KEYS,
} from './botFlowSettings.js';

describe('parseBotFlowOrder', () => {
  it('defaults missing keys to end in standard order', () => {
    const order = parseBotFlowOrder(['botLoyaltyEnabled', 'botAskMarketingConsent'], []);
    expect(order[0]).toBe('botLoyaltyEnabled');
    expect(order[1]).toBe('botAskMarketingConsent');
    expect(order).toContain('botBirthdayEnabled');
    expect(order.length).toBe(BUILTIN_FLOW_KEYS.length);
  });

  it('interleaves custom flows saved in order', () => {
    const custom = [{ id: 'custom_abc12345', label: 'Allergies', prompt: 'Any allergies?', enabled: true }];
    const order = parseBotFlowOrder(
      ['botAskMarketingConsent', 'custom_abc12345', 'botAllowStaffPick'],
      custom,
    );
    expect(order.indexOf('custom_abc12345')).toBe(1);
  });
});

describe('parseBotFlowSettingsFromMetadata', () => {
  it('returns defaults when metadata empty', () => {
    const { order, customFlows } = parseBotFlowSettingsFromMetadata({});
    expect(customFlows).toEqual([]);
    expect(order.length).toBe(BUILTIN_FLOW_KEYS.length);
  });
});

describe('validateBotFlowPayload', () => {
  it('rejects blank custom flow labels', () => {
    const result = validateBotFlowPayload([], [
      { id: 'custom_test1234', label: '  ', prompt: '', enabled: true },
    ]);
    expect('error' in result).toBe(true);
  });
});
