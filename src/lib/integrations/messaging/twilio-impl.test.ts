import { describe, expect, it } from 'vitest';
import { twilioMessaging } from './twilio-impl.js';

describe('twilioMessaging.parseInboundBatch', () => {
  it('uses the numeric ButtonPayload id for Quick Reply menu taps', () => {
    const [msg] = twilioMessaging.parseInboundBatch({
      From: 'whatsapp:+27821234567',
      To: 'whatsapp:+14155238886',
      Body: 'Packages',
      ButtonPayload: '2',
      MessageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    });
    expect(msg?.body).toBe('2');
  });

  it('falls back to Body when ButtonPayload is a non-numeric id', () => {
    const [msg] = twilioMessaging.parseInboundBatch({
      From: 'whatsapp:+27821234567',
      To: 'whatsapp:+14155238886',
      Body: 'Accept all',
      ButtonPayload: 'accept_all',
      MessageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    });
    expect(msg?.body).toBe('Accept all');
  });

  it('falls back to Body when there is no ButtonPayload (List Picker taps)', () => {
    const [msg] = twilioMessaging.parseInboundBatch({
      From: 'whatsapp:+27821234567',
      To: 'whatsapp:+14155238886',
      Body: '4',
      MessageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    });
    expect(msg?.body).toBe('4');
  });

  it('falls back to Body for plain text messages', () => {
    const [msg] = twilioMessaging.parseInboundBatch({
      From: 'whatsapp:+27821234567',
      To: 'whatsapp:+14155238886',
      Body: 'Hi, what time do you close?',
      MessageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    });
    expect(msg?.body).toBe('Hi, what time do you close?');
  });
});
