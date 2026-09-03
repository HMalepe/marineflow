/**
 * Supabase conversation_state helpers for the WhatsApp order flow.
 */

import { getSupabaseAdmin } from './supabase.js';

export type ConversationFlowState =
  | 'idle'
  | 'awaiting_confirmation'
  | 'awaiting_name'
  | 'awaiting_address';

export type ConversationStateRow = {
  whatsapp_number: string;
  state: ConversationFlowState;
  pending_product_id: string | null;
  updated_at: string;
};

export type ConversationStateUpdates = {
  state?: ConversationFlowState;
  pending_product_id?: string | null;
};

function normalizeWhatsAppNumber(raw: string): string {
  return raw.replace(/^\+/, '').replace(/\D/g, '');
}

function idleState(whatsappNumber: string): ConversationStateRow {
  return {
    whatsapp_number: whatsappNumber,
    state: 'idle',
    pending_product_id: null,
    updated_at: new Date().toISOString(),
  };
}

/** Fetch current state, or a default idle object when no row exists. */
export async function getOrCreateConversationState(
  whatsappNumber: string,
): Promise<ConversationStateRow> {
  const number = normalizeWhatsAppNumber(whatsappNumber);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('conversation_state')
    .select('whatsapp_number, state, pending_product_id, updated_at')
    .eq('whatsapp_number', number)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load conversation_state: ${error.message}`);
  }
  if (!data) return idleState(number);

  return {
    whatsapp_number: data.whatsapp_number as string,
    state: (data.state as ConversationFlowState) || 'idle',
    pending_product_id: (data.pending_product_id as string | null) ?? null,
    updated_at: (data.updated_at as string) ?? new Date().toISOString(),
  };
}

/** Upsert conversation state changes for a WhatsApp number. */
export async function setConversationState(
  whatsappNumber: string,
  updates: ConversationStateUpdates,
): Promise<ConversationStateRow> {
  const number = normalizeWhatsAppNumber(whatsappNumber);
  const supabase = getSupabaseAdmin();
  const row = {
    whatsapp_number: number,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('conversation_state')
    .upsert(row, { onConflict: 'whatsapp_number' })
    .select('whatsapp_number, state, pending_product_id, updated_at')
    .single();

  if (error) {
    throw new Error(`Failed to save conversation_state: ${error.message}`);
  }

  return {
    whatsapp_number: data.whatsapp_number as string,
    state: (data.state as ConversationFlowState) || 'idle',
    pending_product_id: (data.pending_product_id as string | null) ?? null,
    updated_at: (data.updated_at as string) ?? row.updated_at,
  };
}

export type SupabaseClientRow = {
  id: string;
  whatsapp_number: string;
  name: string | null;
  delivery_address: string | null;
};

/** Client is ready to order when both name and delivery_address are present. */
export function clientIsComplete(client: SupabaseClientRow | null): boolean {
  return Boolean(client?.name?.trim() && client?.delivery_address?.trim());
}

export async function findClientByWhatsApp(
  whatsappNumber: string,
): Promise<SupabaseClientRow | null> {
  const number = normalizeWhatsAppNumber(whatsappNumber);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('clients')
    .select('id, whatsapp_number, name, delivery_address')
    .eq('whatsapp_number', number)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client: ${error.message}`);
  }
  return (data as SupabaseClientRow | null) ?? null;
}

export async function upsertClientName(
  whatsappNumber: string,
  name: string,
): Promise<SupabaseClientRow> {
  const number = normalizeWhatsAppNumber(whatsappNumber);
  const supabase = getSupabaseAdmin();
  const existing = await findClientByWhatsApp(number);
  if (existing) {
    const { data, error } = await supabase
      .from('clients')
      .update({ name: name.trim() })
      .eq('id', existing.id)
      .select('id, whatsapp_number, name, delivery_address')
      .single();
    if (error) throw new Error(`Failed to save client name: ${error.message}`);
    return data as SupabaseClientRow;
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({ whatsapp_number: number, name: name.trim() })
    .select('id, whatsapp_number, name, delivery_address')
    .single();
  if (error) throw new Error(`Failed to save client name: ${error.message}`);
  return data as SupabaseClientRow;
}

export async function updateClientAddress(
  whatsappNumber: string,
  deliveryAddress: string,
): Promise<SupabaseClientRow> {
  const number = normalizeWhatsAppNumber(whatsappNumber);
  const supabase = getSupabaseAdmin();
  const existing = await findClientByWhatsApp(number);
  if (existing) {
    const { data, error } = await supabase
      .from('clients')
      .update({ delivery_address: deliveryAddress.trim() })
      .eq('id', existing.id)
      .select('id, whatsapp_number, name, delivery_address')
      .single();
    if (error) throw new Error(`Failed to save delivery address: ${error.message}`);
    return data as SupabaseClientRow;
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      whatsapp_number: number,
      delivery_address: deliveryAddress.trim(),
    })
    .select('id, whatsapp_number, name, delivery_address')
    .single();
  if (error) throw new Error(`Failed to save delivery address: ${error.message}`);
  return data as SupabaseClientRow;
}

export type OrderRow = {
  id: string;
  client_id: string;
  items: Array<{ product_id: string; quantity: number }>;
  status: string;
};

export async function createOrder(input: {
  clientId: string;
  productId: string;
}): Promise<OrderRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('orders')
    .insert({
      client_id: input.clientId,
      items: [{ product_id: input.productId, quantity: 1 }],
      status: 'pending',
    })
    .select('id, client_id, items, status')
    .single();

  if (error) {
    throw new Error(`Failed to create order: ${error.message}`);
  }
  return data as OrderRow;
}
