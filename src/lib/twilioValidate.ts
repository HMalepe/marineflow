import twilio from 'twilio';
import { env } from '../config.js';

/**
 * Validate Twilio webhook signature. `url` must be the full URL Twilio posted to
 * (scheme + host + path + querystring if any).
 *
 * In development with no auth token configured, validation is skipped so you can
 * test via curl or ngrok without real Twilio credentials.
 */
export function validateTwilioRequest(
  signature: string | undefined,
  url: string,
  params: Record<string, string>,
): boolean {
  const token = env.TWILIO_AUTH_TOKEN;
  if (!token) return env.NODE_ENV === 'development';
  if (!signature) return false;
  return twilio.validateRequest(token, signature, url, params);
}
