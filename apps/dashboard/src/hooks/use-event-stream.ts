'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface EventStreamOptions {
  token: string;
  onEvent?: (type: string, payload: Record<string, unknown>) => void;
}

export function useEventStream({ token, onEvent }: EventStreamOptions) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ type: string; payload: Record<string, unknown> } | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!token) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    const url = `${apiUrl}/api/events/stream`;

    const source = new EventSource(url, {
      // EventSource doesn't support headers natively, so we pass token as query param
    } as EventSourceInit);

    // Use fetch-based approach since EventSource can't send auth headers
    // Instead we'll use a proxy route
    const proxyUrl = `/api/events/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(proxyUrl);

    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      // Auto-reconnect is handled by browser EventSource
    };

    const eventTypes = ['appointment.created', 'appointment.updated', 'message.received'];
    for (const type of eventTypes) {
      es.addEventListener(type, (e) => {
        try {
          const payload = JSON.parse((e as MessageEvent).data);
          setLastEvent({ type, payload });
          onEventRef.current?.(type, payload);
        } catch {
          // Ignore parse errors
        }
      });
    }

    sourceRef.current = es;
    // Clean up the unused direct source
    source.close();

    return () => {
      es.close();
      setConnected(false);
    };
  }, [token]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return { connected, lastEvent };
}
