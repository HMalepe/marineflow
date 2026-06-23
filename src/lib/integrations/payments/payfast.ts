import crypto from 'node:crypto';
import { env } from '../../../config.js';
import { logger } from '../../logger.js';
import type { PaymentProviderAdapter, CreateCheckoutInput, CheckoutResult, WebhookVerifyResult } from './types.js';
import {
  PAYFAST_PROCESS_URL_LIVE,
  PAYFAST_PROCESS_URL_SANDBOX,
  buildPayfastRedirectUrl,
  buildPayfastSignature,
  payfastUrlEncode,
  resolvePayfastIsSandbox,
  trimPayfastCredential,
} from './payfastSignature.js';

export function payfastProcessUrl(): string {
  const sandbox = resolvePayfastIsSandbox(env.PAYFAST_IS_TEST, env.NODE_ENV);
  return sandbox ? PAYFAST_PROCESS_URL_SANDBOX : PAYFAST_PROCESS_URL_LIVE;
}

export function payfastCredentials(): {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
} {
  const sandbox = resolvePayfastIsSandbox(env.PAYFAST_IS_TEST, env.NODE_ENV);
  if (sandbox) {
    // Never fall back to live credentials in sandbox — live merchant IDs cause
    // PayFast "Invalid merchant ID" (400) on sandbox.payfast.co.za.
    return {
      merchantId: trimPayfastCredential(env.PAYFAST_SANDBOX_MERCHANT_ID),
      merchantKey: trimPayfastCredential(env.PAYFAST_SANDBOX_MERCHANT_KEY),
      passphrase: trimPayfastCredential(env.PAYFAST_SANDBOX_PASSPHRASE),
      sandbox: true,
    };
  }
  return {
    merchantId: trimPayfastCredential(env.PAYFAST_MERCHANT_ID),
    merchantKey: trimPayfastCredential(env.PAYFAST_MERCHANT_KEY),
    passphrase: trimPayfastCredential(env.PAYFAST_PASSPHRASE),
    sandbox: false,
  };
}

export function isPayfastConfigured(): boolean {
  const { merchantId, merchantKey } = payfastCredentials();
  return Boolean(merchantId && merchantKey);
}

export interface PayfastCheckoutForm {
  action: string;
  fields: Record<string, string>;
}

export function buildPayfastCheckoutForm(input: CreateCheckoutInput): PayfastCheckoutForm {
  const { merchantId, merchantKey, passphrase } = payfastCredentials();
  if (!merchantId || !merchantKey) {
    throw new Error('PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY required');
  }

  const amountStr = (input.amountCents / 100).toFixed(2);
  const data: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    m_payment_id: input.reference,
    amount: amountStr,
    item_name: input.description ?? `Payment ${input.reference}`,
    custom_str1: input.salonId,
    custom_str2: input.customerId,
  };

  const orderedFields = checkoutFieldOrder(data);
  const signature = buildPayfastSignature(orderedFields, passphrase || undefined);
  const fields: Record<string, string> = Object.fromEntries(orderedFields);
  fields.signature = signature;

  return { action: payfastProcessUrl(), fields };
}

const RECURRING_FIELD_ORDER = [
  'merchant_id',
  'merchant_key',
  'return_url',
  'cancel_url',
  'notify_url',
  'name_first',
  'name_last',
  'email_address',
  'cell_number',
  'm_payment_id',
  'amount',
  'item_name',
  'item_description',
  'subscription_type',
  'frequency',
  'cycles',
  'custom_int1',
  'custom_int2',
  'custom_int3',
  'custom_int4',
  'custom_int5',
  'custom_str1',
  'custom_str2',
  'custom_str3',
  'custom_str4',
  'custom_str5',
] as const;

/** PayFast subscription checkout — monthly debit on the same calendar day each cycle. */
export function buildPayfastRecurringCheckoutForm(input: {
  reference: string;
  amountCents: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  customStr1: string;
  customStr2: string;
  customStr3?: string;
  /** PayFast frequency code — 3 = monthly, 6 = annually */
  frequency?: '3' | '6';
  /** 0 = indefinite recurring */
  cycles?: string;
}): PayfastCheckoutForm {
  const { merchantId, merchantKey, passphrase } = payfastCredentials();
  if (!merchantId || !merchantKey) {
    throw new Error('PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY required');
  }

  const data: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    m_payment_id: input.reference,
    amount: (input.amountCents / 100).toFixed(2),
    item_name: input.description,
    subscription_type: '1',
    frequency: input.frequency ?? '3',
    cycles: input.cycles ?? '0',
    custom_str1: input.customStr1,
    custom_str2: input.customStr2,
  };
  if (input.customStr3) data.custom_str3 = input.customStr3;

  const orderedFields = RECURRING_FIELD_ORDER.filter(
    (key) => data[key] !== undefined && data[key] !== '',
  ).map((key) => [key, data[key]!] as [string, string]);

  const signature = buildPayfastSignature(orderedFields, passphrase || undefined);
  const fields: Record<string, string> = Object.fromEntries(orderedFields);
  fields.signature = signature;

  return { action: payfastProcessUrl(), fields };
}

function checkoutFieldOrder(data: Record<string, string>): Array<[string, string]> {
  const order = [
    'merchant_id',
    'merchant_key',
    'return_url',
    'cancel_url',
    'notify_url',
    'name_first',
    'name_last',
    'email_address',
    'cell_number',
    'm_payment_id',
    'amount',
    'item_name',
    'item_description',
    'custom_int1',
    'custom_int2',
    'custom_int3',
    'custom_int4',
    'custom_int5',
    'custom_str1',
    'custom_str2',
    'custom_str3',
    'custom_str4',
    'custom_str5',
    'email_confirmation',
    'payment_method',
  ] as const;

  return order
    .filter((key) => data[key] !== undefined && data[key] !== '')
    .map((key) => [key, data[key]!]);
}

function verifySignatureFromBody(body: Record<string, string>, passphrase: string): boolean {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (key === 'signature' || value === '') continue;
    pairs.push(`${key}=${payfastUrlEncode(value)}`);
  }

  let paramString = pairs.join('&');
  if (passphrase) {
    paramString += `&passphrase=${payfastUrlEncode(passphrase)}`;
  }

  const expected = crypto.createHash('md5').update(paramString).digest('hex');
  const received = body.signature ?? '';
  if (!received || expected.length !== received.length) return false;

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(received);
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export const payfastAdapter: PaymentProviderAdapter = {
  name: 'payfast',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const { merchantId, sandbox } = payfastCredentials();
    if (!merchantId) {
      throw new Error('PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY required');
    }

    logger.info(
      { sandbox, merchantIdPrefix: merchantId.slice(0, 4) },
      'payfast_checkout_create',
    );

    const form = buildPayfastCheckoutForm(input);
    const redirectUrl = buildPayfastRedirectUrl(
      form.action,
      Object.entries(form.fields).filter(([k]) => k !== 'signature') as Array<[string, string]>,
      form.fields.signature!,
    );

    return { redirectUrl, externalReference: input.reference, form };
  },

  verifyWebhook(payload: unknown, _headers: Record<string, string | undefined>): WebhookVerifyResult {
    const body = payload as Record<string, string>;
    const paymentId = body['pf_payment_id'];
    const reference = body['m_payment_id'];
    const statusRaw = body['payment_status'] ?? '';
    const amountStr = body['amount_gross'] ?? '0';

    const { passphrase } = payfastCredentials();
    const valid = verifySignatureFromBody(body, passphrase);

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
