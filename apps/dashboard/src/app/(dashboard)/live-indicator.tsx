'use client';

import { useEventStream } from '@/hooks/use-event-stream';
import { useEffect, useState } from 'react';

interface Props {
  token: string;
}

export function LiveIndicator({ token }: Props) {
  const { connected, lastEvent } = useEventStream({
    token,
    onEvent: (type, payload) => {
      if (type === 'message.received') {
        setToast(`New message from customer`);
      } else if (type === 'appointment.created') {
        setToast(`New booking received`);
      }
    },
  });

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <>
      <div className="flex items-center gap-1.5" title={connected ? 'Live' : 'Connecting...'}>
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className="text-xs text-muted-foreground">{connected ? 'Live' : '...'}</span>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-card border shadow-lg rounded-lg px-4 py-3 text-sm animate-in slide-in-from-bottom-4 z-50">
          {toast}
        </div>
      )}
    </>
  );
}
