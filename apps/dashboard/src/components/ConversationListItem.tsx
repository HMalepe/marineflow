import { Pin } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConversationListCustomer {
  id: string;
  waId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface ConversationListItemData {
  id: string;
  step: string;
  lastMessageAt: string | null;
  lastCustomerMessageAt: string | null;
  customer: ConversationListCustomer;
  lastMessage: {
    direction: 'INBOUND' | 'OUTBOUND';
    body: string;
  } | null;
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

export function customerLabel(c: ConversationListCustomer): string {
  const name = c.displayName ?? [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return name || c.waId || 'Unknown';
}

export function customerInitials(c: ConversationListCustomer): string {
  const label = customerLabel(c);
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

function stepLabel(step: string): string {
  return STEP_LABELS[step] ?? step.replace(/_/g, ' ').toLowerCase();
}

export function formatConversationTime(iso: string | null): string {
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

export function waitingMinutes(lastCustomerMessageAt: string | null): number | null {
  if (!lastCustomerMessageAt) return null;
  const diffMs = Date.now() - new Date(lastCustomerMessageAt).getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / 60_000);
}

export function sortConversationsByPriority<T extends ConversationListItemData>(
  convs: T[],
  pinnedIds?: Set<string>,
): T[] {
  return [...convs].sort((a, b) => {
    const aPin = pinnedIds?.has(a.id) ? 0 : 1;
    const bPin = pinnedIds?.has(b.id) ? 0 : 1;
    if (aPin !== bPin) return aPin - bPin;

    const aHandoff = a.step === 'HANDOFF' ? 0 : 1;
    const bHandoff = b.step === 'HANDOFF' ? 0 : 1;
    if (aHandoff !== bHandoff) return aHandoff - bHandoff;

    const aWait = a.lastCustomerMessageAt
      ? new Date(a.lastCustomerMessageAt).getTime()
      : a.lastMessageAt
        ? new Date(a.lastMessageAt).getTime()
        : Number.MAX_SAFE_INTEGER;
    const bWait = b.lastCustomerMessageAt
      ? new Date(b.lastCustomerMessageAt).getTime()
      : b.lastMessageAt
        ? new Date(b.lastMessageAt).getTime()
        : Number.MAX_SAFE_INTEGER;
    return aWait - bWait;
  });
}

export function pickDefaultConversation<T extends ConversationListItemData>(
  convs: T[],
  pinnedIds?: Set<string>,
): T | null {
  const sorted = sortConversationsByPriority(convs, pinnedIds);
  return sorted[0] ?? null;
}

function CustomerAvatar({ customer, size = 'md' }: { customer: ConversationListCustomer; size?: 'sm' | 'md' }) {
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

export function WaitingTimeIndicator({ lastCustomerMessageAt }: { lastCustomerMessageAt: string | null }) {
  const minutes = waitingMinutes(lastCustomerMessageAt);
  if (minutes == null) return null;

  const colorClass =
    minutes > 30
      ? 'text-destructive font-medium'
      : minutes > 10
        ? 'text-amber-600 dark:text-amber-400 font-medium'
        : 'text-muted-foreground';

  return (
    <span className={cn('text-[11px]', colorClass)}>
      Waiting {minutes} min
    </span>
  );
}

function stepHint(step: string): string | null {
  if (step === 'HANDOFF') return 'Needs you';
  if (step === 'MENU' || step === 'IDLE') return null;
  const label = stepLabel(step);
  return label.length > 24 ? `${label.slice(0, 22)}…` : label;
}

interface ConversationListItemProps {
  conversation: ConversationListItemData;
  active: boolean;
  pinned?: boolean;
  onSelect: (id: string) => void;
  onTogglePin?: (id: string) => void;
}

export function ConversationListItem({
  conversation: conv,
  active,
  pinned = false,
  onSelect,
  onTogglePin,
}: ConversationListItemProps) {
  const preview =
    conv.lastMessage?.direction === 'OUTBOUND'
      ? `You: ${conv.lastMessage.body}`
      : conv.lastMessage?.body ?? 'No messages yet';
  const needsYou = conv.step === 'HANDOFF';
  const hint = stepHint(conv.step);

  return (
    <div
      className={cn(
        'chat-list-item group relative',
        active && 'chat-list-item-active',
        needsYou && !active && 'chat-list-item-urgent',
      )}
    >
      <button type="button" onClick={() => onSelect(conv.id)} className="chat-list-item-button">
        <div className="relative shrink-0">
          <CustomerAvatar customer={conv.customer} size="sm" />
          {needsYou && (
            <span
              className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-card"
              aria-label="Needs attention"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-[15px] truncate text-foreground">
              {customerLabel(conv.customer)}
            </span>
            <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
              {formatConversationTime(conv.lastMessageAt)}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-1 leading-snug">{preview}</p>
          <div className="flex items-center gap-2 mt-1 min-h-[1rem]">
            {pinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
                <Pin className="size-2.5" aria-hidden />
                Pinned
              </span>
            )}
            {hint && (
              <span className={cn('text-[10px]', needsYou ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                {hint}
              </span>
            )}
            <WaitingTimeIndicator lastCustomerMessageAt={conv.lastCustomerMessageAt} />
          </div>
        </div>
      </button>
      {onTogglePin && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(conv.id);
          }}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full touch-manipulation transition-opacity',
            pinned ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-muted-foreground hover:text-foreground',
          )}
          aria-label={pinned ? 'Unpin conversation' : 'Pin conversation'}
        >
          <Pin className={cn('size-4', pinned && 'fill-current')} />
        </button>
      )}
    </div>
  );
}
