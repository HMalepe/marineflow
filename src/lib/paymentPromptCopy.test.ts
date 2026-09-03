import { describe, expect, it } from 'vitest';
import {
  buildPaymentCheckoutCta,
  buildPaymentMethodFallbackText,
  buildRetailPayfastPromptBody,
  buildSecurePaymentPromptBody,
} from './paymentPromptCopy.js';

describe('paymentPromptCopy', () => {
  it('builds a valid PayFast CTA payload', () => {
    const body = buildSecurePaymentPromptBody(45000);
    const cta = buildPaymentCheckoutCta(body, 'https://api.example.com/pay/checkout/pay_1');
    expect(cta.type).toBe('cta_url');
    expect(cta.displayText).toBe('Pay securely now');
    expect(cta.url).toMatch(/^https:\/\//);
    expect(body).toContain('R 450.00');
    expect(body).toContain('Secure your booking');
    expect(body).toContain('Open in Chrome');
  });

  it('includes service name when provided', () => {
    const body = buildSecurePaymentPromptBody(12000, { serviceName: 'Cut & Style' });
    expect(body).toContain('Cut & Style');
    expect(body).toContain('R 120.00');
  });

  it('retail PayFast copy has no cash option and mentions drivers on delivery', () => {
    const body = buildRetailPayfastPromptBody({
      amountCents: 25000,
      orderRef: '#AB12CD',
      fulfillment: 'DELIVERY',
    });
    expect(body).toContain('#AB12CD');
    expect(body).toContain('R 250.00');
    expect(body).toContain('ACCEPT');
    expect(body.toLowerCase()).not.toContain('cash');
  });

  it('fallback text still offers reply 1 and 2', () => {
    const text = buildPaymentMethodFallbackText(9900);
    expect(text).toContain('reply *1*');
    expect(text).toContain('*2 — Cash at the salon*');
  });
});
