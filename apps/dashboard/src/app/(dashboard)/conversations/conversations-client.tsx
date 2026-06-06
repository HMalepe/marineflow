'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEventStream } from '@/hooks/use-event-stream';
import { apiFetch, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  waId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface MessagePreview {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  step: string;
  lastMessageAt: string | null;
  isHandoff: boolean;
  customer: Customer;
  lastMessage: MessagePreview | null;
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
  GREETING: 'Greeting',
  PICK_BRANCH: 'Pick branch',
  PICK_SERVICE: 'Pick service',
  PICK_STAFF: 'Pick staff',
  PICK_DATE: 'Pick date',
  PICK_SLOT: 'Pick slot',
  CONFIRM_BOOKING: 'Confirming',
  MANAGE_BOOKING: 'Manage booking',
  RESCHEDULE: 'Reschedule',
  COMPLAINT: 'Complaint',
  FAQ: 'FAQ',
  LOYALTY: 'Loyalty',
  CSAT: 'Feedback',
  CLOSED: 'Closed',
};

function customerLabel(c: Customer): string {
  const name = c.displayName ?? [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return name || c.waId || 'Unknown';
}

function customerInitials(c: Customer): string {
  const label = customerLabel(c);
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

function stepLabel(step: string): string {
  return STEP_LABELS[step] ?? step.replace(/_/g, ' ').toLowerCase();
}

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

function sortConversations(convs: Conversation[]): Conversation[] {
  return [...convs].sort((a, b) => {
    const aHandoff = a.step === 'HANDOFF' ? 0 : 1;
    const bHandoff = b.step === 'HANDOFF' ? 0 : 1;
    if (aHandoff !== bHandoff) return aHandoff - bHandoff;
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

function StepBadge({ step }: { step: string }) {
  const label = stepLabel(step);
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState<InboxFilter>('all');
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
  const conversationsRef = useRef<Conversation[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  conversationsRef.current = conversations;
  selectedIdRef.current = selectedId;

  const handoffCount = conversations.filter((c) => c.step === 'HANDOFF').length;
  const visibleConversations = sortConversations(
    filter === 'handoff' ? conversations.filter((c) => c.step === 'HANDOFF') : conversations,
  );

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  }, []);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>(
        '/conversations?limit=50',
        {},
        token,
      );
      setConversations(sortConversations(data.conversations ?? []));
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
    <div className="flex flex-col gap-4 h-[calc(100vh-4rem)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
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
          <p className="text-muted-foreground text-sm mt-1">
            WhatsApp inbox — take over when customers need a human.
          </p>
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
        {/* Left — inbox */}
        <Card
          className={cn(
            'w-full md:w-96 shrink-0 flex flex-col min-h-0 py-0 gap-0',
            showThreadOnMobile && 'hidden md:flex',
          )}
        >
          <div className="px-4 py-3 border-b space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Inbox</span>
              {handoffCount > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  {handoffCount} need{handoffCount === 1 ? 's' : ''} you
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filter === 'handoff' ? 'default' : 'outline'}
                onClick={() => setFilter('handoff')}
              >
                Needs you
                {handoffCount > 0 && ` (${handoffCount})`}
              </Button>
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
            {visibleConversations.map((conv) => {
              const active = conv.id === selectedId;
              const preview =
                conv.lastMessage?.direction === 'OUTBOUND'
                  ? `You: ${conv.lastMessage.body}`
                  : conv.lastMessage?.body ?? 'No messages yet';
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedId(conv.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
                    active && 'bg-muted border-l-2 border-l-primary',
                    conv.step === 'HANDOFF' && !active && 'bg-destructive/5',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <CustomerAvatar customer={conv.customer} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {customerLabel(conv.customer)}
                        </span>
                        <StepBadge step={conv.step} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {formatTime(conv.lastMessageAt)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Right — thread */}
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
                      You&apos;re in control — the bot is silent until you hand back.
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
                      variant="outline"
                      onClick={handleHandBack}
                      disabled={actionLoading}
                      className="w-full"
                    >
                      {actionLoading ? 'Releasing…' : 'Hand Back to Bot'}
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
