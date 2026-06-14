'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useSalonLiveUpdates } from '@/hooks/use-salon-live-updates';

/**
 * Refreshes server-rendered dashboard pages when bookings or roster data change elsewhere.
 */
export function SalonLiveRouterRefresh({ token }: { token: string }) {
  const router = useRouter();

  const onLiveUpdate = useCallback(
    (type: string) => {
      if (
        type === 'appointment.created' ||
        type === 'appointment.updated' ||
        type === 'service.catalog_changed' ||
        type === 'staff.roster_changed'
      ) {
        router.refresh();
      }
    },
    [router],
  );

  useSalonLiveUpdates(token, onLiveUpdate, 600);
  return null;
}
