'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useEventStream } from '@/hooks/use-event-stream';

const LIVE_ROSTER_EVENTS = new Set([
  'service.catalog_changed',
  'staff.roster_changed',
  'appointment.created',
  'appointment.updated',
]);

/**
 * Subscribe to salon SSE events and refresh UI when services, staff, or availability change.
 * Debounces rapid bursts (e.g. bulk sort) into a single refresh.
 */
export function useSalonLiveUpdates(
  token: string,
  onLiveUpdate: (eventType: string) => void,
  debounceMs = 400,
) {
  const onLiveUpdateRef = useRef(onLiveUpdate);
  onLiveUpdateRef.current = onLiveUpdate;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTypesRef = useRef<Set<string>>(new Set());

  const flush = useCallback(() => {
    if (pendingTypesRef.current.size === 0) return;
    for (const type of pendingTypesRef.current) {
      onLiveUpdateRef.current(type);
    }
    pendingTypesRef.current.clear();
  }, []);

  const handleEvent = useCallback(
    (type: string) => {
      if (!LIVE_ROSTER_EVENTS.has(type)) return;
      pendingTypesRef.current.add(type);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, debounceMs);
    },
    [debounceMs, flush],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const { connected, lastEvent } = useEventStream({ token, onEvent: handleEvent });
  return { connected, lastEvent };
}
