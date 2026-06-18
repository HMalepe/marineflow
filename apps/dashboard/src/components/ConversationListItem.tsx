import { Badge } from '@/components/ui/badge';
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

export function sortConversationsByPriority<T extends ConversationListItemData>(convs: T[]): T[] {
  return [...convs].sort((a, b) => {
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
): T | null {
  const sorted = sortConversationsByPriority(convs);
  return sorted[0] ?? null;
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

interface ConversationListItemProps {
  conversation: ConversationListItemData;
  active: boolean;
  onSelect: (id: string) => void;
}

export function ConversationListItem({ conversation: conv, active, onSelect }: ConversationListItemProps) {
  const preview =
    conv.lastMessage?.direction === 'OUTBOUND'
      ? `You: ${conv.lastMessage.body}`
      : conv.lastMessage?.body ?? 'No messages yet';

  return (
    <button
      type="button"
      onClick={() => onSelect(conv.id)}
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
            <span className="font-medium text-sm truncate">{customerLabel(conv.customer)}</span>
            <StepBadge step={conv.step} />
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
            <WaitingTimeIndicator lastCustomerMessageAt={conv.lastCustomerMessageAt} />
            <span className="text-[11px] text-muted-foreground">
              {formatConversationTime(conv.lastMessageAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
