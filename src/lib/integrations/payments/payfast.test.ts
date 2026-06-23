import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config.js', () => ({
  env: {
    NODE_ENV: 'test',
    PAYFAST_MERCHANT_ID: '10000100',
    PAYFAST_MERCHANT_KEY: '46f0cd694581a',
    PAYFAST_PASSPHRASE: '',
    PAYFAST_SANDBOX_MERCHANT_ID: undefined,
    PAYFAST_SANDBOX_MERCHANT_KEY: undefined,
    PAYFAST_SANDBOX_PASSPHRASE: undefined,
    PAYFAST_IS_TEST: true,
  },
}));

import { buildPayfastCheckoutForm } from './payfast.js';

const baseInput = {
  salonId: 'salon_1',
  customerId: 'cust_1',
  amountCents: 17000,
  currency: 'ZAR',
  reference: 'appt_test',
  returnUrl: 'https://example.com/return',
  cancelUrl: 'https://example.com/cancel',
  notifyUrl: 'https://example.com/notify',
  description: 'High Fade',
};

describe('buildPayfastCheckoutForm', () => {
  it('omits contact fields when not provided, preserving today\'s manual-entry checkout', () => {
    const form = buildPayfastCheckoutForm(baseInput);
    expect(form.fields.name_first).toBeUndefined();
    expect(form.fields.name_last).toBeUndefined();
    expect(form.fields.email_address).toBeUndefined();
    expect(form.fields.cell_number).toBeUndefined();
    expect(form.fields.signature).toMatch(/^[a-f0-9]{32}$/);
  });

  it('pre-fills name/email/cell so PayFast can skip the contact step', () => {
    const form = buildPayfastCheckoutForm({
      ...baseInput,
      nameFirst: 'Holiday',
      nameLast: 'Malepe',
      emailAddress: 'holiday@example.com',
      cellNumber: '0821234567',
    });
    expect(form.fields.name_first).toBe('Holiday');
    expect(form.fields.name_last).toBe('Malepe');
    expect(form.fields.email_address).toBe('holiday@example.com');
    expect(form.fields.cell_number).toBe('0821234567');
    expect(form.fields.signature).toMatch(/^[a-f0-9]{32}$/);
  });
});
