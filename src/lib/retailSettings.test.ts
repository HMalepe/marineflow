import { describe, expect, it } from 'vitest';
import { isRetailAlwaysOpen, getRetailSettings } from './retailSettings.js';

describe('retail always-open / notify settings', () => {
  it('defaults dispensary to 24/7 without explicit flag', () => {
    expect(isRetailAlwaysOpen({}, 'dispensary')).toBe(true);
    expect(isRetailAlwaysOpen({}, 'salon')).toBe(false);
  });

  it('honours explicit alwaysOpen false on dispensary', () => {
    expect(
      isRetailAlwaysOpen({ retail: { alwaysOpen: false } }, 'dispensary'),
    ).toBe(false);
  });

  it('enables staff notify by default; drivers off until configured', () => {
    const s = getRetailSettings({});
    expect(s.notifyStaffOnOrder).toBe(true);
    expect(s.driverNotifyEnabled).toBe(false);
    expect(s.driverPhones).toEqual([]);
  });
});

