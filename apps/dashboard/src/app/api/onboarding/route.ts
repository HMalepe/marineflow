import { NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';

import { getServerApiBaseUrl } from '@/lib/api-config';

const API_URL = getServerApiBaseUrl();

export async function POST(request: Request) {
  const token = await getToken();
  const body = await request.json();

  const res = await fetch(`${API_URL}/api/onboarding/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(err, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
