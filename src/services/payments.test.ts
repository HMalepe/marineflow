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
        service: { fullPay: false, depositCents: null },
        loyaltyRedeemed: false,
        requirePaymentStep: false,
      }),
    ).toBeNull();
  });

  it('returns full amount when no deposit configured', () => {
    expect(
      resolvePostConfirmPayment({
        bookingTotalCents: 17000,
        service: { fullPay: false, depositCents: null },
        loyaltyRedeemed: false,
        requirePaymentStep: true,
      }),
    ).toEqual({ amountCents: 17000, mode: 'full' });
  });

  it('returns deposit amount when service has deposit', () => {
    expect(
      resolvePostConfirmPayment({
        bookingTotalCents: 17000,
        service: { fullPay: false, depositCents: 5000 },
        loyaltyRedeemed: false,
        requirePaymentStep: true,
      }),
    ).toEqual({ amountCents: 5000, mode: 'deposit' });
  });
});
