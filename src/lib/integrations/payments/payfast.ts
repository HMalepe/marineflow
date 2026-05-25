import crypto from 'node:crypto';
import { env } from '../../../config.js';
import type { PaymentProviderAdapter, CreateCheckoutInput, CheckoutResult, WebhookVerifyResult } from './types.js';

const PAYFAST_BASE_TEST = 'https://sandbox.payfast.co.za/eng/process';
const PAYFAST_BASE_LIVE = 'https://www.payfast.co.za/eng/process';

function generateSignature(data: Record<string, string>, passphrase?: string): string {
  const params = Object.entries(data)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&');
  const withPassphrase = passphrase ? `${params}&passphrase=${encodeURIComponent(passphrase)}` : params;
  return crypto.createHash('md5').update(withPassphrase).digest('hex');
}

export const payfastAdapter: PaymentProviderAdapter = {
  name: 'payfast',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!env.PAYFAST_MERCHANT_ID || !env.PAYFAST_MERCHANT_KEY) {
      throw new Error('PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY required');
    }

    const amountStr = (input.amountCents / 100).toFixed(2);
    const data: Record<string, string> = {
      merchant_id: env.PAYFAST_MERCHANT_ID,
      merchant_key: env.PAYFAST_MERCHANT_KEY,
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      notify_url: input.notifyUrl,
      m_payment_id: input.reference,
      amount: amountStr,
      item_name: input.description ?? `Payment ${input.reference}`,
      custom_str1: input.salonId,
      custom_str2: input.customerId,
    };

    data.signature = generateSignature(data, env.PAYFAST_PASSPHRASE);

    const base = env.PAYFAST_IS_TEST ? PAYFAST_BASE_TEST : PAYFAST_BASE_LIVE;
    const params = new URLSearchParams(data);
    const redirectUrl = `${base}?${params.toString()}`;

    return { redirectUrl, externalReference: input.reference };
  },

  verifyWebhook(payload: unknown, _headers: Record<string, string | undefined>): WebhookVerifyResult {
    const body = payload as Record<string, string>;
    const paymentId = body['pf_payment_id'];
    const reference = body['m_payment_id'];
    const statusRaw = body['payment_status'] ?? '';
    const amountStr = body['amount_gross'] ?? '0';

    const signatureReceived = body['signature'];
    if (!signatureReceived) {
      return { valid: false };
    }

    const dataForSig = { ...body };
    delete dataForSig['signature'];
    const expected = generateSignature(dataForSig, env.PAYFAST_PASSPHRASE);
    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(signatureReceived);
    const valid = expectedBuf.length === receivedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, receivedBuf);

    const statusMap: Record<string, 'success' | 'failed' | 'pending' | 'cancelled'> = {
      COMPLETE: 'success',
      FAILED: 'failed',
      PENDING: 'pending',
      CANCELLED: 'cancelled',
    };

    return {
      valid,
      transactionId: paymentId,
      reference,
      status: statusMap[statusRaw] ?? 'pending',
      amountCents: Math.round(parseFloat(amountStr) * 100),
    };
  },
};
