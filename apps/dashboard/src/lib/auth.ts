'use server';

import { cookies } from 'next/headers';

const TOKEN_KEY = 'mf_token';
const MAX_AGE = 8 * 60 * 60; // match API JWT expiry (8h)

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

import { getServerApiBaseUrl } from './api-config';
import { isJwtExpired, readJwtPayload } from './jwt-payload';

export async function getUser(): Promise<{ sub: string; email: string; name: string; businessName: string; role: string; salonId: string; phone?: string } | null> {
  const token = await getToken();
  if (!token) return null;

  // Quick local expiry check to avoid a network call on clearly-expired tokens.
  // Do not clear cookies here — layouts/pages may only read cookies; middleware
  // or Server Actions / Route Handlers clear stale sessions.
  if (isJwtExpired(token)) {
    return null;
  }

  const raw = readJwtPayload(token);
  if (!raw) {
    return null;
  }

  // Fetch user from backend — this verifies the JWT signature and returns
  // authoritative claims (role, salonId) straight from the database.
  try {
    const res = await fetch(`${getServerApiBaseUrl()}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    const { user, salon } = await res.json() as {
      user: { id: string; email: string; name: string; role: string; salonId: string };
      salon: { displayName: string; whatsappName: string };
    };
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      businessName: salon.displayName,
      role: user.role,
      salonId: user.salonId,
      phone: typeof raw.phone === 'string' ? raw.phone : undefined,
    };
  } catch {
    return null;
  }
}
