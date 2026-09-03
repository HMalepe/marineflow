import { describe, expect, it } from 'vitest';
import { isRetailOrderReadyForDriverOffer } from './retailDriverDispatch.js';

describe('isRetailOrderReadyForDriverOffer', () => {
  it('only pings drivers after PayFast marks the order paid', () => {
    expect(isRetailOrderReadyForDriverOffer('PENDING_PAYMENT')).toBe(false);
    expect(isRetailOrderReadyForDriverOffer('DRAFT')).toBe(false);
    expect(isRetailOrderReadyForDriverOffer('CANCELLED')).toBe(false);
    expect(isRetailOrderReadyForDriverOffer('PAID')).toBe(true);
    expect(isRetailOrderReadyForDriverOffer('PREPARING')).toBe(true);
  });
});
