'use server';

import { setToken } from '@/lib/auth';
import { API_MISCONFIGURED_MESSAGE, getServerApiBaseUrl, isApiMisconfiguredForProduction } from '@/lib/api-config';

const API_URL = getServerApiBaseUrl();

type LoginInput =
  | { method: 'email'; email: string; password: string }
  | { method: 'phone'; phone: string; password: string };

export async function checkPhone(
  phone: string,
): Promise<{ status: 'login' | 'setup'; salonName: string } | { error: string }> {
  if (isApiMisconfiguredForProduction()) {
    return { error: API_MISCONFIGURED_MESSAGE };
  }
  try {
    const res = await fetch(`${API_URL}/api/auth/check-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === 'number_not_on_twilio') {
        return {
          error:
            'This number is not registered on MarineFlow. Use the WhatsApp business number assigned to your salon.',
        };
      }
      if (data.error === 'number_not_linked') {
        return {
          error:
            'This number is on our system but not linked to a salon yet. Contact MarineFlow support.',
        };
      }
      if (data.error === 'number_not_registered') {
        return {
          error:
            'This WhatsApp number is not registered yet. Contact MarineFlow support to get set up.',
        };
      }
      if (data.error === 'invalid_phone') {
        return { error: 'Enter a valid South African WhatsApp business number' };
      }
      return { error: data.message ?? data.error ?? 'Could not verify number' };
    }
    return data as { status: 'login' | 'setup'; salonName: string };
  } catch {
    return { error: 'Unable to connect to server' };
  }
}

export async function setupPassword(
  phone: string,
  password: string,
): Promise<{ error?: string }> {
  if (isApiMisconfiguredForProduction()) {
    return { error: API_MISCONFIGURED_MESSAGE };
  }
  try {
    const res = await fetch(`${API_URL}/api/auth/setup-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'weak_password') return { error: data.message ?? 'Password too weak' };
      if (data.error === 'number_not_on_twilio') {
        return { error: 'This number is not registered on MarineFlow' };
      }
      if (data.error === 'number_not_linked') {
        return { error: 'This number is not linked to a salon yet — contact support' };
      }
      if (data.error === 'phone_already_setup') {
        return { error: 'This number already has a password — sign in instead' };
      }
      return { error: data.message ?? data.error ?? 'Setup failed' };
    }

    const { token } = (await res.json()) as { token: string };
    await setToken(token);
    return {};
  } catch {
    return { error: 'Unable to connect to server' };
  }
}

export async function login(input: LoginInput): Promise<{ error?: string }> {
  if (isApiMisconfiguredForProduction()) {
    return { error: API_MISCONFIGURED_MESSAGE };
  }
  try {
    const body =
      input.method === 'email'
        ? { email: input.email, password: input.password }
        : { phone: input.phone, password: input.password };

    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = data.error as string | undefined;
      if (err === 'invalid_credentials') {
        return {
          error:
            'Incorrect email or password. Use the Email tab with holiday.malepe@gmail.com and your SUPER_ADMIN_PASSWORD from Railway.',
        };
      }
      if (err === 'email_or_phone_required') return { error: 'Email or phone number is required' };
      if (err === 'password_required') return { error: 'Password is required' };
      if (err === 'number_not_on_twilio') {
        return { error: 'This number is not registered on MarineFlow' };
      }
      if (err === 'invalid_phone') return { error: 'Enter a valid South African mobile number' };
      return { error: err ?? 'Invalid credentials' };
    }

    const { token } = (await res.json()) as { token: string };
    await setToken(token);
    return {};
  } catch (err) {
    console.error('[login] API request failed', { apiUrl: API_URL, err });
    return { error: 'Unable to connect to server — set NEXT_PUBLIC_API_URL=https://marineflow.co.za on Vercel' };
  }
}
