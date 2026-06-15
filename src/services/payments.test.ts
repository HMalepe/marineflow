import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/integrations/payments/index.js', () => ({
  isPayfastConfigured: () => true,
  isOzowConfigured: () => false,
}));

import { resolvePostConfirmPayment } from './payments.js';

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

  it('returns full booking amount when payment enabled', () => {
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
