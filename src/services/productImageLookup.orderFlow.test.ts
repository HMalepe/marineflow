import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOrCreateConversationState = vi.fn();
const setConversationState = vi.fn();
const findClientByWhatsApp = vi.fn();
const upsertClientName = vi.fn();
const updateClientAddress = vi.fn();
const createOrder = vi.fn();
const findSupabaseProductsByName = vi.fn();
const getSupabaseProductImageMessage = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    service: { findMany: vi.fn(), findFirst: vi.fn() },
    salon: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'salon_dm',
        industryTemplate: 'dispensary',
        isBusinessRouter: false,
      }),
    },
  },
}));

vi.mock('../lib/supabase.js', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseAdmin: () => ({}),
}));

vi.mock('../lib/supabaseConversationState.js', () => ({
  getOrCreateConversationState: (...a: unknown[]) => getOrCreateConversationState(...a),
  setConversationState: (...a: unknown[]) => setConversationState(...a),
  findClientByWhatsApp: (...a: unknown[]) => findClientByWhatsApp(...a),
  upsertClientName: (...a: unknown[]) => upsertClientName(...a),
  updateClientAddress: (...a: unknown[]) => updateClientAddress(...a),
  createOrder: (...a: unknown[]) => createOrder(...a),
  clientIsComplete: (c: { name?: string | null; delivery_address?: string | null } | null) =>
    Boolean(c?.name?.trim() && c?.delivery_address?.trim()),
}));

vi.mock('../lib/supabaseProductImages.js', () => ({
  findProductsByName: (...a: unknown[]) => findSupabaseProductsByName(...a),
  getProductImageMessage: (...a: unknown[]) => getSupabaseProductImageMessage(...a),
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

import { handleIncomingMessage } from './productImageLookup.js';

describe('supabase order flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setConversationState.mockResolvedValue({});
    createOrder.mockResolvedValue({ id: 'ord-abcdef12', client_id: 'c1', items: [], status: 'pending' });
    getSupabaseProductImageMessage.mockResolvedValue({
      messaging_product: 'whatsapp',
      to: '<PLACEHOLDER_PHONE>',
      type: 'image',
      image: { link: 'https://cdn/p.jpg', caption: 'Product' },
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

  it('after a single product hit asks for YES and stores awaiting_confirmation', async () => {
    getOrCreateConversationState.mockResolvedValue({
      whatsapp_number: '27820000000',
      state: 'idle',
      pending_product_id: null,
    });
    findSupabaseProductsByName.mockResolvedValue([
      { id: 'prod-1', name: 'Miami Heat 5g', price: 600, image_url: 'https://cdn/p.jpg', caption: 'x' },
    ]);

    const handled = await handleIncomingMessage({
      from: '27820000000',
      salonId: 'salon_dm',
      text: { body: 'miami heat' },
    });

    expect(handled).toBe(true);
    expect(setConversationState).toHaveBeenCalledWith('27820000000', {
      state: 'awaiting_confirmation',
      pending_product_id: 'prod-1',
    });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const bodies = fetchMock.mock.calls.map(
      (c) => JSON.parse(c[1].body as string) as { type: string; text?: { body: string } },
    );
    expect(bodies.some((b) => b.type === 'image')).toBe(true);
    expect(bodies.some((b) => b.text?.body.includes('YES'))).toBe(true);
  });

  it('YES with complete client creates order immediately', async () => {
    getOrCreateConversationState.mockResolvedValue({
      whatsapp_number: '27820000000',
      state: 'awaiting_confirmation',
      pending_product_id: 'prod-1',
    });
    findClientByWhatsApp.mockResolvedValue({
      id: 'client-1',
      whatsapp_number: '27820000000',
      name: 'Holiday',
      delivery_address: '12 Main Rd',
    });

    const handled = await handleIncomingMessage({
      from: '27820000000',
      salonId: 'salon_dm',
      text: { body: 'yes' },
    });

    expect(handled).toBe(true);
    expect(createOrder).toHaveBeenCalledWith({ clientId: 'client-1', productId: 'prod-1' });
    expect(setConversationState).toHaveBeenCalledWith('27820000000', {
      state: 'idle',
      pending_product_id: null,
    });
  });

  it('YES without client asks for name', async () => {
    getOrCreateConversationState.mockResolvedValue({
      whatsapp_number: '27820000000',
      state: 'awaiting_confirmation',
      pending_product_id: 'prod-1',
    });
    findClientByWhatsApp.mockResolvedValue(null);

    await handleIncomingMessage({
      from: '27820000000',
      salonId: 'salon_dm',
      text: { body: 'YES' },
    });

    expect(setConversationState).toHaveBeenCalledWith('27820000000', {
      state: 'awaiting_name',
      pending_product_id: 'prod-1',
    });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as { text: { body: string } };
    expect(sent.text.body.toLowerCase()).toContain('name');
  });

  it('awaiting_name saves name and asks for address', async () => {
    getOrCreateConversationState.mockResolvedValue({
      whatsapp_number: '27820000000',
      state: 'awaiting_name',
      pending_product_id: 'prod-1',
    });
    upsertClientName.mockResolvedValue({
      id: 'c1',
      whatsapp_number: '27820000000',
      name: 'Sam',
      delivery_address: null,
    });

    await handleIncomingMessage({
      from: '27820000000',
      salonId: 'salon_dm',
      text: { body: 'Sam' },
    });

    expect(upsertClientName).toHaveBeenCalledWith('27820000000', 'Sam');
    expect(setConversationState).toHaveBeenCalledWith('27820000000', {
      state: 'awaiting_address',
      pending_product_id: 'prod-1',
    });
  });

  it('awaiting_address saves address and places the order', async () => {
    getOrCreateConversationState.mockResolvedValue({
      whatsapp_number: '27820000000',
      state: 'awaiting_address',
      pending_product_id: 'prod-1',
    });
    updateClientAddress.mockResolvedValue({
      id: 'c1',
      whatsapp_number: '27820000000',
      name: 'Sam',
      delivery_address: '99 Beach Rd',
    });

    await handleIncomingMessage({
      from: '27820000000',
      salonId: 'salon_dm',
      text: { body: '99 Beach Rd' },
    });

    expect(updateClientAddress).toHaveBeenCalledWith('27820000000', '99 Beach Rd');
    expect(createOrder).toHaveBeenCalledWith({ clientId: 'c1', productId: 'prod-1' });
  });
});
