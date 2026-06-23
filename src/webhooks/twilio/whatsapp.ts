import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { redis } from '../../lib/redis.js';
import { twilioMessaging } from '../../lib/integrations/messaging/twilio-impl.js';
import { recordWebhookEvent } from '../../lib/webhooks.js';
import { resolveTenantFromTwilioAddress } from '../../lib/tenant.js';
import { handleInboundWhatsApp } from '../../services/bot.js';
import { logMessageLog } from '../../services/messageLog.js';

/**
 * Twilio WhatsApp inbound webhook — logs every hit to MessageLog for bot health.
 */
export async function handleTwilioWhatsAppWebhook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const params = request.body as Record<string, string>;
  const signature =
    typeof request.headers['x-twilio-signature'] === 'string'
      ? request.headers['x-twilio-signature']
      : undefined;

  logger.info({ from: params['From'], to: params['To'], hasSig: !!signature }, 'twilio_webhook_received');

  // TWILIO_WEBHOOK_BASE_URL is a manually-configured env var that can drift from the
  // actual public URL Twilio posts to (custom domain changes, Railway URL changes, etc).
  // Fall back to the request's own protocol/host (trustProxy honours X-Forwarded-*) so a
  // stale env var doesn't hard-reject every inbound message.
  const requestDerivedUrl = `${request.protocol}://${request.hostname}${request.url}`;
  const sigValid = twilioMessaging.verifyWebhook(params, signature, [requestDerivedUrl]);
  if (!sigValid) {
    const allowUnsignedDev =
      env.NODE_ENV !== 'production' && !env.TWILIO_AUTH_TOKEN?.trim();
    if (!allowUnsignedDev) {
      logger.warn({
        expectedUrl: `${env.TWILIO_WEBHOOK_BASE_URL}/webhooks/twilio/whatsapp`,
        requestDerivedUrl,
        hasSig: !!signature,
      }, 'twilio_signature_invalid');
      logMessageLog({ direction: 'INBOUND', status: 'FAILED' });
      return reply.code(403).send('Forbidden');
    }
    logger.warn({ hasSig: !!signature }, 'twilio_signature_skipped_dev');
  }

  const messageSid = params['MessageSid'] ?? '';
  const from = params['From'] ?? '';
  const to = params['To'] ?? '';
  // Quick Reply (twilio/quick-reply) taps set Body to the button's human-readable
  // title and the machine-readable id separately in ButtonPayload — our menus use
  // plain numbers ("1"/"2"/"3") as ids, so prefer ButtonPayload whenever it's purely
  // numeric. Non-numeric ids (e.g. accept_all, yes, back) fall through to Body
  // unchanged, since several flows match on the literal title text. List Picker taps
  // already report the row id straight in Body, so they're unaffected either way.
  const buttonPayload = (params['ButtonPayload'] ?? '').trim();
  const body = /^\d+$/.test(buttonPayload) ? buttonPayload : params['Body'] ?? '';

  const tenantForTo = to ? await resolveTenantFromTwilioAddress(to) : null;
  if (to && !tenantForTo) {
    logger.error(
      { twilioTo: to, from: params['From'], messageSid: params['MessageSid'] ?? null },
      'twilio_webhook_unmatched_to_number — no tenant has this twilioWhatsAppNumber; check admin assignment',
    );
    logMessageLog({ direction: 'INBOUND', status: 'FAILED' });
    // 404 so ops/monitoring can alert; Twilio gets empty TwiML (no auto-reply to customer).
    return reply.code(404).type('text/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    );
  }

  if (messageSid) {
    try {
      const dedupeKey = `msg:${messageSid}`;
      const first = await redis.set(dedupeKey, '1', 'EX', 86400, 'NX');
      if (first !== 'OK') {
        logger.info({ messageSid }, 'twilio_dedupe_blocked');
        return reply.send('');
      }
    } catch {
      // Redis unavailable — skip deduplication
    }
    const tenant = tenantForTo;
    const recorded = await recordWebhookEvent({
      provider: 'twilio',
      providerEventId: messageSid,
      payload: params,
      verified: sigValid,
      salonId: tenant?.id,
    });
    if (recorded === 'duplicate') {
      logger.info({ messageSid }, 'twilio_webhook_duplicate');
      return reply.send('');
    }
  }

  try {
    // Inbound customer messages update lastCustomerMessageAt in handleInboundWhatsApp (bot.ts).
    await handleInboundWhatsApp({
      from,
      body,
      messageSid,
      twilioTo: to,
    });
    logger.info({ from, bodyLen: body.length }, 'twilio_bot_handled_ok');
  } catch (botErr: unknown) {
    logger.error({ err: botErr }, 'twilio_bot_error');
  }

  return reply.type('text/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
  );
}
