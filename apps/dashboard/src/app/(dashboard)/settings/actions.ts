'use server';

import { getToken } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';

export interface SalonSettings {
  id: string;
  name: string;
  tradingName: string | null;
  timezone: string;
  openTime: string | null;
  closeTime: string | null;
  welcomeMessage: string | null;
  afterHoursMessage: string | null;
  status: string;
  botActive: boolean;
  botName: string;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    await apiFetch('/me/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }, token);
    return {};
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) return { error: 'Current password is incorrect' };
      if (e.status === 400) return { error: e.message };
    }
    return { error: 'Failed to change password' };
  }
}

export async function saveDisplayName(tradingName: string): Promise<{ salon?: SalonSettings; error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    const data = await apiFetch<{ salon: SalonSettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ tradingName }),
    }, token);
    return { salon: data.salon };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Save failed' };
  }
}

export async function saveHours(openTime: string, closeTime: string, timezone: string): Promise<{ salon?: SalonSettings; error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    const data = await apiFetch<{ salon: SalonSettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ openTime, closeTime, timezone }),
    }, token);
    return { salon: data.salon };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Save failed' };
  }
}

export async function saveMessages(welcomeMessage: string | null, afterHoursMessage: string | null): Promise<{ salon?: SalonSettings; error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    const data = await apiFetch<{ salon: SalonSettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ welcomeMessage, afterHoursMessage }),
    }, token);
    return { salon: data.salon };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Save failed' };
  }
}

export async function saveBotActive(botActive: boolean): Promise<{ salon?: SalonSettings; error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    const data = await apiFetch<{ salon: SalonSettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ botActive }),
    }, token);
    return { salon: data.salon };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Save failed' };
  }
}
