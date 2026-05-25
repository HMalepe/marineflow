'use server';

import { cookies } from 'next/headers';

const TOKEN_KEY = 'mf_token';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export async function getToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(TOKEN_KEY)?.value ?? null;
}

export async function setToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(TOKEN_KEY, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export async function clearToken(): Promise<void> {
  const store = await cookies();
  store.delete(TOKEN_KEY);
}

export async function getUser(): Promise<{ sub: string; email: string; name: string; role: string; salonId: string } | null> {
  const token = await getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1]!, 'base64url').toString(),
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      await clearToken();
      return null;
    }
    return payload;
  } catch {
    await clearToken();
    return null;
  }
}
