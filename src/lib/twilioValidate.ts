import twilio from 'twilio';
import { env } from '../config.js';

/**
 * Validate Twilio webhook signature. `url` must be the full URL Twilio posted to
 * (scheme + host + path + querystring if any).
 */
export function validateTwilioRequest(
  signature: string | undefined,
  url: string,
  params: Record<string, string>,
): boolean {
  const token = env.TWILIO_AUTH_TOKEN;
  if (!signature || !token) return false;
  return twilio.validateRequest(token, signature, url, params);
}
