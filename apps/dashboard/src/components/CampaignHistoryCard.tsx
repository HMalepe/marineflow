import {
  Clock,
  Film,
  ImageIcon,
  Loader2,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CampaignMediaType } from '../app/(dashboard)/campaigns/campaign-media-upload';

type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'CANCELLED';

interface AudienceFilter {
  type: 'all' | 'tags' | 'inactive';
  tags?: string[];
  inactiveDays?: number;
}

export interface CampaignPerformance {
  sentAt: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  bookedCount: number;
}

export interface CampaignHistoryItem {
  id: string;
  name: string;
  message: string;
  mediaUrl: string | null;
  mediaType: CampaignMediaType | null;
  status: CampaignStatus;
  audienceFilter: AudienceFilter;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  delivered: number;
  failed: number;
  performance: CampaignPerformance | null;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function audienceLabel(filter: AudienceFilter): string {
  if (filter.type === 'tags' && filter.tags?.length) {
    return filter.tags.length === 1 ? `Tag: ${filter.tags[0]}` : `${filter.tags.length} tags selected`;
  }
  if (filter.type === 'inactive') {
    return `Inactive ${filter.inactiveDays ?? 90}+ days`;
  }
  return 'All POPIA accepted';
}

function statusMeta(status: CampaignStatus) {
  switch (status) {
    case 'COMPLETED':
      return {
        label: 'Sent',
        className: 'bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30',
        accent: 'border-l-green-500',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        className: 'bg-destructive/10 text-destructive border-destructive/30',
        accent: 'border-l-destructive/50',
      };
    default:
      return {
        label: status,
        className: 'bg-muted text-muted-foreground border-border',
        accent: 'border-l-muted-foreground/40',
      };
  }
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] tabular-nums">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

interface CampaignHistoryCardProps {
  campaign: CampaignHistoryItem;
  showPerformance?: boolean;
}

export function CampaignHistoryCard({ campaign: c, showPerformance = true }: CampaignHistoryCardProps) {
  const meta = statusMeta(c.status);
  const perf = c.performance;

  return (
    <Card className={cn('overflow-hidden border-l-4 transition-shadow hover:shadow-md', meta.accent)}>
      <CardContent className="p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold truncate">{c.name}</h3>
          <Badge variant="outline" className={cn('shrink-0', meta.className)}>
            {meta.label}
          </Badge>
          {c.mediaUrl && (
            <Badge variant="outline" className="text-xs gap-1 font-normal">
              {c.mediaType === 'video' ? <Film className="size-3" /> : <ImageIcon className="size-3" />}
              {c.mediaType === 'video' ? 'Video' : 'Photo'}
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{c.message}</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Target className="size-3" />
            {audienceLabel(c.audienceFilter)}
          </span>
          {c.sentAt && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              Sent {formatWhen(c.sentAt)}
            </span>
          )}
          {c.status === 'SENDING' && (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <Loader2 className="size-3 animate-spin" />
              Delivering messages…
            </span>
          )}
        </div>

        {showPerformance && c.status === 'COMPLETED' && (
          <div className="flex flex-wrap gap-2 pt-1">
            {perf ? (
              <>
                <MetricPill label="Sent" value={perf.sentCount} />
                <MetricPill label="Delivered" value={perf.deliveredCount} />
                <MetricPill label="Read" value={perf.readCount} />
                <MetricPill label="Replied" value={perf.repliedCount} />
                <MetricPill label="Booked (24h)" value={perf.bookedCount} />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                {c.delivered} delivered · {c.failed} failed · {c.totalRecipients} total
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
