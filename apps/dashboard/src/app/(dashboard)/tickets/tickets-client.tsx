'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PremiumDisclosure } from '@/components/premium-disclosure';
import { PaneHeader } from '@/components/section-panel';
import {
  ChatComposer,
  ChatEmptyState,
  ChatThread,
  type ChatMessage,
} from '@/components/chat-ui';
import {
  STATUS_BADGE,
  TicketCard,
  TicketSlaBadge,
  customerLabel,
  customerSubtitle,
  type TicketCardData,
} from '@/components/TicketCard';
import { TICKETS_LABEL, TICKETS_TAGLINE, CONVERSATIONS_LABEL } from '@/lib/dashboard-nav';
import {
  isActiveQueueTicket,
  isNoiseTicket,
  sortTicketQueue,
} from '@/lib/ticket-queue';
import { cn } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';

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
  const threadScrollRef = useRef<HTMLDivElement>(null);

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
    const container = threadScrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: (selected?.messages.length ?? 0) > 3 ? 'smooth' : 'auto',
    });
  }, [selected?.messages.length, selected?.id]);

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

  const showDetailOnMobile = Boolean(selected);

  const chatMessages: ChatMessage[] = useMemo(() => {
    if (!selected) return [];
    return selected.messages.map((msg) => {
      const isInbound = msg.direction === 'in' || msg.direction === 'INBOUND';
      const isInternal = msg.direction === 'internal';
      return {
        id: msg.id,
        direction: isInternal ? 'system' : isInbound ? 'inbound' : 'outbound',
        body: msg.body,
        createdAt: msg.createdAt,
        senderLabel: isInternal ? undefined : isInbound ? customerLabel(selected.customer) : 'You',
      };
    });
  }, [selected]);

  return (
    <div className="dashboard-workspace dashboard-comms-page">
      <div className={cn('shrink-0 dashboard-page-header', showDetailOnMobile && 'hidden md:block')}>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">{TICKETS_LABEL}</h1>
        <PremiumDisclosure label="Tickets vs conversations" desktopOpen={false} className="mt-1">
          {TICKETS_TAGLINE} For live chat, open{' '}
          <Link href="/conversations" className="text-primary underline-offset-4 hover:underline">
            {CONVERSATIONS_LABEL}
          </Link>
          .
        </PremiumDisclosure>
      </div>

      <div className="dashboard-inbox-frame dashboard-inbox-frame--chat flex-col md:flex-row">
        <div
          className={cn(
            'dashboard-inbox-pane dashboard-inbox-pane--list w-full md:w-[17rem] lg:w-72 shrink-0 overflow-hidden',
            selected && 'hidden md:flex',
          )}
        >
          <PaneHeader
            title="Queue"
            trailing={
              openCount > 0 && filter !== 'noise' ? (
                <Badge variant="destructive" className="text-[10px] px-2 py-0">
                  {openCount}
                </Badge>
              ) : undefined
            }
          />
          <div className="dashboard-pane-toolbar py-2">
            <div className="flex items-center gap-2">
              <label htmlFor="ticket-filter" className="sr-only">
                Filter tickets
              </label>
              <select
                id="ticket-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterTab)}
                className="h-9 flex-1 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {filterTabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                    {tab.count !== undefined ? ` (${tab.count})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="chat-list-scroll flex-1 overflow-y-auto overscroll-y-contain min-h-0">
            {filtered.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground leading-relaxed">
                {filter === 'noise'
                  ? 'No auto-closed noise tickets.'
                  : 'No support tickets yet. They appear when a customer uses Support in WhatsApp, reports an issue, uses upset language, or asks for a person.'}
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
          <div className="dashboard-inbox-pane dashboard-inbox-pane--thread flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
            <div className="chat-thread-header shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:hidden shrink-0 rounded-full touch-manipulation"
                onClick={() => setSelected(null)}
                aria-label="Back to queue"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold truncate text-[15px]">{selected.subject ?? '(no subject)'}</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {customerSubtitle(selected.customer)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    (STATUS_BADGE[selected.status] ?? STATUS_BADGE.OPEN!).className,
                  )}
                >
                  {(STATUS_BADGE[selected.status] ?? STATUS_BADGE.OPEN!).label}
                </Badge>
                <TicketSlaBadge status={selected.status} createdAt={selected.createdAt} />
                <Button
                  size="sm"
                  className="rounded-full h-8 text-xs"
                  disabled={
                    selected.status === 'RESOLVED' ||
                    selected.status === 'AUTO_RESOLVED' ||
                    resolving
                  }
                  onClick={markResolved}
                >
                  {resolving
                    ? '…'
                    : selected.status === 'RESOLVED' || selected.status === 'AUTO_RESOLVED'
                      ? 'Resolved'
                      : 'Resolve'}
                </Button>
              </div>
            </div>

            <ChatThread
              messages={chatMessages}
              emptyLabel="No messages yet"
              scrollRef={threadScrollRef}
              endRef={threadEndRef}
            />

            <ChatComposer
              value={replyBody}
              onChange={setReplyBody}
              onSubmit={() => void sendReply()}
              placeholder="Reply on WhatsApp…"
              disabled={selected.status === 'AUTO_RESOLVED'}
              sending={sending}
              footer={
                <>
                  {error && <p className="text-sm text-destructive pb-2 px-1">{error}</p>}
                  {(selected.status === 'AUTO_RESOLVED' || selected.status === 'RESOLVED') && (
                    <p className="text-[11px] text-muted-foreground text-center pb-2 px-2">
                      {selected.status === 'AUTO_RESOLVED'
                        ? 'Auto-resolved after 24h with no follow-up.'
                        : 'Resolved — you can still send a follow-up.'}
                    </p>
                  )}
                </>
              }
            />
          </div>
        ) : (
          <div className="dashboard-inbox-pane dashboard-inbox-pane--thread flex-1 hidden md:flex flex-col overflow-hidden min-h-0 min-w-0">
            <ChatEmptyState
              title="Select a ticket"
              hint="Pick a ticket from the queue to view messages and reply on WhatsApp."
            />
          </div>
        )}
      </div>
    </div>
  );
}
