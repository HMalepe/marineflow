import { getTenantDb } from '../lib/db/tenantSession.js';
import { twilioMessaging } from '../lib/integrations/messaging/twilio-impl.js';
import { whatsappCloudMessaging } from '../lib/integrations/messaging/whatsapp-cloud-impl.js';
import { smsMessaging } from '../lib/integrations/messaging/sms-impl.js';
import { callBookingConfirmation } from '../lib/integrations/messaging/voice.js';
import { logger } from '../lib/logger.js';
import { isTwilioAccountConfigured } from '../config.js';
import { normalizeTwilioWhatsAppFrom } from '../lib/salonDefaults.js';
import { getTenantWhatsAppFrom } from '../lib/twilio.js';
import { logMessageLog } from './messageLog.js';
import type { InteractiveMessage, SentMessage } from '../lib/integrations/messaging/types.js';

export type Channel = 'whatsapp' | 'sms' | 'voice';

function logCloudApiFallthrough(cloudPhoneId: string, err: unknown): void {
  const errMsg = err instanceof Error ? err.message : String(err);
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

function resolveTwilioFrom(salonTwilioWhatsAppNumber: string | null | undefined): string | null {
  const raw = salonTwilioWhatsAppNumber?.trim();
  if (!raw) return null;
  return normalizeTwilioWhatsAppFrom(raw);
}

function twilioToAddress(e164: string): string {
  const digits = e164.replace(/^whatsapp:/i, '').replace(/^\+/, '');
  return `whatsapp:+${digits}`;
}

function twilioSendOpts(
  params: { to: string; body: string; mediaUrl?: string; mediaType?: 'image' | 'video' | 'document' | 'audio'; interactive?: InteractiveMessage },
  twilioFrom: string,
) {
  return {
    to: twilioToAddress(params.to),
    body: params.body,
    mediaUrl: params.mediaUrl,
    mediaType: params.mediaType,
    interactive: params.interactive,
    twilioFrom,
  };
}

function logOutbound(salonId: string, delivered: boolean): void {
  logMessageLog({
    salonId,
    direction: 'OUTBOUND',
    status: delivered ? 'DELIVERED' : 'FAILED',
  });
}

/**
 * - Interactive (lists/buttons): Twilio Content API only — Meta interactive permissions not used.
 * - Plain text: WhatsApp Cloud API > Twilio WhatsApp > SMS.
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
    select: { whatsappPhoneId: true, twilioWhatsAppNumber: true },
  });

  const sendOpts = {
    to: params.to,
    body: params.body,
    mediaUrl: params.mediaUrl,
    mediaType: params.mediaType,
  };

  const cloudPhoneId = salon.whatsappPhoneId?.trim();
  const twilioFrom = resolveTwilioFrom(salon.twilioWhatsAppNumber);
  const twilioReady = isTwilioAccountConfigured() && twilioFrom != null;

  if (!twilioFrom && !cloudPhoneId) {
    try {
      await getTenantWhatsAppFrom(params.salonId);
    } catch (err) {
      logger.error({ err, salonId: params.salonId }, 'tenant_missing_twilio_whatsapp_number');
    }
  }

  // Interactive lists/buttons — Twilio Content API only (no Meta Cloud interactive).
  if (params.interactive) {
    if (twilioReady && twilioFrom) {
      try {
        const result = await twilioMessaging.sendText(
          twilioSendOpts({ ...sendOpts, interactive: params.interactive }, twilioFrom),
        );
        if (result.providerMessageId) {
          logOutbound(params.salonId, true);
          return { channel: 'whatsapp', result };
        }
        logger.warn({ salonId: params.salonId }, 'twilio_interactive_empty_id_retry_plain');
      } catch (err) {
        logger.warn({ err, salonId: params.salonId }, 'twilio_interactive_fallthrough');
      }

      try {
        const result = await twilioMessaging.sendText(
          twilioSendOpts(sendOpts, twilioFrom),
        );
        if (result.providerMessageId) {
          logOutbound(params.salonId, true);
          return { channel: 'whatsapp', result };
        }
      } catch (err) {
        logger.warn({ err }, 'twilio_whatsapp_fallthrough');
      }
    }
  } else if (cloudPhoneId) {
    try {
      const result = await whatsappCloudMessaging.sendText({
        ...sendOpts,
        phoneNumberId: cloudPhoneId,
      });
      if (result.providerMessageId) {
        logOutbound(params.salonId, true);
        return { channel: 'whatsapp', result };
      }
    } catch (err) {
      logCloudApiFallthrough(cloudPhoneId, err);
    }

    if (twilioReady && twilioFrom) {
      try {
        const result = await twilioMessaging.sendText(twilioSendOpts(sendOpts, twilioFrom));
        if (result.providerMessageId) {
          logOutbound(params.salonId, true);
          return { channel: 'whatsapp', result };
        }
      } catch (err) {
        logger.warn({ err }, 'twilio_whatsapp_fallthrough');
      }
    }
  } else if (twilioReady && twilioFrom) {
    try {
      const result = await twilioMessaging.sendText(twilioSendOpts(sendOpts, twilioFrom));
      if (result.providerMessageId) {
        logOutbound(params.salonId, true);
        return { channel: 'whatsapp', result };
      }
    } catch (err) {
      logger.warn({ err }, 'twilio_whatsapp_fallthrough');
    }
  }

  // Media newsletters must stay on WhatsApp — SMS cannot carry attachments.
  if (!params.mediaUrl) {
    try {
      const result = await smsMessaging.sendText({
        to: params.to,
        body: params.body,
      });
      if (result?.providerMessageId) {
        logOutbound(params.salonId, true);
        return { channel: 'sms', result };
      }
    } catch (err) {
      logger.warn({ err }, 'sms_fallthrough');
    }
  }

  logger.error({ to: params.to, salonId: params.salonId }, 'all_channels_failed');
  logOutbound(params.salonId, false);
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
