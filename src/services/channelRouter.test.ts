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

  it('sends interactive list on Cloud API tenant', async () => {
    findUniqueOrThrowMock.mockResolvedValue({
      whatsappPhoneId: 'PHONE123',
      twilioWhatsAppFrom: null,
    });
    sendTextMock.mockResolvedValueOnce({ providerMessageId: 'wamid.interactive' });

    const result = await sendWithFallback({
      salonId: 'salon-1',
      to: '+27820000000',
      body: 'Plain fallback body',
      interactive: interactiveMenu,
    });

    expect(result.channel).toBe('whatsapp');
    expect(result.result.providerMessageId).toBe('wamid.interactive');
    expect(sendTextMock).toHaveBeenCalledTimes(1);
    expect(sendTextMock.mock.calls[0]![0]).toMatchObject({
      phoneNumberId: 'PHONE123',
      interactive: interactiveMenu,
      body: 'Plain fallback body',
    });
  });

  it('retries plain text when interactive send throws — customer never sees error', async () => {
    findUniqueOrThrowMock.mockResolvedValue({
      whatsappPhoneId: 'PHONE123',
      twilioWhatsAppFrom: null,
    });
    sendTextMock
      .mockRejectedValueOnce(new Error('Meta: interactive not enabled'))
      .mockResolvedValueOnce({ providerMessageId: 'wamid.plain' });

    const result = await sendWithFallback({
      salonId: 'salon-1',
      to: '+27820000000',
      body: '1 — Book\n2 — My bookings',
      interactive: interactiveMenu,
    });

    expect(result.result.providerMessageId).toBe('wamid.plain');
    expect(sendTextMock).toHaveBeenCalledTimes(2);
    expect(sendTextMock.mock.calls[0]![0].interactive).toBeDefined();
    expect(sendTextMock.mock.calls[1]![0].interactive).toBeUndefined();
  });

  it('retries plain text when interactive returns empty providerMessageId', async () => {
    findUniqueOrThrowMock.mockResolvedValue({
      whatsappPhoneId: 'PHONE123',
      twilioWhatsAppFrom: null,
    });
    sendTextMock
      .mockResolvedValueOnce({ providerMessageId: null })
      .mockResolvedValueOnce({ providerMessageId: 'wamid.plain' });

    const result = await sendWithFallback({
      salonId: 'salon-1',
      to: '+27820000000',
      body: 'Menu text',
      interactive: interactiveMenu,
    });

    expect(result.result.providerMessageId).toBe('wamid.plain');
    expect(sendTextMock).toHaveBeenCalledTimes(2);
  });

  it('does not attempt Cloud API when whatsappPhoneId is whitespace', async () => {
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

  it('never passes interactive to Twilio (plain body only)', async () => {
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
      }),
    );
    expect(twilioSendMock.mock.calls[0]![0]).not.toHaveProperty('interactive');
  });
});
