import { getTenantDb } from '../lib/db/tenantSession.js';
import { twilioMessaging } from '../lib/integrations/messaging/twilio-impl.js';
import { whatsappCloudMessaging } from '../lib/integrations/messaging/whatsapp-cloud-impl.js';
import { smsMessaging } from '../lib/integrations/messaging/sms-impl.js';
import { callBookingConfirmation } from '../lib/integrations/messaging/voice.js';
import { logger } from '../lib/logger.js';
import { isTwilioConfigured } from '../config.js';
import type { SentMessage } from '../lib/integrations/messaging/types.js';

export type Channel = 'whatsapp' | 'sms' | 'voice';

/**
 * Channel priority: WhatsApp (Cloud API) > WhatsApp (Twilio) > SMS > Voice.
 * Attempts delivery on the highest-priority available channel.
 * Falls back to the next channel on failure.
 */
export async function sendWithFallback(params: {
  salonId: string;
  to: string;
  body: string;
  phoneNumberId?: string;
}): Promise<{ channel: Channel; result: SentMessage }> {
  const salon = await getTenantDb().salon.findUniqueOrThrow({
    where: { id: params.salonId },
    select: { whatsappPhoneId: true, twilioWhatsAppFrom: true },
  });

  // Try WhatsApp Cloud API
  if (salon.whatsappPhoneId) {
    try {
      const result = await whatsappCloudMessaging.sendText({
        to: params.to,
        body: params.body,
        phoneNumberId: salon.whatsappPhoneId,
      });
      if (result.providerMessageId) {
        return { channel: 'whatsapp', result };
      }
    } catch (err) {
      logger.warn({ err }, 'whatsapp_cloud_fallthrough');
    }
  }

  // Try WhatsApp via Twilio — gate on DB field OR env-level config so that
  // deployments that set TWILIO_* env vars without the salon DB field still work.
  if (salon.twilioWhatsAppFrom || isTwilioConfigured()) {
    try {
      const result = await twilioMessaging.sendText({
        to: `whatsapp:${params.to}`,
        body: params.body,
      });
      if (result.providerMessageId) {
        return { channel: 'whatsapp', result };
      }
    } catch (err) {
      logger.warn({ err }, 'twilio_whatsapp_fallthrough');
    }
  }

  // Fallback to SMS
  try {
    const result = await smsMessaging.sendText({
      to: params.to,
      body: params.body,
    });
    if (result.providerMessageId) {
      return { channel: 'sms', result };
    }
  } catch (err) {
    logger.warn({ err }, 'sms_fallthrough');
  }

  // All channels failed
  logger.error({ to: params.to, salonId: params.salonId }, 'all_channels_failed');
  return { channel: 'sms', result: { providerMessageId: null } };
}

/**
 * Send a voice confirmation call (last resort / special confirmation).
 */
export async function sendVoiceConfirmation(params: {
  to: string;
  customerName: string;
  serviceName: string;
  dateFormatted: string;
  staffName: string;
}) {
  return callBookingConfirmation(params);
}
