'use server';

import { setToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type LoginInput =
  | { method: 'email'; email: string; password: string }
  | { method: 'phone'; phone: string; password: string };

export async function login(input: LoginInput): Promise<{ error?: string }> {
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
      if (err === 'invalid_credentials') return { error: 'Incorrect email, phone, or password' };
      if (err === 'email_or_phone_required') return { error: 'Email or phone number is required' };
      if (err === 'password_required') return { error: 'Password is required' };
      if (err === 'invalid_phone') return { error: 'Enter a valid South African mobile number' };
      return { error: err ?? 'Invalid credentials' };
    }

    const { token } = (await res.json()) as { token: string };
    await setToken(token);
    return {};
  } catch {
    return { error: 'Unable to connect to server' };
  }
}
