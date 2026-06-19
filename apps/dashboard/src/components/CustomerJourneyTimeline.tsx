'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  CreditCard,
  Loader2,
  MessageCircle,
  Megaphone,
  Star,
  Ticket,
  Trophy,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

type JourneyEventType =
  | 'whatsapp_in'
  | 'whatsapp_out'
  | 'booking'
  | 'completed'
  | 'payment'
  | 'payment_pending'
  | 'rating'
  | 'campaign'
  | 'loyalty'
  | 'ticket'
  | 'support'
  | 'milestone';

interface JourneyEvent {
  id: string;
  at: string;
  type: JourneyEventType;
  title: string;
  detail?: string;
}

interface Props {
  token: string;
  customerId: string;
}

const ICONS: Record<JourneyEventType, React.ComponentType<{ className?: string }>> = {
  whatsapp_in: MessageCircle,
  whatsapp_out: MessageCircle,
  booking: Calendar,
  completed: Calendar,
  payment: CreditCard,
  payment_pending: CreditCard,
  rating: Star,
  campaign: Megaphone,
  loyalty: Trophy,
  ticket: Ticket,
  support: Ticket,
  milestone: MessageCircle,
};

const DOT_STYLES: Record<JourneyEventType, string> = {
  whatsapp_in: 'bg-green-500',
  whatsapp_out: 'bg-green-500/40',
  booking: 'bg-blue-500',
  completed: 'bg-emerald-500',
  payment: 'bg-violet-500',
  payment_pending: 'bg-amber-500',
  rating: 'bg-yellow-500',
  campaign: 'bg-pink-500',
  loyalty: 'bg-orange-500',
  ticket: 'bg-red-500',
  support: 'bg-slate-500',
  milestone: 'bg-primary',
};

function formatEventWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== new Date().getFullYear() ? '2-digit' : undefined,
  });
}

export function CustomerJourneyTimeline({ token, customerId }: Props) {
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ events: JourneyEvent[] }>(
          `/customers/${customerId}/journey`,
          {},
          token,
        );
        if (!cancelled) setEvents(res.events ?? []);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, customerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        No journey events yet — interactions will appear here as this customer engages on WhatsApp.
      </p>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
      <ul className="space-y-0">
        {events.map((event, idx) => {
          const Icon = ICONS[event.type];
          const isDropOff = event.detail?.includes('drop-off');
          return (
            <li key={event.id} className="relative pb-6 last:pb-0">
              <span
                className={cn(
                  'absolute -left-6 top-1.5 flex size-3.5 rounded-full ring-2 ring-background',
                  DOT_STYLES[event.type],
                )}
              />
              <div
                className={cn(
                  'rounded-xl border px-4 py-3 transition-colors',
                  isDropOff && 'border-orange-500/40 bg-orange-500/5',
                  idx === 0 && !isDropOff && 'border-primary/20 bg-primary/[0.03]',
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium text-sm">{event.title}</p>
                      <time className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {formatEventWhen(event.at)}
                      </time>
                    </div>
                    {event.detail && (
                      <p
                        className={cn(
                          'text-sm mt-0.5',
                          isDropOff ? 'text-orange-800 dark:text-orange-200 font-medium' : 'text-muted-foreground',
                        )}
                      >
                        {event.detail}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
