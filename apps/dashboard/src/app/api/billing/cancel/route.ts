import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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
