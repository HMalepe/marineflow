'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  waId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface TicketMessage {
  id: string;
  direction: string;
  body: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: 'OPEN' | 'WAITING_CUSTOMER' | 'RESOLVED';
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  messages: TicketMessage[];
}

type FilterTab = 'all' | 'open' | 'resolved';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function customerLabel(c: Customer): string {
  if (c.displayName) return c.displayName;
  const parts = [c.firstName, c.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return c.waId;
}

function statusOrder(status: string): number {
  if (status === 'OPEN') return 0;
  if (status === 'WAITING_CUSTOMER') return 1;
  return 2;
}

function sortTickets(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Open', className: 'bg-red-100 text-red-700 border-red-200' },
  WAITING_CUSTOMER: { label: 'Waiting', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  RESOLVED: { label: 'Resolved', className: 'bg-green-100 text-green-700 border-green-200' },
};

interface Props {
  token: string;
}

export function TicketsClient({ token }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ tickets: Ticket[] }>('/tickets', { token });
      const sorted = sortTickets(data.tickets);
      setTickets(sorted);
      // Refresh the selected ticket if it's in the list
      setSelected((prev) => {
        if (!prev) return prev;
        return sorted.find((t) => t.id === prev.id) ?? prev;
      });
    } catch {
      // silently ignore on poll
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = sortTickets(
    tickets.filter((t) => {
      if (filter === 'open') return t.status === 'OPEN' || t.status === 'WAITING_CUSTOMER';
      if (filter === 'resolved') return t.status === 'RESOLVED';
      return true;
    }),
  );

  async function sendReply() {
    if (!selected || !replyBody.trim()) return;
    setSending(true);
    setError(null);
    try {
      const data = await apiFetch<{ ok: boolean; message: TicketMessage }>(
        `/tickets/${selected.id}/reply`,
        { token, method: 'POST', body: { body: replyBody.trim() } },
      );
      setReplyBody('');
      // Append to selected ticket messages
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selected.id ? { ...t, messages: [...t.messages, data.message] } : t,
        ),
      );
      setSelected((prev) =>
        prev ? { ...prev, messages: [...prev.messages, data.message] } : prev,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  async function markResolved() {
    if (!selected) return;
    setResolving(true);
    setError(null);
    try {
      await apiFetch<{ ok: boolean }>(`/tickets/${selected.id}/resolve`, {
        token,
        method: 'POST',
        body: {},
      });
      setTickets((prev) =>
        prev.map((t) => (t.id === selected.id ? { ...t, status: 'RESOLVED' } : t)),
      );
      setSelected((prev) => (prev ? { ...prev, status: 'RESOLVED' } : prev));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resolve ticket');
    } finally {
      setResolving(false);
    }
  }

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'resolved', label: 'Resolved' },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left panel */}
      <div className="w-80 shrink-0 flex flex-col border-r bg-background">
        <div className="p-4 border-b">
          <h1 className="font-semibold text-lg">Tickets</h1>
          <div className="flex gap-1 mt-3">
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
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No tickets</p>
          )}
          {filtered.map((ticket) => {
            const badge = STATUS_BADGE[ticket.status] ?? STATUS_BADGE['OPEN'];
            const last = ticket.messages[ticket.messages.length - 1];
            const isSelected = selected?.id === ticket.id;
            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => { setSelected(ticket); setReplyBody(''); setError(null); }}
                className={cn(
                  'w-full text-left px-4 py-3 hover:bg-accent transition-colors',
                  isSelected && 'bg-accent',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm truncate flex-1">{ticket.subject}</span>
                  <Badge variant="outline" className={cn('text-[10px] shrink-0', badge.className)}>
                    {badge.label}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {customerLabel(ticket.customer)} · {ticket.customer.waId}
                </div>
                {last && (
                  <div className="text-xs text-muted-foreground mt-1 truncate">{last.body}</div>
                )}
                <div className="text-[10px] text-muted-foreground mt-1">
                  {timeAgo(ticket.updatedAt)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
            <div>
              <h2 className="font-semibold">{selected.subject}</h2>
              <p className="text-sm text-muted-foreground">
                {customerLabel(selected.customer)} · {selected.customer.waId}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  (STATUS_BADGE[selected.status] ?? STATUS_BADGE['OPEN']).className,
                )}
              >
                {(STATUS_BADGE[selected.status] ?? STATUS_BADGE['OPEN']).label}
              </Badge>
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={selected.status === 'RESOLVED' || resolving}
                onClick={markResolved}
              >
                {resolving ? 'Resolving…' : 'Mark Resolved'}
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {selected.messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">No messages yet</p>
            )}
            {selected.messages.map((msg) => {
              const isInbound = msg.direction === 'in' || msg.direction === 'INBOUND';
              return (
                <div
                  key={msg.id}
                  className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}
                >
                  <Card
                    className={cn(
                      'max-w-[70%] px-4 py-2 text-sm',
                      isInbound
                        ? 'bg-muted text-foreground'
                        : 'bg-primary text-primary-foreground',
                    )}
                  >
                    <p>{msg.body}</p>
                    <p
                      className={cn(
                        'text-[10px] mt-1',
                        isInbound ? 'text-muted-foreground' : 'text-primary-foreground/70',
                      )}
                    >
                      {timeAgo(msg.createdAt)}
                    </p>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Reply box */}
          <div className="px-6 py-4 border-t bg-background shrink-0 space-y-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <textarea
                className="flex-1 min-h-[80px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Type a reply…"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                disabled={sending}
              />
              <Button
                className="self-end"
                disabled={!replyBody.trim() || sending}
                onClick={sendReply}
              >
                {sending ? 'Sending…' : 'Send Reply'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Select a ticket to view messages
        </div>
      )}
    </div>
  );
}
