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
  return formatTicketPhone(c.waId);
}

export function formatTicketPhone(raw: string): string {
  const digits = raw.replace(/^\+/, '');
  if (digits.startsWith('27') && digits.length === 11) {
    return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return raw.startsWith('+') ? raw : `+${raw}`;
}

export function customerSubtitle(c: TicketCardCustomer): string {
  const name = customerLabel(c);
  const phone = formatTicketPhone(c.waId);
  if (name === phone) return phone;
  return `${name} · ${phone}`;
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
        'chat-list-item w-full text-left px-3 py-2.5 hover:bg-accent/70 transition-colors border-b border-border/50',
        active && 'bg-accent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-[13px] leading-snug line-clamp-2 flex-1">
          {ticket.subject ?? '(no subject)'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', badge.className)}>
            {badge.label}
          </Badge>
          <TicketSlaBadge status={ticket.status} createdAt={ticket.createdAt} />
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
        {customerSubtitle(ticket.customer)}
      </div>
      {last && (
        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-snug opacity-80">
          {last.body}
        </div>
      )}
      <div className="text-[10px] text-muted-foreground/80 mt-1">{timeAgo(ticket.updatedAt)}</div>
    </button>
  );
}

export { STATUS_BADGE };
