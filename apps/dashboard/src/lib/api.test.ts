import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from './api.js';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1 — sends {} for POST requests without a body', async () => {
    await apiFetch('/faqs/smart-approve', { method: 'POST' }, 'token');
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.body).toBe('{}');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('2 — omits Content-Type on GET requests', async () => {
    await apiFetch('/faqs', {}, 'token');
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.body).toBeUndefined();
    expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('3 — omits Content-Type on DELETE requests', async () => {
    await apiFetch('/staff/abc', { method: 'DELETE' }, 'token');
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.body).toBeUndefined();
    expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('4 — preserves an explicit JSON body on PATCH', async () => {
    await apiFetch('/staff/abc', { method: 'PATCH', body: JSON.stringify({ active: false }) }, 'token');
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.body).toBe(JSON.stringify({ active: false }));
  });

  it('5 — attaches bearer token when provided', async () => {
    await apiFetch('/faqs', {}, 'secret-token');
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
  });

  it('6 — throws ApiError with server message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Body cannot be empty when content-type is set to application/json' }),
      })),
    );
    await expect(apiFetch('/faqs/smart-approve', { method: 'POST' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Body cannot be empty when content-type is set to application/json',
    });
  });
});
