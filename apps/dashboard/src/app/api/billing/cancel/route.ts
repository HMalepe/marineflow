import { NextResponse } from 'next/server';

import { getServerApiBaseUrl } from '@/lib/api-config';

const API_URL = getServerApiBaseUrl();

export async function POST(request: Request) {
  const { token } = await request.json();

  const res = await fetch(`${API_URL}/api/subscription/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data.error ?? 'cancel_failed' }, { status: res.status });
  }
  return NextResponse.json(data);
}
