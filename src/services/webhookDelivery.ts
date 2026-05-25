import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { SalonEvent } from '../lib/eventBus.js';

const DELIVERY_TIMEOUT_MS = 10_000;

/**
 * Fan out a salon event to all active webhook subscriptions matching the event type.
 * Called from the event bus publish path.
 */
export async function fanOutWebhooks(event: SalonEvent): Promise<void> {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      salonId: event.salonId,
      active: true,
      events: { has: event.type },
    },
  });

  if (subscriptions.length === 0) return;

  await Promise.allSettled(
    subscriptions.map((sub) => deliverWebhook(sub.id, sub.url, sub.secret, event)),
  );
}

/**
 * Deliver a webhook payload with HMAC-SHA256 signature.
 */
async function deliverWebhook(
  subscriptionId: string,
  url: string,
  secret: string,
  event: SalonEvent,
): Promise<void> {
  const payload = JSON.stringify({
    event: event.type,
    data: event.payload,
    salonId: event.salonId,
    timestamp: event.timestamp,
  });

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': event.type,
        'X-Webhook-Timestamp': event.timestamp,
        'User-Agent': 'MarineFlow-Webhooks/1.0',
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = res.status;
    responseBody = await res.text().catch(() => null);
    success = res.ok;
  } catch (err) {
    logger.warn({ err, subscriptionId, url }, 'webhook_delivery_failed');
    responseBody = err instanceof Error ? err.message : 'unknown_error';
  }

  await prisma.webhookDelivery.create({
    data: {
      subscriptionId,
      eventType: event.type,
      payload: event.payload as object,
      statusCode,
      responseBody,
      success,
      deliveredAt: success ? new Date() : null,
    },
  });
}

/**
 * Generate a cryptographically secure webhook secret.
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('base64url')}`;
}
