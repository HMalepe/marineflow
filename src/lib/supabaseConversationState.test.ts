import { beforeEach, describe, expect, it, vi } from 'vitest';

const maybeSingle = vi.fn();
const single = vi.fn();

vi.mock('./supabase.js', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle, single }),
        maybeSingle,
        single,
      }),
      upsert: () => ({
        select: () => ({ single }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({ single }),
        }),
      }),
      insert: () => ({
        select: () => ({ single }),
      }),
    }),
  }),
}));

import {
  getOrCreateConversationState,
  setConversationState,
  clientIsComplete,
} from './supabaseConversationState.js';

describe('conversation state helpers', () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    single.mockReset();
  });

  it('returns idle default when no row exists', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const state = await getOrCreateConversationState('+27821234567');
    expect(state.state).toBe('idle');
    expect(state.whatsapp_number).toBe('27821234567');
    expect(state.pending_product_id).toBeNull();
  });

  it('returns existing state row', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        whatsapp_number: '27821234567',
        state: 'awaiting_confirmation',
        pending_product_id: 'prod-1',
        updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });
    const state = await getOrCreateConversationState('27821234567');
    expect(state.state).toBe('awaiting_confirmation');
    expect(state.pending_product_id).toBe('prod-1');
  });

  it('upserts state via setConversationState', async () => {
    single.mockResolvedValue({
      data: {
        whatsapp_number: '27821234567',
        state: 'awaiting_name',
        pending_product_id: 'prod-1',
        updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });

    const state = await setConversationState('27821234567', {
      state: 'awaiting_name',
      pending_product_id: 'prod-1',
    });
    expect(state.state).toBe('awaiting_name');
  });

  it('clientIsComplete requires name and address', () => {
    expect(
      clientIsComplete({
        id: '1',
        whatsapp_number: '1',
        name: 'Ada',
        delivery_address: '12 Main',
      }),
    ).toBe(true);
    expect(
      clientIsComplete({
        id: '1',
        whatsapp_number: '1',
        name: 'Ada',
        delivery_address: null,
      }),
    ).toBe(false);
  });
});
