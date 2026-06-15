import type { PaymentProviderAdapter } from './types.js';
import { ozowAdapter } from './ozow.js';
import { payfastAdapter, isPayfastConfigured as payfastConfigured } from './payfast.js';
import { env } from '../../../config.js';
export type { PaymentProviderAdapter, CreateCheckoutInput, CheckoutResult, WebhookVerifyResult } from './types.js';
export { ozowAdapter } from './ozow.js';
export { payfastAdapter } from './payfast.js';

export type PaymentProviderName = 'stripe' | 'ozow' | 'payfast' | 'manual';

/**
 * Returns the appropriate adapter for a given provider name.
 * Stripe remains handled separately in services/payments.ts (direct SDK usage).
 */
export function getPaymentAdapter(provider: PaymentProviderName): PaymentProviderAdapter {
  switch (provider) {
    case 'ozow':
      return ozowAdapter;
    case 'payfast':
      return payfastAdapter;
    default:
      throw new Error(`No adapter for provider: ${provider}`);
  }
}

export function isOzowConfigured(): boolean {
  return Boolean(env.OZOW_SITE_CODE && env.OZOW_PRIVATE_KEY);
}

export function isPayfastConfigured(): boolean {
  return payfastConfigured();
}