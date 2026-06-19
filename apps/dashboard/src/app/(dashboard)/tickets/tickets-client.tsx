'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CommsPageHint } from '@/components/comms-page-hint';
import {
  STATUS_BADGE,
  TicketCard,
  TicketSlaBadge,
  customerLabel,
  timeAgo,
  type TicketCardData,
} from '@/components/TicketCard';
import { TICKETS_LABEL } from '@/lib/dashboard-nav';
import {
  isActiveQueueTicket,
  isNoiseTicket,
  sortTicketQueue,
} from '@/lib/ticket-queue';
import { cn } from '@/lib/utils';

interface TicketMessage {
  id: string;
  direction: string;
  body: string;
  createdAt: string;
}

interface Ticket extends TicketCardData {
  messages: TicketMessage[];
}

type FilterTab = 'all' | 'open' | 'resolved' | 'noise';

interface Props {
  token: string;
}

export function TicketsClient({ token }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState<FilterTab>('open');
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ tickets: Ticket[] }>('/tickets', {}, token);
      const sorted = sortTicketQueue(data.tickets ?? []);
      setTickets(sorted);
      setSelected((prev) => {
        if (!prev) return prev;
        return sorted.find((t) => t.id === prev.id) ?? prev;
      });
    } catch {
      // silently ignore poll failures
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages.length]);

  const queueTickets = tickets.filter((t) => isActiveQueueTicket(t.status));
  const noiseTickets = tickets.filter((t) => isNoiseTicket(t.status));

  const filtered = sortTicketQueue(
    tickets.filter((t) => {
      if (filter === 'noise') return isNoiseTicket(t.status);
      if (isNoiseTicket(t.status)) return false;
      if (filter === 'open') return t.status === 'OPEN' || t.status === 'WAITING_CUSTOMER';
      if (filter === 'resolved') return t.status === 'RESOLVED';
      return true;
    }),
  );

  const openCount = queueTickets.filter(
    (t) => t.status === 'OPEN' || t.status === 'WAITING_CUSTOMER',
  ).length;

  async function sendReply() {
    if (!selected || !replyBody.trim()) return;
    setSending(true);
    setError(null);
    try {
      const data = await apiFetch<{ ok: boolean; message: TicketMessage }>(
        `/tickets/${selected.id}/reply`,
        { method: 'POST', body: JSON.stringify({ body: replyBody.trim() }) },
        token,
      );
      setReplyBody('');
      const append = (t: Ticket) =>
        t.id === selected.id
          ? { ...t, messages: [...t.messages, data.message], updatedAt: new Date().toISOString() }
          : t;
      setTickets((prev) => sortTicketQueue(prev.map(append)));
      setSelected((prev) => (prev ? { ...prev, messages: [...prev.messages, data.message] } : prev));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  async function markResolved() {
    if (!selected || selected.status === 'RESOLVED' || selected.status === 'AUTO_RESOLVED') return;
    setResolving(true);
    setError(null);
    try {
      await apiFetch<{ ok: boolean }>(
        `/tickets/${selected.id}/resolve`,
        { method: 'POST', body: JSON.stringify({}) },
        token,
      );
      const update = (t: Ticket) =>
        t.id === selected.id
          ? { ...t, status: 'RESOLVED' as const, updatedAt: new Date().toISOString() }
          : t;
      setTickets((prev) => sortTicketQueue(prev.map(update)));
      setSelected((prev) => (prev ? { ...prev, status: 'RESOLVED' } : prev));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to resolve ticket');
    } finally {
      setResolving(false);
    }
  }

  const filterTabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'open', label: 'Open', count: openCount },
    { id: 'all', label: 'All', count: queueTickets.length },
    { id: 'resolved', label: 'Resolved' },
    { id: 'noise', label: 'Noise', count: noiseTickets.length },
  ];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{TICKETS_LABEL}</h1>
        <CommsPageHint active="tickets" />
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden rounded-xl border bg-background">
        <div className="w-80 shrink-0 flex flex-col border-r bg-background">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Queue</h2>
              {openCount > 0 && filter !== 'noise' && (
                <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-medium">
                  {openCount} open
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                    filter === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent',
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined ? ` (${tab.count})` : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {filtered.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                {filter === 'noise'
                  ? 'No auto-resolved after-hours tickets.'
                  : 'No support tickets yet. They appear when customers report an issue, leave a complaint, or get a low rating.'}
              </p>
            )}
            {filtered.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                active={selected?.id === ticket.id}
                onSelect={(t) => {
                  setSelected(t as Ticket);
                  setReplyBody('');
                  setError(null);
                }}
              />
            ))}
          </div>
        </div>

        {selected ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
              <div>
                <h2 className="font-semibold">{selected.subject ?? '(no subject)'}</h2>
                <p className="text-sm text-muted-foreground">
                  {customerLabel(selected.customer)} · {selected.customer.waId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    (STATUS_BADGE[selected.status] ?? STATUS_BADGE.OPEN!).className,
                  )}
                >
                  {(STATUS_BADGE[selected.status] ?? STATUS_BADGE.OPEN!).label}
                </Badge>
                <TicketSlaBadge status={selected.status} createdAt={selected.createdAt} />
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={
                    selected.status === 'RESOLVED' ||
                    selected.status === 'AUTO_RESOLVED' ||
                    resolving
                  }
                  onClick={markResolved}
                >
                  {resolving
                    ? 'Resolving…'
                    : selected.status === 'RESOLVED'
                      ? '✓ Resolved'
                      : selected.status === 'AUTO_RESOLVED'
                        ? 'Auto-resolved'
                        : 'Mark Resolved'}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {selected.messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No messages yet</p>
              )}
              {selected.messages.map((msg) => {
                const isInbound = msg.direction === 'in' || msg.direction === 'INBOUND';
                const isInternal = msg.direction === 'internal';
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      isInternal ? 'justify-center' : isInbound ? 'justify-start' : 'justify-end',
                    )}
                  >
                    <Card
                      className={cn(
                        'max-w-[70%] px-4 py-2 text-sm rounded-2xl',
                        isInternal
                          ? 'bg-muted/60 text-muted-foreground italic text-xs rounded-lg'
                          : isInbound
                            ? 'bg-muted text-foreground rounded-tl-none'
                            : 'bg-primary text-primary-foreground rounded-tr-none',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      {!isInternal && (
                        <p
                          className={cn(
                            'text-[10px] mt-1',
                            isInbound ? 'text-muted-foreground' : 'text-primary-foreground/70',
                          )}
                        >
                          {timeAgo(msg.createdAt)}
                        </p>
                      )}
                    </Card>
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>

            <div className="px-6 py-4 border-t bg-background shrink-0 space-y-2">
              {error && <p className="text-sm text-destructive">{error}</p>}
              {selected.status === 'AUTO_RESOLVED' && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  Auto-resolved after 24h with no customer follow-up.
                </p>
              )}
              {selected.status === 'RESOLVED' && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  This ticket is resolved. You can still send a follow-up message.
                </p>
              )}
              <div className="flex gap-2">
                <textarea
                  className="flex-1 min-h-[72px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Type a reply — sent directly to customer on WhatsApp…"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  disabled={sending || selected.status === 'AUTO_RESOLVED'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void sendReply();
                    }
                  }}
                />
                <Button
                  className="self-end"
                  disabled={!replyBody.trim() || sending || selected.status === 'AUTO_RESOLVED'}
                  onClick={sendReply}
                >
                  {sending ? 'Sending…' : 'Send Reply'}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter to send</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm p-8 text-center gap-2">
            <p>Select a ticket to view messages and reply on WhatsApp.</p>
            <p className="text-xs max-w-sm">
              Need the live chat thread instead?{' '}
              <Link href="/conversations" className="text-primary underline-offset-4 hover:underline">
                Open Conversations
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
