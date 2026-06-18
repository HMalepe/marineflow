'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { clearToken, getToken, setToken } from '@/lib/auth';
import { getServerApiBaseUrl } from '@/lib/api-config';

const ADMIN_TOKEN_KEY = 'mf_admin_token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 8 * 60 * 60,
  path: '/',
};

/** @deprecated Use openClientDashboard(businessId) */
export async function impersonateSalon(token: string) {
  await setToken(token);
  redirect('/');
}

async function resolveAdminToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ADMIN_TOKEN_KEY)?.value ?? (await getToken());
}

export async function openClientDashboard(businessId: string): Promise<{ error?: string }> {
  const store = await cookies();
  const adminToken = await resolveAdminToken();
  if (!adminToken) return { error: 'Not signed in' };

  const res = await fetch(`${getServerApiBaseUrl()}/admin/salons/${businessId}/impersonate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (body.error === 'no_owner_found') {
      return { error: 'No owner account for this business — add a user first.' };
    }
    return { error: body.message ?? body.error ?? 'Could not open dashboard' };
  }

  const { token: ownerToken } = (await res.json()) as { token: string };

  if (!store.get(ADMIN_TOKEN_KEY)?.value) {
    const current = await getToken();
    if (current && current !== ownerToken) {
      store.set(ADMIN_TOKEN_KEY, current, COOKIE_OPTS);
    }
  }

  await setToken(ownerToken);
  redirect('/');
}

export async function exitImpersonation() {
  const store = await cookies();
  const adminToken = store.get(ADMIN_TOKEN_KEY)?.value;
  if (adminToken) {
    await setToken(adminToken);
    store.delete(ADMIN_TOKEN_KEY);
    redirect('/admin');
  }
  await clearToken();
  redirect('/login');
}

export async function getImpersonationActive(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  try {
    const raw = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as {
      impersonatedBy?: string;
    };
    return !!raw.impersonatedBy;
  } catch {
    return false;
  }
}
