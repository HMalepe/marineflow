import crypto from 'node:crypto';
import { env } from '../../../config.js';
import type { PaymentProviderAdapter, CreateCheckoutInput, CheckoutResult, WebhookVerifyResult } from './types.js';

const OZOW_API_BASE_TEST = 'https://api.ozow.com';
const OZOW_PAY_BASE_TEST = 'https://pay.ozow.com';

function getBaseUrls() {
  return {
    api: OZOW_API_BASE_TEST,
    pay: env.OZOW_IS_TEST ? OZOW_PAY_BASE_TEST : 'https://pay.ozow.com',
  };
}

function generateHash(values: string[]): string {
  const concat = values.join('');
  return crypto.createHash('sha512').update(concat.toLowerCase()).digest('hex');
}

export const ozowAdapter: PaymentProviderAdapter = {
  name: 'ozow',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!env.OZOW_SITE_CODE || !env.OZOW_PRIVATE_KEY) {
      throw new Error('OZOW_SITE_CODE and OZOW_PRIVATE_KEY required');
    }

    const amountStr = (input.amountCents / 100).toFixed(2);
    const hashValues = [
      env.OZOW_SITE_CODE,
      'ZAR',
      input.reference,
      amountStr,
      input.returnUrl,
      input.cancelUrl,
      input.notifyUrl,
      env.OZOW_IS_TEST ? 'true' : 'false',
      env.OZOW_PRIVATE_KEY,
    ];
    const hashCheck = generateHash(hashValues);

    const params = new URLSearchParams({
      SiteCode: env.OZOW_SITE_CODE,
      CountryCode: 'ZA',
      CurrencyCode: 'ZAR',
      Amount: amountStr,
      TransactionReference: input.reference,
      BankReference: input.description ?? input.reference,
      Optional1: input.salonId,
      Optional2: input.customerId,
      CancelUrl: input.cancelUrl,
      ErrorUrl: input.cancelUrl,
      SuccessUrl: input.returnUrl,
      NotifyUrl: input.notifyUrl,
      IsTest: env.OZOW_IS_TEST ? 'true' : 'false',
      HashCheck: hashCheck,
    });

    const { pay } = getBaseUrls();
    const redirectUrl = `${pay}/?${params.toString()}`;

    return { redirectUrl, externalReference: input.reference };
  },

  verifyWebhook(payload: unknown, _headers: Record<string, string | undefined>): WebhookVerifyResult {
    const body = payload as Record<string, string>;
    const hash = body['Hash'] ?? body['hash'];
    const transactionId = body['TransactionId'] ?? body['transactionId'];
    const reference = body['TransactionReference'] ?? body['transactionReference'];
    const statusRaw = (body['Status'] ?? body['status'] ?? '').toLowerCase();

    if (!hash || !env.OZOW_PRIVATE_KEY) {
      return { valid: false };
    }

    const statusMap: Record<string, 'success' | 'failed' | 'pending' | 'cancelled'> = {
      complete: 'success',
      error: 'failed',
      cancelled: 'cancelled',
      pending: 'pending',
      abandonedbyuser: 'cancelled',
    };

    return {
      valid: true,
      transactionId,
      reference,
      status: statusMap[statusRaw] ?? 'pending',
    };
  },
};
