/**
 * Supabase products catalog → WhatsApp Cloud API image payloads.
 */

import { getSupabaseAdmin, type SupabaseProduct } from './supabase.js';

export type ProductImageMessage = {
  messaging_product: 'whatsapp';
  to: '<PLACEHOLDER_PHONE>';
  type: 'image';
  image: {
    link: string;
    caption: string;
  };
};

/**
 * Looks up a product by id and returns a Cloud API-ready image payload.
 * Caller must replace `to` with the customer's WhatsApp number.
 */
export async function getProductImageMessage(productId: string): Promise<ProductImageMessage> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, image_url, caption, created_at')
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load product ${productId}: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Product not found: ${productId}`);
  }

  const product = data as SupabaseProduct;
  const link = product.image_url?.trim();
  if (!link) {
    throw new Error(`Product ${productId} has no image_url`);
  }

  return {
    messaging_product: 'whatsapp',
    to: '<PLACEHOLDER_PHONE>',
    type: 'image',
    image: {
      link,
      caption: (product.caption ?? product.name ?? '').trim(),
    },
  };
}

/** Case-insensitive partial name match against the Supabase products table. */
export async function findProductsByName(query: string, limit = 10): Promise<SupabaseProduct[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, image_url, caption, created_at')
    .ilike('name', `%${query.replace(/%/g, '\\%')}%`)
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Product search failed: ${error.message}`);
  }
  return (data ?? []) as SupabaseProduct[];
}
