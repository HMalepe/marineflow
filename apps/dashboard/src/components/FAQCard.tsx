import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FaqCardStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface FaqCardData {
  id: string;
  question: string;
  answer: string;
  status: FaqCardStatus;
  approvedAt: string | null;
  approvedBy: string | null;
}

const PREVIEW_LEN = 140;

function truncate(text: string, max = PREVIEW_LEN): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function statusBadge(status: FaqCardStatus) {
  switch (status) {
    case 'APPROVED':
      return (
        <Badge className="bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30">
          Approved
        </Badge>
      );
    case 'REJECTED':
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return (
        <Badge className="bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-600/30">
          Pending
        </Badge>
      );
  }
}

interface FAQCardProps {
  faq: FaqCardData;
  index: number;
  askCount: number;
  isMostAsked: boolean;
  isNeverTriggered: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export function FAQCard({
  faq,
  index,
  askCount,
  isMostAsked,
  isNeverTriggered,
  busy,
  onEdit,
  onDelete,
  onApprove,
  onReject,
}: FAQCardProps) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 pr-2">
          <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">#{index + 1}</span>
          <h3 className="font-medium text-sm leading-snug">{faq.question}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {statusBadge(faq.status)}
          {isMostAsked && (
            <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 text-xs">
              Most asked
            </Badge>
          )}
          {isNeverTriggered && (
            <Badge variant="secondary" className="text-xs text-muted-foreground">
              Never triggered
            </Badge>
          )}
          {faq.status === 'APPROVED' && (
            <Badge variant="outline" className="text-xs">
              Live on WhatsApp
            </Badge>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2">{truncate(faq.answer)}</p>
      {faq.status === 'APPROVED' && (
        <p className="text-[11px] text-muted-foreground">
          Asked {askCount} time{askCount === 1 ? '' : 's'} (30d)
        </p>
      )}
      {faq.status === 'APPROVED' && faq.approvedAt && (
        <p className="text-[11px] text-muted-foreground/60">
          Approved{' '}
          {new Date(faq.approvedAt).toLocaleDateString('en-ZA', {
            day: 'numeric',
            month: 'short',
            year: '2-digit',
          })}
          {faq.approvedBy ? ` · ${faq.approvedBy}` : ''}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onEdit}>
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className="text-destructive hover:text-destructive opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
          onClick={onDelete}
        >
          Delete
        </Button>
        {faq.status !== 'APPROVED' && (
          <Button type="button" size="sm" disabled={busy} onClick={onApprove}>
            Approve
          </Button>
        )}
        {faq.status !== 'REJECTED' && (
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onReject}>
            Reject
          </Button>
        )}
      </div>
    </>
  );
}

export function faqCardClassName(status: FaqCardStatus, isDragging?: boolean): string {
  return cn(
    'group rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow',
    'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    isDragging && 'shadow-lg ring-2 ring-ring/30 z-10 opacity-90',
    status === 'REJECTED' && 'opacity-70',
    status === 'PENDING' && 'border-yellow-600/20',
    status === 'APPROVED' && 'border-green-600/15',
  );
}
