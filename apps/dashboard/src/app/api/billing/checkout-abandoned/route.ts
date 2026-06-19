import { NextResponse } from 'next/server';

import { getServerApiBaseUrl } from '@/lib/api-config';

const API_URL = getServerApiBaseUrl();

export async function POST(request: Request) {
  const { token } = await request.json().catch(() => ({}));

  const res = await fetch(`${API_URL}/api/subscription/checkout-abandoned`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: data.error ?? 'checkout_abandoned_failed' },
      { status: res.status },
    );
  }

  return NextResponse.json({ ok: true });
}
