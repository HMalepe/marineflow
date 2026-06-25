'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEventStream } from '@/hooks/use-event-stream';
import { apiFetch, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CONVERSATIONS_LABEL, CONVERSATIONS_TAGLINE, TICKETS_LABEL } from '@/lib/dashboard-nav';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import Link from 'next/link';
import {
  ConversationListItem,
  customerInitials,
  customerLabel,
  pickDefaultConversation,
  sortConversationsByPriority,
  type ConversationListItemData,
} from '@/components/ConversationListItem';
import { Search, RefreshCw, Pin, ChevronLeft, MoreHorizontal } from 'lucide-react';
import { PaneHeader } from '@/components/section-panel';
import { MobileFilterBar } from '@/components/mobile-filter-bar';
import { PremiumDisclosure } from '@/components/premium-disclosure';
import {
  ChatComposer,
  ChatEmptyState,
  ChatListSectionLabel,
  ChatThread,
  type ChatMessage,
} from '@/components/chat-ui';
import {
  loadPinnedConversationIds,
  togglePinnedConversationId,
} from '@/lib/conversation-pins';
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
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function stepStatusLabel(step: string): string {
  if (step === 'HANDOFF') return 'You’re replying';
  if (step === 'MENU' || step === 'IDLE') return 'Bot active';
  return STEP_LABELS[step] ?? step.replace(/_/g, ' ').toLowerCase();
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
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set());
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef<ConversationListItemData[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const didAutoSelectRef = useRef(false);
  conversationsRef.current = conversations;
  selectedIdRef.current = selectedId;

  const handoffCount = conversations.filter((c) => c.step === 'HANDOFF').length;
  const filteredConversations = conversations.filter((c) => {
    if (filter === 'handoff' && c.step !== 'HANDOFF') return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      customerLabel(c.customer).toLowerCase().includes(q) ||
      c.customer.waId.toLowerCase().includes(q)
    );
  });
  const visibleConversations = sortConversationsByPriority(filteredConversations, pinnedIds);
  const pinnedConversations = visibleConversations.filter((c) => pinnedIds.has(c.id));
  const recentConversations = visibleConversations.filter((c) => !pinnedIds.has(c.id));
  const filterActiveCount = (filter !== 'all' ? 1 : 0) + (search.trim() ? 1 : 0);

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
      const sorted = sortConversationsByPriority(data.conversations ?? [], pinnedIds);
      setConversations(sorted);

      if (!didAutoSelectRef.current && !selectedIdRef.current && sorted.length > 0) {
        const pick = pickDefaultConversation(sorted, pinnedIds);
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
  }, [token, pinnedIds]);

  useEffect(() => {
    setPinnedIds(loadPinnedConversationIds());
  }, []);

  function handleTogglePin(conversationId: string) {
    setPinnedIds(togglePinnedConversationId(conversationId));
  }

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
    const container = threadScrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: messages.length > 3 ? 'smooth' : 'auto',
    });
  }, [messages, selectedId]);

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

  async function handleSendReply(e?: React.FormEvent) {
    e?.preventDefault();
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
  const isSelectedPinned = selectedId ? pinnedIds.has(selectedId) : false;

  const chatMessages: ChatMessage[] = messages.map((msg) => {
    const inbound = msg.direction === 'INBOUND';
    const sender = inbound
      ? selectedCustomer
        ? customerLabel(selectedCustomer)
        : 'Customer'
      : staffSentIds.has(msg.id)
        ? staffName
        : isHandoff
          ? 'You'
          : 'Bot';
    return {
      id: msg.id,
      direction: inbound ? 'inbound' : 'outbound',
      body: msg.body,
      createdAt: msg.createdAt,
      senderLabel: sender,
    };
  });

  function renderConversationList() {
    if (loadingList) {
      return <p className="p-6 text-sm text-muted-foreground text-center">Loading conversations…</p>;
    }
    if (visibleConversations.length === 0) {
      return (
        <p className="p-8 text-sm text-muted-foreground text-center leading-relaxed">
          {filter === 'handoff'
            ? 'No conversations need your attention right now.'
            : 'No WhatsApp conversations yet.'}
        </p>
      );
    }

    return (
      <>
        {pinnedConversations.length > 0 && (
          <>
            <ChatListSectionLabel>Pinned</ChatListSectionLabel>
            {pinnedConversations.map((conv) => (
              <ConversationListItem
                key={conv.id}
                conversation={conv}
                active={conv.id === selectedId}
                pinned
                onSelect={setSelectedId}
                onTogglePin={handleTogglePin}
              />
            ))}
          </>
        )}
        {recentConversations.length > 0 && (
          <>
            {pinnedConversations.length > 0 && <ChatListSectionLabel>Recent</ChatListSectionLabel>}
            {recentConversations.map((conv) => (
              <ConversationListItem
                key={conv.id}
                conversation={conv}
                active={conv.id === selectedId}
                onSelect={setSelectedId}
                onTogglePin={handleTogglePin}
              />
            ))}
          </>
        )}
      </>
    );
  }

  return (
    <div className="dashboard-workspace dashboard-comms-page">
      <DashboardPageHeader
        title={CONVERSATIONS_LABEL}
        variant="cyan"
        className={cn('shrink-0 dashboard-neon-block', showThreadOnMobile && 'hidden md:block')}
        subtitle={
          <>
            <span
              className="inline-flex items-center gap-1.5 text-[10px] mr-2"
              title={connected ? 'Live updates connected' : 'Connecting…'}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  connected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40',
                )}
              />
              {connected ? 'Live' : 'Connecting…'}
            </span>
            <PremiumDisclosure label="Conversations vs tickets" desktopOpen={false} className="inline">
              {CONVERSATIONS_TAGLINE} For complaints, open{' '}
              <Link href="/tickets" className="text-primary underline-offset-4 hover:underline">
                {TICKETS_LABEL}
              </Link>
              .
            </PremiumDisclosure>
          </>
        }
        actions={
          <Button variant="outline" size="sm" onClick={refreshAll} className="shrink-0 touch-manipulation hidden md:inline-flex">
            <RefreshCw className="size-4 mr-1.5" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-2.5 text-sm text-destructive shrink-0">
          {error}
        </div>
      )}

      <div className="dashboard-inbox-frame dashboard-inbox-frame--chat flex-col md:flex-row">
        <div
          className={cn(
            'dashboard-inbox-pane dashboard-inbox-pane--list w-full md:w-[22rem] lg:w-96 shrink-0 overflow-hidden',
            showThreadOnMobile && 'hidden md:flex',
          )}
        >
          <PaneHeader
            title="Chats"
            trailing={
              handoffCount > 0 ? (
                <Badge variant="destructive" className="text-[10px] px-2 py-0">
                  {handoffCount}
                </Badge>
              ) : (
                <Button variant="ghost" size="icon" className="size-8 md:hidden" onClick={refreshAll} aria-label="Refresh">
                  <RefreshCw className="size-4" />
                </Button>
              )
            }
          />
          <div className="dashboard-pane-toolbar">
            <MobileFilterBar
              activeCount={filterActiveCount}
              primary={
                <div className="relative w-full min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search chats…"
                    className="pl-9 h-10 rounded-full bg-muted/30 border-transparent focus-visible:border-border text-base md:text-sm"
                  />
                </div>
              }
              secondary={
                <div className="flex gap-1.5 p-0.5 rounded-full bg-muted/40 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className={cn(
                      'flex-1 sm:flex-none rounded-full px-4 py-2 text-xs font-medium transition-colors touch-manipulation',
                      filter === 'all' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('handoff')}
                    className={cn(
                      'flex-1 sm:flex-none rounded-full px-4 py-2 text-xs font-medium transition-colors touch-manipulation',
                      filter === 'handoff' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground',
                    )}
                  >
                    Needs you{handoffCount > 0 ? ` · ${handoffCount}` : ''}
                  </button>
                </div>
              }
            />
          </div>

          {alerts.length > 0 && !showThreadOnMobile && (
            <div className="px-3 py-2 border-b border-destructive/20 bg-destructive/5 space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between gap-2 text-xs text-destructive">
                  <span className="truncate">
                    <strong>{alert.customerLabel}</strong> needs help
                  </span>
                  {alert.conversationId && (
                    <button
                      type="button"
                      className="shrink-0 font-medium underline-offset-2 hover:underline"
                      onClick={() => {
                        setSelectedId(alert.conversationId!);
                        setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                      }}
                    >
                      Open
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="chat-list-scroll flex-1 overflow-y-auto overscroll-y-contain min-h-0">
            {renderConversationList()}
          </div>
        </div>

        <div
          className={cn(
            'dashboard-inbox-pane dashboard-inbox-pane--thread flex-1 flex flex-col overflow-hidden min-h-0 min-w-0',
            !showThreadOnMobile && 'hidden md:flex',
          )}
        >
          {!selectedId ? (
            <ChatEmptyState
              title="Select a chat"
              hint="Pick a customer from the list to read messages and reply on WhatsApp."
            />
          ) : (
            <>
              <div className="chat-thread-header shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden shrink-0 rounded-full touch-manipulation"
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to chats"
                >
                  <ChevronLeft className="size-5" />
                </Button>
                {selectedCustomer && <CustomerAvatar customer={selectedCustomer} size="sm" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate text-[15px]">
                    {selectedCustomer ? customerLabel(selectedCustomer) : '…'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedStep ? stepStatusLabel(selectedStep) : '…'}
                    {selectedCustomer?.waId ? ` · ${selectedCustomer.waId}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full size-9"
                    onClick={() => selectedId && handleTogglePin(selectedId)}
                    aria-label={isSelectedPinned ? 'Unpin chat' : 'Pin chat'}
                  >
                    <Pin className={cn('size-4', isSelectedPinned && 'fill-current text-primary')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full size-9 hidden md:inline-flex"
                    onClick={refreshAll}
                    aria-label="Refresh messages"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full size-9"
                      onClick={() => setThreadMenuOpen((v) => !v)}
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                    {threadMenuOpen && (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-40 cursor-default"
                          aria-label="Close menu"
                          onClick={() => setThreadMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-full mt-1 z-50 min-w-[11rem] rounded-xl border bg-popover p-1 shadow-lg text-sm">
                          {!isHandoff ? (
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted touch-manipulation"
                              disabled={actionLoading}
                              onClick={() => {
                                setThreadMenuOpen(false);
                                void handleTakeOver();
                              }}
                            >
                              Take over chat
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted touch-manipulation"
                                disabled={actionLoading}
                                onClick={() => {
                                  setThreadMenuOpen(false);
                                  void handleQueryComplete();
                                }}
                              >
                                Done — hand back to bot
                              </button>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-muted-foreground touch-manipulation"
                                disabled={actionLoading}
                                onClick={() => {
                                  setThreadMenuOpen(false);
                                  void handleHandBack();
                                }}
                              >
                                Skip rating
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <ChatThread
                messages={chatMessages}
                loading={loadingThread}
                emptyLabel="No messages in this thread yet."
                scrollRef={threadScrollRef}
                endRef={threadEndRef}
              />

              {!isHandoff ? (
                <div className="chat-composer shrink-0 safe-area-pb px-4 py-3 border-t bg-card/80">
                  <p className="text-xs text-muted-foreground text-center mb-3">The bot is handling this chat.</p>
                  <Button onClick={handleTakeOver} disabled={actionLoading} className="w-full rounded-full touch-manipulation">
                    {actionLoading ? 'Taking over…' : 'Take over to reply'}
                  </Button>
                </div>
              ) : (
                <ChatComposer
                  value={replyText}
                  onChange={setReplyText}
                  onSubmit={() => void handleSendReply()}
                  placeholder="Type a message…"
                  sending={sending}
                  footer={
                    <p className="text-[11px] text-muted-foreground text-center pb-2 px-2">
                      Sent via WhatsApp ·{' '}
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => void handleQueryComplete()}
                        disabled={actionLoading}
                      >
                        Mark done
                      </button>
                    </p>
                  }
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
