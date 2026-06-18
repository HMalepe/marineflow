import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractiveList } from '../lib/integrations/messaging/types.js';

const { sendTextMock, twilioSendMock, findUniqueOrThrowMock } = vi.hoisted(() => ({
  sendTextMock: vi.fn(),
  twilioSendMock: vi.fn(),
  findUniqueOrThrowMock: vi.fn(),
}));

vi.mock('../lib/db/tenantSession.js', () => ({
  getTenantDb: () => ({
    salon: { findUniqueOrThrow: findUniqueOrThrowMock },
  }),
}));

vi.mock('../lib/integrations/messaging/whatsapp-cloud-impl.js', () => ({
  whatsappCloudMessaging: { sendText: sendTextMock },
}));

vi.mock('../lib/integrations/messaging/twilio-impl.js', () => ({
  twilioMessaging: { sendText: twilioSendMock },
}));

vi.mock('../lib/integrations/messaging/sms-impl.js', () => ({
  smsMessaging: { sendText: vi.fn() },
}));

vi.mock('../lib/integrations/messaging/voice.js', () => ({
  callBookingConfirmation: vi.fn(),
}));

vi.mock('../config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config.js')>();
  return {
    ...actual,
    isTwilioConfigured: () => false,
    isTwilioAccountConfigured: () => true,
  };
});

import { sendWithFallback } from './channelRouter.js';

const interactiveMenu: InteractiveList = {
  type: 'list',
  body: 'Welcome',
  button: 'Menu',
  sections: [{ rows: [{ id: '1', title: 'Book' }] }],
};

describe('sendWithFallback — interactive list delivery', () => {
  beforeEach(() => {
    sendTextMock.mockReset();
    twilioSendMock.mockReset();
    findUniqueOrThrowMock.mockReset();
  });

  it('sends interactive list via Twilio Content API (never Meta Cloud interactive)', async () => {
    findUniqueOrThrowMock.mockResolvedValue({
      whatsappPhoneId: 'PHONE123',
      twilioWhatsAppFrom: 'whatsapp:+14155238886',
    });
    twilioSendMock.mockResolvedValueOnce({ providerMessageId: 'SM.interactive' });

    const result = await sendWithFallback({
      salonId: 'salon-1',
      to: '+27820000000',
      body: 'Plain fallback body',
      interactive: interactiveMenu,
    });

    expect(result.channel).toBe('whatsapp');
    expect(result.result.providerMessageId).toBe('SM.interactive');
    expect(sendTextMock).not.toHaveBeenCalled();
    expect(twilioSendMock).toHaveBeenCalledTimes(1);
    expect(twilioSendMock.mock.calls[0]![0]).toMatchObject({
      to: 'whatsapp:+27820000000',
      interactive: interactiveMenu,
      body: 'Plain fallback body',
      twilioFrom: 'whatsapp:+14155238886',
    });
  });

  it('retries plain text on Twilio when interactive send throws', async () => {
    findUniqueOrThrowMock.mockResolvedValue({
      whatsappPhoneId: 'PHONE123',
      twilioWhatsAppFrom: '+14155238886',
    });
    twilioSendMock
      .mockRejectedValueOnce(new Error('Twilio Content API error'))
      .mockResolvedValueOnce({ providerMessageId: 'SM.plain' });

    const result = await sendWithFallback({
      salonId: 'salon-1',
      to: '+27820000000',
      body: '1 — Book\n2 — My bookings',
      interactive: interactiveMenu,
    });

    expect(result.result.providerMessageId).toBe('SM.plain');
    expect(sendTextMock).not.toHaveBeenCalled();
    expect(twilioSendMock).toHaveBeenCalledTimes(2);
    expect(twilioSendMock.mock.calls[0]![0].interactive).toBeDefined();
    expect(twilioSendMock.mock.calls[1]![0].interactive).toBeUndefined();
  });

  it('retries plain text on Twilio when interactive returns empty providerMessageId', async () => {
    findUniqueOrThrowMock.mockResolvedValue({
      whatsappPhoneId: null,
      twilioWhatsAppFrom: '+14155238886',
    });
    twilioSendMock
      .mockResolvedValueOnce({ providerMessageId: null })
      .mockResolvedValueOnce({ providerMessageId: 'SM.plain' });

    const result = await sendWithFallback({
      salonId: 'salon-1',
      to: '+27820000000',
      body: 'Menu text',
      interactive: interactiveMenu,
    });

    expect(result.result.providerMessageId).toBe('SM.plain');
    expect(sendTextMock).not.toHaveBeenCalled();
    expect(twilioSendMock).toHaveBeenCalledTimes(2);
  });

  it('uses Twilio when whatsappPhoneId is whitespace', async () => {
    findUniqueOrThrowMock.mockResolvedValue({
      whatsappPhoneId: '   ',
      twilioWhatsAppFrom: '+14155238886',
    });
    twilioSendMock.mockResolvedValue({ providerMessageId: 'SM123' });

    await sendWithFallback({
      salonId: 'salon-1',
      to: '+27820000000',
      body: 'Hello',
      interactive: interactiveMenu,
    });

    expect(sendTextMock).not.toHaveBeenCalled();
    expect(twilioSendMock).toHaveBeenCalled();
  });

  it('passes interactive payload to Twilio on Twilio-only tenant', async () => {
    findUniqueOrThrowMock.mockResolvedValue({
      whatsappPhoneId: null,
      twilioWhatsAppFrom: '+14155238886',
    });
    twilioSendMock.mockResolvedValue({ providerMessageId: 'SM999' });

    await sendWithFallback({
      salonId: 'salon-1',
      to: '+27820000000',
      body: 'Plain menu',
      interactive: interactiveMenu,
    });

    expect(sendTextMock).not.toHaveBeenCalled();
    expect(twilioSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Plain menu',
        to: 'whatsapp:+27820000000',
        interactive: interactiveMenu,
        twilioFrom: 'whatsapp:+14155238886',
      }),
    );
  });
});
