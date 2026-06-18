import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ticketSlaLevel, type TicketSlaLevel } from '@/lib/ticket-queue';

export interface TicketCardCustomer {
  id: string;
  waId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface TicketCardData {
  id: string;
  subject: string | null;
  status: string;
  type?: string;
  createdAt: string;
  updatedAt: string;
  customer: TicketCardCustomer;
  messages: { body: string; direction: string; createdAt: string }[];
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Open', className: 'bg-red-100 text-red-700 border-red-200' },
  WAITING_CUSTOMER: { label: 'Waiting', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  RESOLVED: { label: 'Resolved', className: 'bg-green-100 text-green-700 border-green-200' },
  AUTO_RESOLVED: { label: 'Auto-resolved', className: 'bg-muted text-muted-foreground border-border' },
};

const SLA_BADGE: Record<Exclude<TicketSlaLevel, null>, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  critical: { label: 'Critical', className: 'bg-red-600 text-white border-red-700' },
};

export function customerLabel(c: TicketCardCustomer): string {
  if (c.displayName) return c.displayName;
  const parts = [c.firstName, c.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return c.waId;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function TicketSlaBadge({ status, createdAt }: { status: string; createdAt: string }) {
  const level = ticketSlaLevel(status, createdAt);
  if (!level) return null;
  const badge = SLA_BADGE[level];
  return (
    <Badge variant="outline" className={cn('text-[10px] shrink-0', badge.className)}>
      {badge.label}
    </Badge>
  );
}

interface TicketCardProps {
  ticket: TicketCardData;
  active: boolean;
  onSelect: (ticket: TicketCardData) => void;
}

export function TicketCard({ ticket, active, onSelect }: TicketCardProps) {
  const badge = STATUS_BADGE[ticket.status] ?? STATUS_BADGE.OPEN!;
  const last = ticket.messages[ticket.messages.length - 1];

  return (
    <button
      type="button"
      onClick={() => onSelect(ticket)}
      className={cn(
        'w-full text-left px-4 py-3 hover:bg-accent transition-colors',
        active && 'bg-accent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm truncate flex-1">
          {ticket.subject ?? '(no subject)'}
        </span>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant="outline" className={cn('text-[10px]', badge.className)}>
            {badge.label}
          </Badge>
          <TicketSlaBadge status={ticket.status} createdAt={ticket.createdAt} />
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5 truncate">
        {customerLabel(ticket.customer)} · {ticket.customer.waId}
      </div>
      {last && (
        <div className="text-xs text-muted-foreground mt-1 truncate opacity-70">{last.body}</div>
      )}
      <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(ticket.updatedAt)}</div>
    </button>
  );
}

export { STATUS_BADGE };
