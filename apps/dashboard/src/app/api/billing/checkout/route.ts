import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function POST(request: Request) {
  const { planTier, billingCycle, token } = await request.json();

  const res = await fetch(`${API_URL}/api/subscription/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ planTier, billingCycle }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? 'checkout_failed', message: data.message },
      { status: res.status },
    );
  }
  return NextResponse.json(data);
}
