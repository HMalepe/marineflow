import { beforeEach, describe, expect, it, vi } from 'vitest';

const findMany = vi.fn();
const findFirstService = vi.fn();
const findFirstSalon = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    service: {
      findMany: (...args: unknown[]) => findMany(...args),
      findFirst: (...args: unknown[]) => findFirstService(...args),
    },
    salon: {
      findFirst: (...args: unknown[]) => findFirstSalon(...args),
    },
  },
}));

vi.mock('../lib/supabase.js', () => ({
  isSupabaseConfigured: () => false,
  getSupabaseAdmin: () => {
    throw new Error('supabase not configured in this test');
  },
}));

vi.mock('../lib/tenant.js', () => ({
  resolveTenantForInbound: vi.fn(),
}));

vi.mock('../config.js', () => ({
  env: {
    META_ACCESS_TOKEN: 'test-token',
    META_PHONE_NUMBER_ID: 'phone-id',
    META_API_VERSION: 'v21.0',
  },
}));

import {
  handleIncomingMessage,
  sendTextMessage,
  sendWhatsAppMessage,
} from './productImageLookup.js';

const product = {
  id: 'svc_1',
  name: 'Miami Heat 5g',
  priceCents: 60000,
  imageUrl: 'https://cdn.example.com/miami.jpg',
  imageCaption: 'Miami Heat — sativa',
  description: 'Sativa flower — 5g.',
};

describe('product image lookup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    findMany.mockReset();
    findFirstService.mockReset();
    findFirstSalon.mockReset();
    findFirstSalon.mockResolvedValue({
      id: 'salon_dm',
      industryTemplate: 'dispensary',
      isBusinessRouter: false,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ messages: [{ id: 'wamid.1' }] }),
      }),
    );
  });

  it('skips non-text inbound types', async () => {
    const handled = await handleIncomingMessage({
      from: '27820000000',
      type: 'image',
      salonId: 'salon_dm',
      text: { body: 'Miami Heat' },
    });
    expect(handled).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('sends the product image when exactly one name matches', async () => {
    findMany.mockResolvedValue([product]);
    findFirstService.mockResolvedValue(product);

    const handled = await handleIncomingMessage({
      from: '27820000000',
      type: 'text',
      salonId: 'salon_dm',
      text: { body: 'miami heat 5g' },
    });

    expect(handled).toBe(true);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as {
      type: string;
      to: string;
      image: { link: string; caption: string };
    };
    expect(sent.type).toBe('image');
    expect(sent.to).toBe('27820000000');
    expect(sent.image.link).toBe(product.imageUrl);
    expect(sent.image.caption).toContain('Miami Heat');
  });

  it('lists names when several products match', async () => {
    findMany.mockResolvedValue([
      { ...product, id: 'a', name: 'Greenhouse 10g' },
      { ...product, id: 'b', name: 'Greenhouse 20g' },
    ]);

    const handled = await handleIncomingMessage({
      from: '27820000000',
      salonId: 'salon_dm',
      text: { body: 'greenhouse' },
    });

    expect(handled).toBe(true);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as {
      type: string;
      text: { body: string };
    };
    expect(sent.type).toBe('text');
    expect(sent.text.body).toContain('Greenhouse 10g');
    expect(sent.text.body).toContain('more specific');
  });

  it('tells the customer when a photo request has no match', async () => {
    findMany.mockResolvedValue([]);

    const handled = await handleIncomingMessage({
      from: '27820000000',
      salonId: 'salon_dm',
      text: { body: 'photo unicorn butter' },
    });

    expect(handled).toBe(true);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as {
      text: { body: string };
    };
    expect(sent.text.body.toLowerCase()).toContain('no product matched');
  });

  it('falls through when a bare greeting has no product match', async () => {
    const handled = await handleIncomingMessage({
      from: '27820000000',
      salonId: 'salon_dm',
      text: { body: 'hi' },
    });
    expect(handled).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('does not crash when the catalog query fails', async () => {
    findMany.mockRejectedValue(new Error('db down'));
    const handled = await handleIncomingMessage({
      from: '27820000000',
      salonId: 'salon_dm',
      text: { body: 'miami' },
    });
    expect(handled).toBe(false);
  });

  it('sendWhatsAppMessage throws on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        text: async () => '{"error":"bad"}',
      }),
    );
    await expect(
      sendTextMessage('27820000000', 'hello'),
    ).rejects.toThrow(/400/);
  });

  it('fills to on sendWhatsAppMessage', async () => {
    await sendWhatsAppMessage('27820000000', {
      messaging_product: 'whatsapp',
      type: 'text',
      text: { body: 'hello' },
    });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as { to: string };
    expect(sent.to).toBe('27820000000');
    expect(fetchMock.mock.calls[0]![0]).toContain('/phone-id/messages');
  });
});
