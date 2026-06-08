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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function getUser(): Promise<{ sub: string; email: string; name: string; role: string; salonId: string; phone?: string } | null> {
  const token = await getToken();
  if (!token) return null;

  // Quick local expiry check to avoid a network call on clearly-expired tokens.
  // We do NOT trust the payload for auth decisions — the /me call below verifies
  // the signature server-side.
  try {
    const raw = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    if (raw.exp && raw.exp * 1000 < Date.now()) {
      await clearToken();
      return null;
    }
  } catch {
    await clearToken();
    return null;
  }

  // Fetch user from backend — this verifies the JWT signature and returns
  // authoritative claims (role, salonId) straight from the database.
  try {
    const res = await fetch(`${API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      await clearToken();
      return null;
    }
    const { user, salon } = await res.json() as {
      user: { id: string; email: string; name: string; role: string; salonId: string };
      salon: { displayName: string; whatsappName: string };
    };
    return {
      sub: user.id,
      email: user.email,
      name: salon.displayName,
      role: user.role,
      salonId: user.salonId,
      // phone not in /me response — read from raw JWT payload only for display
      phone: (() => {
        try {
          return JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()).phone as string | undefined;
        } catch { return undefined; }
      })(),
    };
  } catch {
    return null;
  }
}
