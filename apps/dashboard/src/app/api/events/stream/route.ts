import { NextRequest } from 'next/server';

import { getServerApiBaseUrl } from '@/lib/api-config';

const API_URL = getServerApiBaseUrl();

export async function GET(request: NextRequest) {
  // Accept token via cookie (secure) or query param (fallback for EventSource)
  const cookieToken = request.cookies.get('mf_token')?.value;
  const queryToken = request.nextUrl.searchParams.get('token');
  const token = cookieToken ?? queryToken;

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const upstream = await fetch(`${API_URL}/api/events/stream`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('Failed to connect', { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
