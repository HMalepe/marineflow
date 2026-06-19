import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { NextResponse } from 'next/server';

export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ count: 0 });
  }

  try {
    const data = await apiFetch<{ count: number }>('/conversations/handoff-count', {}, token);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
