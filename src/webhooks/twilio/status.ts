import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { validateTwilioRequest } from '../../lib/twilioValidate.js';
import { applyTwilioCampaignStatus } from '../../services/campaignMetrics.js';

/**
 * Twilio message status callback — delivery and read receipts for campaign sends.
 */
export async function handleTwilioStatusWebhook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const params = request.body as Record<string, string>;
  const signature =
    typeof request.headers['x-twilio-signature'] === 'string'
      ? request.headers['x-twilio-signature']
      : undefined;

  const url = `${env.TWILIO_WEBHOOK_BASE_URL.replace(/\/$/, '')}/webhooks/twilio/status`;
  const sigValid = validateTwilioRequest(signature, url, params);
  if (!sigValid) {
    const allowUnsignedDev =
      env.NODE_ENV !== 'production' && !env.TWILIO_AUTH_TOKEN?.trim();
    if (!allowUnsignedDev) {
      logger.warn({ hasSig: !!signature }, 'twilio_status_signature_invalid');
      return reply.code(403).send('Forbidden');
    }
  }

  const messageSid = params['MessageSid'] ?? '';
  const messageStatus = params['MessageStatus'] ?? '';

  if (messageSid && messageStatus) {
    try {
      await applyTwilioCampaignStatus(messageSid, messageStatus);
    } catch (err) {
      logger.warn({ err, messageSid, messageStatus }, 'twilio_status_campaign_update_failed');
    }
  }

  return reply.send('');
}
