'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface EventStreamOptions {
  token: string;
  onEvent?: (type: string, payload: Record<string, unknown>) => void;
}

const EVENT_TYPES = [
  'appointment.created',
  'appointment.updated',
  'service.catalog_changed',
  'staff.roster_changed',
  'message.received',
  'bot.escalation',
];

export function useEventStream({ token, onEvent }: EventStreamOptions) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ type: string; payload: Record<string, unknown> } | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!token) return;

    // Use cookie-based auth via the proxy route (cookie sent automatically)
    const proxyUrl = `/api/events/stream`;
    const es = new EventSource(proxyUrl);

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    for (const type of EVENT_TYPES) {
      es.addEventListener(type, (e) => {
        try {
          const payload = JSON.parse((e as MessageEvent).data);
          setLastEvent({ type, payload });
          onEventRef.current?.(type, payload);
        } catch {
          // Ignore malformed payloads
        }
      });
    }

    sourceRef.current = es;

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
