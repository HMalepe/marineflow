import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { SalonEvent } from '../lib/eventBus.js';

const DELIVERY_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2_000, 8_000, 30_000];

/**
 * Fan out a salon event to all active webhook subscriptions matching the event type.
 * Called from the event bus publish path.
 */
export async function fanOutWebhooks(event: SalonEvent): Promise<void> {
  let subscriptions;
  try {
    subscriptions = await prisma.webhookSubscription.findMany({
      where: {
        salonId: event.salonId,
        active: true,
        events: { has: event.type },
      },
    });
  } catch (err) {
    // P2021 = table does not exist — migration may not have applied yet; skip silently
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
      return;
    }
    throw err;
  }

  if (subscriptions.length === 0) return;

  await Promise.allSettled(
    subscriptions.map((sub) => deliverWebhook(sub.id, sub.url, sub.secret, event)),
  );
}

/**
 * Deliver a webhook payload with HMAC-SHA256 signature and up to MAX_RETRIES retries.
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

  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Webhook-Event': event.type,
    'X-Webhook-Timestamp': event.timestamp,
    'User-Agent': 'MarineFlow-Webhooks/1.0',
  };

  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let success = false;
  let attempts = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    attempts = attempt + 1;
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
      const res = await fetch(url, { method: 'POST', headers, body: payload, signal: controller.signal });
      clearTimeout(timer);
      statusCode = res.status;
      responseBody = await res.text().catch(() => null);
      success = res.ok;
      if (success) break;
      // 4xx is non-retryable
      if (res.status >= 400 && res.status < 500) break;
    } catch (err) {
      logger.warn({ err, subscriptionId, url, attempt }, 'webhook_delivery_attempt_failed');
      responseBody = err instanceof Error ? err.message : 'unknown_error';
    }
  }

  if (!success) {
    logger.warn({ subscriptionId, url, attempts, statusCode }, 'webhook_delivery_exhausted');
  }

  await prisma.webhookDelivery.create({
    data: {
      subscriptionId,
      eventType: event.type,
      payload: event.payload as object,
      statusCode,
      responseBody,
      success,
      attempts,
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
