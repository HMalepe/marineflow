'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEventStream } from '@/hooks/use-event-stream';
import { apiFetch, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { CONVERSATIONS_LABEL } from '@/lib/dashboard-nav';
import { CommsPageHint } from '@/components/comms-page-hint';
import {
  ConversationListItem,
  customerInitials,
  customerLabel,
  pickDefaultConversation,
  sortConversationsByPriority,
  type ConversationListItemData,
} from '@/components/ConversationListItem';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  waId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface ThreadMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  createdAt: string;
}

interface EscalationAlert {
  id: string;
  customerLabel: string;
  conversationId?: string;
}

type InboxFilter = 'all' | 'handoff';

interface Props {
  token: string;
  staffName: string;
}

const STEP_LABELS: Record<string, string> = {
  HANDOFF: 'Needs you',
  MENU: 'Main menu',
  IDLE: 'Idle',
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return 'Just now';
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StepBadge({ step }: { step: string }) {
  const label = STEP_LABELS[step] ?? step.replace(/_/g, ' ').toLowerCase();
  if (step === 'HANDOFF') {
    return (
      <Badge variant="destructive" className="animate-pulse shrink-0">
        {label}
      </Badge>
    );
  }
  if (step === 'MENU' || step === 'IDLE') {
    return (
      <Badge className="shrink-0 bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30">
        {label}
      </Badge>
    );
  }
  return (
    <Badge className="shrink-0 bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-500/30">
      {label}
    </Badge>
  );
}

function CustomerAvatar({ customer, size = 'md' }: { customer: Customer; size?: 'sm' | 'md' }) {
  return (
    <div
      className={cn(
        'rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center shrink-0',
        size === 'sm' ? 'size-9 text-xs' : 'size-10 text-sm',
      )}
      aria-hidden
    >
      {customerInitials(customer)}
    </div>
  );
}

export function ConversationsClient({ token, staffName }: Props) {
  const [conversations, setConversations] = useState<ConversationListItemData[]>([]);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<EscalationAlert[]>([]);
  const [staffSentIds, setStaffSentIds] = useState<Set<string>>(new Set());
  const threadEndRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef<ConversationListItemData[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const didAutoSelectRef = useRef(false);
  conversationsRef.current = conversations;
  selectedIdRef.current = selectedId;

  const handoffCount = conversations.filter((c) => c.step === 'HANDOFF').length;
  const visibleConversations = sortConversationsByPriority(
    conversations.filter((c) => {
      if (filter === 'handoff' && c.step !== 'HANDOFF') return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        customerLabel(c.customer).toLowerCase().includes(q) ||
        c.customer.waId.toLowerCase().includes(q)
      );
    }),
  );

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  }, []);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ conversations: ConversationListItemData[] }>(
        '/conversations?limit=50',
        {},
        token,
      );
      const sorted = sortConversationsByPriority(data.conversations ?? []);
      setConversations(sorted);

      if (!didAutoSelectRef.current && !selectedIdRef.current && sorted.length > 0) {
        const pick = pickDefaultConversation(sorted);
        if (pick) {
          setSelectedId(pick.id);
          didAutoSelectRef.current = true;
        }
      }
    } catch {
      setConversations([]);
    } finally {
      setLoadingList(false);
    }
  }, [token]);

  const loadMessages = useCallback(
    async (conversationId: string, silent = false) => {
      if (!token) return;
      if (!silent) setLoadingThread(true);
      try {
        const data = await apiFetch<{
          step: string;
          customer: Customer;
          messages: ThreadMessage[];
        }>(`/conversations/${conversationId}/messages`, {}, token);
        setMessages(data.messages ?? []);
        setSelectedStep(data.step);
        setSelectedCustomer(data.customer);
      } catch {
        if (!silent) setMessages([]);
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [token],
  );

  const refreshAll = useCallback(() => {
    void loadConversations();
    if (selectedId) void loadMessages(selectedId, true);
  }, [loadConversations, loadMessages, selectedId]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => {
      void loadMessages(selectedId, true);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedId, loadMessages]);

  const { connected } = useEventStream({
    token,
    onEvent: (type, payload) => {
      if (type === 'message.received' || type === 'bot.escalation') {
        void loadConversations();
        const id = selectedIdRef.current;
        if (id) void loadMessages(id, true);
      }
      if (type === 'bot.escalation') {
        const customerId = payload.customerId as string | undefined;
        const conversationId = payload.conversationId as string | undefined;
        const conv = conversationsRef.current.find(
          (c) => c.id === conversationId || c.customer.id === customerId,
        );
        const label = conv ? customerLabel(conv.customer) : 'A customer';
        setAlerts((prev) => {
          if (conversationId && prev.some((a) => a.conversationId === conversationId)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: `${Date.now()}-${conversationId ?? customerId ?? 'unknown'}`,
              customerLabel: label,
              conversationId,
            },
          ];
        });
        if (conversationId) setSelectedId(conversationId);
      }
    },
  });

  async function handleTakeOver() {
    if (!selectedId) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/conversations/${selectedId}/handoff`, { method: 'POST' }, token);
      setSelectedStep('HANDOFF');
      await loadConversations();
      await loadMessages(selectedId, true);
    } catch (e) {
      showError(e instanceof ApiError ? e.message : 'Could not take over conversation');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleHandBack() {
    if (!selectedId) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/conversations/${selectedId}/handoff/release`, { method: 'POST' }, token);
      setSelectedStep('MENU');
      await loadConversations();
      await loadMessages(selectedId, true);
    } catch (e) {
      showError(e instanceof ApiError ? e.message : 'Could not release conversation');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleQueryComplete() {
    if (!selectedId) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/conversations/${selectedId}/query-complete`, { method: 'POST' }, token);
      setSelectedStep('HANDOFF_RATING' as typeof selectedStep);
      await loadConversations();
      await loadMessages(selectedId, true);
    } catch (e) {
      showError(e instanceof ApiError ? e.message : 'Could not complete query');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    setError(null);
    try {
      const result = await apiFetch<{ messageId: string }>(
        `/conversations/${selectedId}/reply`,
        { method: 'POST', body: JSON.stringify({ body: replyText.trim() }) },
        token,
      );
      setStaffSentIds((prev) => new Set(prev).add(result.messageId));
      setReplyText('');
      await loadMessages(selectedId, true);
      await loadConversations();
    } catch (e) {
      showError(e instanceof ApiError ? e.message : 'Message failed to send');
    } finally {
      setSending(false);
    }
  }

  const isHandoff = selectedStep === 'HANDOFF';
  const showThreadOnMobile = Boolean(selectedId);

  return (
    <div className="flex flex-col gap-4 dashboard-fit-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{CONVERSATIONS_LABEL}</h1>
            <span
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              title={connected ? 'Live updates connected' : 'Connecting…'}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  connected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40',
                )}
              />
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <CommsPageHint active="conversations" />
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <span>
                Bot escalation — <strong>{alert.customerLabel}</strong> needs human help
              </span>
              <div className="flex gap-2 shrink-0">
                {alert.conversationId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedId(alert.conversationId!);
                      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                    }}
                  >
                    Open chat
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-1 min-h-0 gap-4">
        <Card
          className={cn(
            'w-full md:w-96 shrink-0 flex flex-col min-h-0 py-0 gap-0',
            showThreadOnMobile && 'hidden md:flex',
          )}
        >
          <div className="px-4 py-3 border-b space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">Inbox</span>
              {handoffCount > 0 && (
                <Badge variant="destructive" className="animate-pulse text-xs">
                  {handoffCount} need{handoffCount === 1 ? 's' : ''} you
                </Badge>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or number…"
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  filter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('handoff')}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  filter === 'handoff' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                Needs you{handoffCount > 0 && ` (${handoffCount})`}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {loadingList && (
              <p className="p-4 text-sm text-muted-foreground">Loading conversations…</p>
            )}
            {!loadingList && visibleConversations.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground text-center">
                {filter === 'handoff'
                  ? 'No conversations need your attention right now.'
                  : 'No WhatsApp conversations yet.'}
              </p>
            )}
            {visibleConversations.map((conv) => (
              <ConversationListItem
                key={conv.id}
                conversation={conv}
                active={conv.id === selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </Card>

        <Card
          className={cn(
            'flex-1 flex flex-col min-h-0 py-0 gap-0',
            !showThreadOnMobile && 'hidden md:flex',
          )}
        >
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 p-8">
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs text-center max-w-xs">
                Choose a customer from the inbox to read messages and reply via WhatsApp.
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden shrink-0 -ml-2"
                  onClick={() => setSelectedId(null)}
                >
                  ← Back
                </Button>
                {selectedCustomer && <CustomerAvatar customer={selectedCustomer} />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {selectedCustomer ? customerLabel(selectedCustomer) : '…'}
                  </p>
                  {selectedCustomer?.waId && (
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {selectedCustomer.waId}
                    </p>
                  )}
                </div>
                {selectedStep && <StepBadge step={selectedStep} />}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#e5ddd5]/30 dark:bg-muted/20">
                {loadingThread && messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Loading messages…</p>
                )}
                {!loadingThread && messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No messages in this thread.</p>
                )}
                {messages.map((msg) => {
                  const inbound = msg.direction === 'INBOUND';
                  const sender = inbound
                    ? selectedCustomer
                      ? customerLabel(selectedCustomer)
                      : 'Customer'
                    : staffSentIds.has(msg.id)
                      ? staffName
                      : isHandoff
                        ? 'Staff'
                        : 'Bot';

                  return (
                    <div
                      key={msg.id}
                      className={cn('flex flex-col max-w-[85%]', inbound ? 'items-start' : 'items-end ml-auto')}
                    >
                      <span className="text-[11px] text-muted-foreground mb-1 px-1">{sender}</span>
                      <div
                        className={cn(
                          'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm',
                          inbound
                            ? 'bg-white dark:bg-muted text-foreground rounded-tl-sm'
                            : 'bg-[#dcf8c6] dark:bg-primary text-foreground dark:text-primary-foreground rounded-tr-sm',
                        )}
                      >
                        {msg.body}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 px-1">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              <div className="border-t px-4 py-3 bg-card">
                {!isHandoff ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      The bot is handling this chat. Take over to reply manually.
                    </p>
                    <Button onClick={handleTakeOver} disabled={actionLoading} className="w-full">
                      {actionLoading ? 'Taking over…' : 'Take Over Conversation'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      You&apos;re in control — the bot is silent. Reply to the customer, then click <strong>Query Completed</strong> when done.
                    </p>
                    <form onSubmit={handleSendReply} className="flex gap-2">
                      <Input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type a WhatsApp reply…"
                        disabled={sending}
                        className="flex-1"
                        autoComplete="off"
                      />
                      <Button type="submit" disabled={sending || !replyText.trim()}>
                        {sending ? 'Sending…' : 'Send'}
                      </Button>
                    </form>
                    <Button
                      onClick={handleQueryComplete}
                      disabled={actionLoading}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      {actionLoading ? 'Completing…' : '✓ Query Completed'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleHandBack}
                      disabled={actionLoading}
                      className="w-full text-muted-foreground text-xs"
                    >
                      Hand back to bot without rating
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
