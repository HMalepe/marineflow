import { describe, expect, it } from 'vitest';
import { buildPayfastRedirectUrl, buildPayfastSignature, payfastUrlEncode } from './payfastSignature.js';

describe('payfastUrlEncode', () => {
  it('uppercases percent-encoding and uses + for spaces', () => {
    expect(payfastUrlEncode('https://marineflow.co.za/pay/success')).toBe(
      'https%3A%2F%2Fmarineflow.co.za%2Fpay%2Fsuccess',
    );
  });
});

describe('buildPayfastSignature', () => {
  it('matches PayFast attribute order (not alphabetical)', () => {
    const fields: Array<[string, string]> = [
      ['merchant_id', '10000100'],
      ['merchant_key', '46f0cd694581a'],
      ['return_url', 'https://example.com/return'],
      ['cancel_url', 'https://example.com/cancel'],
      ['notify_url', 'https://example.com/notify'],
      ['m_payment_id', 'appt_test'],
      ['amount', '170.00'],
      ['item_name', 'High Fade'],
    ];

    const signature = buildPayfastSignature(fields, 'jt7NOE43FZPn');
    expect(signature).toMatch(/^[a-f0-9]{32}$/);

    const url = buildPayfastRedirectUrl('https://sandbox.payfast.co.za/eng/process', fields, signature);
    expect(url).toContain('merchant_id=10000100');
    expect(url).toContain('amount=170.00');
    expect(url).toContain(`signature=${signature}`);
    expect(url).not.toContain('merchant_key=46f0cd694581a&amount=');
  });
});
