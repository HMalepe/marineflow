import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/integrations/payments/index.js', () => ({
  isPayfastConfigured: () => false,
  isOzowConfigured: () => false,
}));

import {
  resolvePostConfirmPayment,
  salonRequiresPostConfirmPayment,
} from './payments.js';

describe('salonRequiresPostConfirmPayment', () => {
  it('reads botRequirePaymentStep when set', () => {
    expect(salonRequiresPostConfirmPayment({ botRequirePaymentStep: false })).toBe(false);
  });

  it('falls back to legacy botRequireDepositStep', () => {
    expect(salonRequiresPostConfirmPayment({ botRequireDepositStep: false })).toBe(false);
  });

  it('defaults to true when unset', () => {
    expect(salonRequiresPostConfirmPayment({})).toBe(true);
  });
});

describe('resolvePostConfirmPayment', () => {
  it('returns null when payment step disabled', () => {
    expect(
      resolvePostConfirmPayment({
        bookingTotalCents: 5000,
        loyaltyRedeemed: false,
        requirePaymentStep: false,
      }),
    ).toBeNull();
  });

  it('returns full booking amount when payment enabled even if PayFast env unset', () => {
    expect(
      resolvePostConfirmPayment({
        bookingTotalCents: 17000,
        loyaltyRedeemed: false,
        requirePaymentStep: true,
      }),
    ).toEqual({ amountCents: 17000 });
  });

  it('returns null when loyalty covers the booking', () => {
    expect(
      resolvePostConfirmPayment({
        bookingTotalCents: 17000,
        loyaltyRedeemed: true,
        requirePaymentStep: true,
      }),
    ).toBeNull();
  });
});
