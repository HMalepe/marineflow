import { logger } from '../../logger.js';

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
const TWILIO_VOICE_FROM = process.env.TWILIO_VOICE_FROM ?? '';
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';

/**
 * Initiate a voice call to confirm a booking using TwiML.
 */
export async function callBookingConfirmation(params: {
  to: string;
  customerName: string;
  serviceName: string;
  dateFormatted: string;
  staffName: string;
}): Promise<{ callSid: string | null }> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_VOICE_FROM) {
    logger.warn('voice_not_configured');
    return { callSid: null };
  }

  const twimlUrl = `${APP_BASE_URL}/api/voice/booking-twiml?` + new URLSearchParams({
    name: params.customerName,
    service: params.serviceName,
    date: params.dateFormatted,
    staff: params.staffName,
  }).toString();

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`;
  const body = new URLSearchParams({
    To: params.to,
    From: TWILIO_VOICE_FROM,
    Url: twimlUrl,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error({ status: res.status, errBody }, 'voice_call_failed');
    return { callSid: null };
  }

  const data = await res.json() as { sid: string };
  return { callSid: data.sid };
}

/**
 * Generate TwiML XML for booking confirmation voice call.
 */
export function generateBookingTwiml(params: {
  name: string;
  service: string;
  date: string;
  staff: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Hello ${escapeXml(params.name)}. 
    This is a booking confirmation. 
    Your appointment for ${escapeXml(params.service)} 
    with ${escapeXml(params.staff)} 
    on ${escapeXml(params.date)} has been confirmed. 
    Thank you, and see you then!
  </Say>
</Response>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
