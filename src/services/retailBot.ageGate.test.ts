import { describe, expect, it } from 'vitest';
import { isAgeGateNo, isAgeGateYes } from './retailBot.js';
import { twilioMessaging } from '../lib/integrations/messaging/twilio-impl.js';
import { extractInboundBody } from '../lib/integrations/messaging/whatsapp-cloud-impl.js';

describe('age gate button matching', () => {
  it('accepts id, typed yes, and WhatsApp button title', () => {
    expect(isAgeGateYes('yes')).toBe(true);
    expect(isAgeGateYes('YES')).toBe(true);
    expect(isAgeGateYes('y')).toBe(true);
    expect(isAgeGateYes('1')).toBe(true);
    expect(isAgeGateYes('Yes, I am 18+')).toBe(true);
    expect(isAgeGateYes('yes i am 18+')).toBe(true);
    expect(isAgeGateYes('yeah')).toBe(true);
  });

  it('rejects unrelated text so age gate can re-prompt', () => {
    expect(isAgeGateYes('greenhouse')).toBe(false);
    expect(isAgeGateYes('menu')).toBe(false);
  });

  it('accepts no / exit title', () => {
    expect(isAgeGateNo('no')).toBe(true);
    expect(isAgeGateNo('No / exit')).toBe(true);
    expect(isAgeGateNo('2')).toBe(true);
  });
});

describe('inbound button payload preference', () => {
  it('Twilio prefers ButtonPayload id over Body title', () => {
    const batch = twilioMessaging.parseInboundBatch({
      From: 'whatsapp:+27820000000',
      To: 'whatsapp:+27000000000',
      MessageSid: 'SM123',
      Body: 'Yes, I am 18+',
      ButtonPayload: 'yes',
    });
    expect(batch[0]?.body).toBe('yes');
  });

  it('Meta falls back to button title when id is missing', () => {
    expect(
      extractInboundBody({
        interactive: { button_reply: { title: 'Yes, I am 18+' } },
      }),
    ).toBe('Yes, I am 18+');
  });
});
