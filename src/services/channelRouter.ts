import { getTenantDb } from '../lib/db/tenantSession.js';
import { twilioMessaging } from '../lib/integrations/messaging/twilio-impl.js';
import { whatsappCloudMessaging } from '../lib/integrations/messaging/whatsapp-cloud-impl.js';
import { smsMessaging } from '../lib/integrations/messaging/sms-impl.js';
import { callBookingConfirmation } from '../lib/integrations/messaging/voice.js';
import { logger } from '../lib/logger.js';
import { isTwilioConfigured } from '../config.js';
import type { InteractiveMessage, SentMessage } from '../lib/integrations/messaging/types.js';

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
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document' | 'audio';
  interactive?: InteractiveMessage;
}): Promise<{ channel: Channel; result: SentMessage }> {
  const salon = await getTenantDb().salon.findUniqueOrThrow({
    where: { id: params.salonId },
    select: { whatsappPhoneId: true, twilioWhatsAppFrom: true },
  });

  const sendOpts = {
    to: params.to,
    body: params.body,
    mediaUrl: params.mediaUrl,
    mediaType: params.mediaType,
  };

  // Interactive content (list/button) is sent natively via Twilio's Content API —
  // no Meta Cloud API dependency for interactive messages.
  if (params.interactive) {
    if (salon.twilioWhatsAppFrom || isTwilioConfigured()) {
      try {
        const result = await twilioMessaging.sendText({
          ...sendOpts,
          to: `whatsapp:${params.to}`,
          interactive: params.interactive,
        });
        if (result.providerMessageId) {
          return { channel: 'whatsapp', result };
        }
      } catch (err) {
        logger.warn({ err, salonId: params.salonId }, 'twilio_interactive_fallthrough');
      }
    }

    // Interactive send failed — retry as plain text on Twilio before giving up to SMS.
    if (salon.twilioWhatsAppFrom || isTwilioConfigured()) {
      try {
        const result = await twilioMessaging.sendText({
          ...sendOpts,
          to: `whatsapp:${params.to}`,
        });
        if (result.providerMessageId) {
          return { channel: 'whatsapp', result };
        }
      } catch (err) {
        logger.warn({ err }, 'twilio_whatsapp_fallthrough');
      }
    }
  } else {
    // Try WhatsApp Cloud API
    const cloudPhoneId = salon.whatsappPhoneId?.trim();
    if (cloudPhoneId) {
      try {
        const result = await whatsappCloudMessaging.sendText({
          ...sendOpts,
          phoneNumberId: cloudPhoneId,
        });
        if (result.providerMessageId) {
          return { channel: 'whatsapp', result };
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // Parse structured Meta error so Railway doesn't truncate the one-line JSON
        const metaErrMatch = errMsg.match(/\((\d+)\):\s*(\{.+)/s);
        let metaErrParsed: Record<string, unknown> = {};
        if (metaErrMatch) {
          try { metaErrParsed = JSON.parse(metaErrMatch[2]!) as Record<string, unknown>; } catch { /* ignore */ }
        }
        const metaError = (metaErrParsed as { error?: { code?: number; error_subcode?: number; message?: string; type?: string } }).error;
        logger.warn({
          cloudPhoneId,
          httpStatus: metaErrMatch?.[1],
          metaCode: metaError?.code,
          metaSubcode: metaError?.error_subcode,
          metaType: metaError?.type,
          metaMessage: metaError?.message,
          rawErr: errMsg,
        }, 'whatsapp_cloud_fallthrough');
      }
    }

    // Try WhatsApp via Twilio — gate on DB field OR env-level config so that
    // deployments that set TWILIO_* env vars without the salon DB field still work.
    if (salon.twilioWhatsAppFrom || isTwilioConfigured()) {
      try {
        const result = await twilioMessaging.sendText({
          ...sendOpts,
          to: `whatsapp:${params.to}`,
        });
        if (result.providerMessageId) {
          return { channel: 'whatsapp', result };
        }
      } catch (err) {
        logger.warn({ err }, 'twilio_whatsapp_fallthrough');
      }
    }
  }

  // Media newsletters must stay on WhatsApp — SMS cannot carry attachments.
  if (!params.mediaUrl) {
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
