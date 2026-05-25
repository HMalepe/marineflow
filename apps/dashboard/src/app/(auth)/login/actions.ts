'use server';

import { setToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function login(
  email: string,
  password: string,
): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.error ?? 'Invalid credentials' };
    }

    const { token } = (await res.json()) as { token: string };
    await setToken(token);
    return {};
  } catch {
    return { error: 'Unable to connect to server' };
  }
}
