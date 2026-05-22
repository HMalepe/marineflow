import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { validateTwilioRequest } from './twilioValidate.js';

/** Twilio webhook signature (legacy HMAC-SHA1). */
function signTwilio(token: string, url: string, params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], '');
  const signature = crypto.createHmac('sha1', token).update(url + sorted).digest('base64');
  return signature;
}

describe('validateTwilioRequest', () => {
  it('rejects missing signature', () => {
    expect(
      validateTwilioRequest(undefined, 'http://localhost:3000/webhooks/twilio/whatsapp', {
        Body: 'hi',
      }),
    ).toBe(false);
  });

  it('accepts a valid Twilio signature', () => {
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const url = 'http://localhost:3000/webhooks/twilio/whatsapp';
    const params: Record<string, string> = {
      Body: 'hi',
      From: 'whatsapp:+15555550100',
      To: 'whatsapp:+14155238886',
      MessageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    };
    const signature = signTwilio(token, url, params);
    expect(validateTwilioRequest(signature, url, params)).toBe(true);
  });
});
