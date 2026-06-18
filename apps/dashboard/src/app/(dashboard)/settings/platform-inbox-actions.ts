'use server';

import { getToken } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';

export async function sendPlatformMessage(
  subject: string,
  body: string,
): Promise<{ ok?: boolean; error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    await apiFetch('/platform-inbox/message', {
      method: 'POST',
      body: JSON.stringify({ subject, body }),
    }, token);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Send failed' };
  }
}
