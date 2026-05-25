import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { env } from '../config.js';
import type { Service } from '@prisma/client';

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
  const event = stripe.webhooks.constructEvent(rawBody, signature!, env.STRIPE_WEBHOOK_SECRET);

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
