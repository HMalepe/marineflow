import { beforeEach, describe, expect, it, vi } from 'vitest';

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock('./supabase.js', () => ({
  getSupabaseAdmin: () => ({ from }),
  isSupabaseConfigured: () => true,
}));

import { getProductImageMessage } from './supabaseProductImages.js';

describe('getProductImageMessage (Supabase)', () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    eq.mockClear();
    select.mockClear();
    from.mockClear();
  });

  it('returns the exact WhatsApp Cloud image payload shape', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Paracetamol 500mg',
        price: 45,
        image_url: 'https://xyz.supabase.co/storage/v1/object/public/product-images/para.jpg',
        caption: 'Pain relief, 20 tablets',
        created_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });

    const payload = await getProductImageMessage('11111111-1111-1111-1111-111111111111');

    expect(payload).toEqual({
      messaging_product: 'whatsapp',
      to: '<PLACEHOLDER_PHONE>',
      type: 'image',
      image: {
        link: 'https://xyz.supabase.co/storage/v1/object/public/product-images/para.jpg',
        caption: 'Pain relief, 20 tablets',
      },
    });
    expect(from).toHaveBeenCalledWith('products');
  });

  it('fails loudly when the product is missing', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getProductImageMessage('missing')).rejects.toThrow(/not found/i);
  });

  it('fails loudly when image_url is empty', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: 'p1',
        name: 'No photo',
        price: 10,
        image_url: null,
        caption: 'x',
        created_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });
    await expect(getProductImageMessage('p1')).rejects.toThrow(/no image_url/i);
  });
});
