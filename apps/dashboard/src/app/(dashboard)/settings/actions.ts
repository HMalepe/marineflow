'use server';

import { getToken, clearToken } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';

export interface SalonSettings {
  id: string;
  name: string;
  tradingName: string | null;
  logoUrl: string | null;
  timezone: string;
  openTime: string | null;
  closeTime: string | null;
  welcomeMessage: string | null;
  afterHoursMessage: string | null;
  status: string;
  botActive: boolean;
  botName: string;
  botAskMarketingConsent: boolean;
  botAllowStaffPick: boolean;
  botLoyaltyEnabled: boolean;
  botRequireDepositStep: boolean;
  inactivityMessage1: string | null;
  inactivityMessage1DelayMin: number;
  inactivityMessage2: string | null;
  inactivityMessage2DelayMin: number;
  closingMessage: string | null;
  addressLine: string | null;
  phoneDisplay: string | null;
  contactEmail: string | null;
  mapsUrl: string | null;
  parkingNotes: string | null;
}

export async function saveLocation(
  addressLine: string | null,
  phoneDisplay: string | null,
  contactEmail: string | null,
  mapsUrl: string | null,
  parkingNotes: string | null,
): Promise<{ salon?: SalonSettings; error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    const data = await apiFetch<{ salon: SalonSettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ addressLine, phoneDisplay, contactEmail, mapsUrl, parkingNotes }),
    }, token);
    return { salon: data.salon };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Save failed' };
  }
}

export async function updateEmail(email: string): Promise<{ error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    await apiFetch('/me/email', { method: 'PATCH', body: JSON.stringify({ email }) }, token);
    return {};
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 409) return { error: 'That email is already in use' };
      if (e.status === 400) return { error: 'Enter a valid email address' };
    }
    return { error: e instanceof ApiError ? e.message : 'Failed to update email' };
  }
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
    // Invalidate the current session — user must log in with the new password.
    await clearToken();
    return {};
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) return { error: 'Current password is incorrect' };
      if (e.status === 400) return { error: e.message };
    }
    return { error: 'Failed to change password' };
  }
}

export async function updateName(name: string): Promise<{ error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    await apiFetch('/me/name', { method: 'PATCH', body: JSON.stringify({ name }) }, token);
    return {};
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to update name' };
  }
}

export async function saveLogo(logoUrl: string | null): Promise<{ salon?: SalonSettings; error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    const data = await apiFetch<{ salon: SalonSettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ logoUrl }),
    }, token);
    return { salon: data.salon };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to save logo' };
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

export async function saveBotBehaviour(flags: {
  botAskMarketingConsent?: boolean;
  botAllowStaffPick?: boolean;
  botLoyaltyEnabled?: boolean;
  botRequireDepositStep?: boolean;
}): Promise<{ salon?: SalonSettings; error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    const data = await apiFetch<{ salon: SalonSettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(flags),
    }, token);
    return { salon: data.salon };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Save failed' };
  }
}

export async function saveBotName(botName: string): Promise<{ salon?: SalonSettings; error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    const data = await apiFetch<{ salon: SalonSettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ botName }),
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

export async function saveInactivityMessages(payload: {
  inactivityMessage1: string | null;
  inactivityMessage1DelayMin: number;
  inactivityMessage2: string | null;
  inactivityMessage2DelayMin: number;
  closingMessage: string | null;
}): Promise<{ salon?: SalonSettings; error?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not authenticated' };
  try {
    const data = await apiFetch<{ salon: SalonSettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, token);
    return { salon: data.salon };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Save failed' };
  }
}
