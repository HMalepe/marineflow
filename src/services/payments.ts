import crypto from 'node:crypto';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { env } from '../config.js';
import { logger } from '../lib/logger.js';
import type { Service } from '@prisma/client';

// ─── PayFast ─────────────────────────────────────────────────────────────────

function isPayfastConfigured(): boolean {
  return Boolean(env.PAYFAST_MERCHANT_ID && env.PAYFAST_MERCHANT_KEY);
}

function payfastHost(): string {
  return env.PAYFAST_IS_TEST
    ? 'https://sandbox.payfast.co.za'
    : 'https://www.payfast.co.za';
}

// PHP-style urlencode to match PayFast's signature algorithm exactly.
function pfEncode(v: string): string {
  return encodeURIComponent(v)
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function buildPayfastSignature(
  params: Record<string, string>,
  passphrase?: string,
): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${pfEncode(v.trim())}`);
  if (passphrase) parts.push(`passphrase=${pfEncode(passphrase.trim())}`);
  return crypto.createHash('md5').update(parts.join('&')).digest('hex');
}

export async function createPayfastPaymentUrl(input: {
  salonId: string;
  customerId: string;
  appointmentId: string;
  service: Service;
  mode: 'deposit' | 'full';
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
}): Promise<string | null> {
  if (!isPayfastConfigured()) return null;

  const amountCents =
    input.mode === 'full'
      ? input.service.priceCents
      : (input.service.depositCents ?? input.service.priceCents);
  if (amountCents <= 0) return null;

  const payment = await prisma.payment.create({
    data: {
      salonId: input.salonId,
      appointmentId: input.appointmentId,
      customerId: input.customerId,
      provider: 'PAYFAST',
      status: 'PENDING',
      amountCents,
      currency: 'ZAR',
      payfastMerchantRef: input.appointmentId,
      metadata: { mode: input.mode },
    },
  });

  const amountZar = (amountCents / 100).toFixed(2);
  const notifyUrl = `${env.PUBLIC_BASE_URL}/webhooks/payfast/itn`;

  const params: Record<string, string> = {
    merchant_id: env.PAYFAST_MERCHANT_ID!,
    merchant_key: env.PAYFAST_MERCHANT_KEY!,
    return_url: `${env.PUBLIC_BASE_URL}/pay/success`,
    cancel_url: `${env.PUBLIC_BASE_URL}/pay/cancel`,
    notify_url: notifyUrl,
    m_payment_id: payment.id,
    amount: amountZar,
    item_name: `${input.service.name} (${input.mode})`,
  };

  if (input.customerFirstName) params.name_first = input.customerFirstName;
  if (input.customerLastName) params.name_last = input.customerLastName;
  if (input.customerEmail) params.email_address = input.customerEmail;

  params.signature = buildPayfastSignature(params, env.PAYFAST_PASSPHRASE);

  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${pfEncode(v)}`)
    .join('&');

  return `${payfastHost()}/eng/process?${qs}`;
}

export async function handlePayfastITN(
  body: Record<string, string>,
): Promise<void> {
  const { signature, pf_payment_id, m_payment_id, payment_status, amount_gross } = body;

  // Verify signature
  const paramsWithoutSig = Object.fromEntries(
    Object.entries(body).filter(([k]) => k !== 'signature'),
  );
  const expected = buildPayfastSignature(paramsWithoutSig, env.PAYFAST_PASSPHRASE);
  if (signature !== expected) {
    logger.warn({ m_payment_id, expected, received: signature }, 'payfast_itn_invalid_signature');
    return;
  }

  // Server-side validation with PayFast
  try {
    const validateUrl = `${payfastHost()}/eng/query/validate`;
    const validateBody = Object.entries(paramsWithoutSig)
      .map(([k, v]) => `${k}=${pfEncode(v)}`)
      .join('&');
    const res = await fetch(validateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: validateBody,
    });
    const text = await res.text();
    if (!text.includes('VALID')) {
      logger.warn({ m_payment_id, response: text }, 'payfast_itn_validation_failed');
      return;
    }
  } catch (err) {
    logger.error({ err, m_payment_id }, 'payfast_itn_validate_request_failed');
    // Don't block on network failure — fall through to status check
  }

  if (payment_status !== 'COMPLETE') {
    logger.info({ m_payment_id, payment_status }, 'payfast_itn_non_complete');
    return;
  }

  const payment = await prisma.payment.findUnique({ where: { id: m_payment_id } });
  if (!payment) {
    logger.warn({ m_payment_id }, 'payfast_itn_payment_not_found');
    return;
  }

  // Sanity-check the amount (allow 1c rounding tolerance)
  const expectedCents = payment.amountCents;
  const receivedCents = Math.round(parseFloat(amount_gross) * 100);
  if (Math.abs(expectedCents - receivedCents) > 1) {
    logger.warn({ m_payment_id, expectedCents, receivedCents }, 'payfast_itn_amount_mismatch');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: m_payment_id },
      data: {
        status: 'SUCCEEDED',
        payfastPaymentId: pf_payment_id ?? null,
        paidAt: new Date(),
      },
    });
    if (payment.appointmentId) {
      await tx.appointment.update({
        where: { id: payment.appointmentId },
        data: { status: 'CONFIRMED_PAID', confirmedAt: new Date() },
      });
    }
  });

  logger.info({ m_payment_id, pf_payment_id, appointmentId: payment.appointmentId }, 'payfast_payment_confirmed');
}

function getStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export async function createDepositCheckoutSession(input: {
  salonId: string;
  customerId: string;
  appointmentId: string;
  service: Service;
  mode: 'deposit' | 'full';
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const amount =
    input.mode === 'full'
      ? input.service.priceCents
      : (input.service.depositCents ?? input.service.priceCents);
  if (amount <= 0) return null;

  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: input.appointmentId },
    include: { customer: true },
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${env.PUBLIC_BASE_URL}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.PUBLIC_BASE_URL}/pay/cancel`,
    metadata: {
      salonId: input.salonId,
      appointmentId: input.appointmentId,
      customerId: input.customerId,
      kind: input.mode,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          product_data: {
            name: `${input.service.name} (${input.mode})`,
          },
        },
      },
    ],
    customer_email: appointment.customer.displayName?.includes('@')
      ? appointment.customer.displayName
      : undefined,
  });

  await prisma.payment.create({
    data: {
      salonId: input.salonId,
      appointmentId: input.appointmentId,
      customerId: input.customerId,
      status: 'PENDING',
      amountCents: amount,
      stripeSessionId: session.id,
      metadata: { mode: input.mode },
    },
  });

  return session.url;
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('stripe_not_configured');
  }
  if (!signature) {
    throw new Error('missing_stripe_signature');
  }
  const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointmentId;
    if (!appointmentId) return;

    await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { stripeSessionId: session.id },
        data: {
          status: 'SUCCEEDED',
          stripePaymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id,
        },
      });
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CONFIRMED_PAID' },
      });
    });
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!pi) return;
    await prisma.payment.updateMany({
      where: { stripePaymentIntentId: pi },
      data: { status: 'REFUNDED', stripeRefundId: charge.id },
    });
  }
}

export async function refundPaymentStaff(input: {
  paymentId: string;
  actorUserId: string;
  reason: string;
}): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error('stripe_not_configured');

  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: input.paymentId },
  });
  if (!payment.stripePaymentIntentId) throw new Error('no_payment_intent');

  await stripe.refunds.create({
    payment_intent: payment.stripePaymentIntentId,
  });

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED' },
    }),
    prisma.auditLog.create({
      data: {
        salonId: payment.salonId,
        actorUserId: input.actorUserId,
        action: 'payment_refund',
        entity: 'Payment',
        entityId: payment.id,
        payload: { reason: input.reason },
      },
    }),
  ]);
}
