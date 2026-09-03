import {
  BUSINESS_TYPE_CHIP_CLASS,
  BUSINESS_TYPES,
  getBusinessTypeLabel,
  getBusinessTypeShortLabel,
  type BusinessType,
} from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function BusinessTypeBadge({
  type,
  short = false,
  className,
}: {
  type: BusinessType;
  short?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-medium border',
        BUSINESS_TYPE_CHIP_CLASS[type] ?? BUSINESS_TYPE_CHIP_CLASS.OTHER,
        className,
      )}
    >
      {short ? getBusinessTypeShortLabel(type) : getBusinessTypeLabel(type)}
    </Badge>
  );
}

export type BusinessTypeCount = { type: BusinessType; count: number };

export function BusinessTypeBreakdown({ counts }: { counts: BusinessTypeCount[] }) {
  const byType = new Map(counts.map((c) => [c.type, c.count]));
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  if (total === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <div>
        <p className="text-sm font-semibold">Businesses by type</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {total} tenant{total !== 1 ? 's' : ''} on the platform
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {BUSINESS_TYPES.map((type) => {
          const count = byType.get(type) ?? 0;
          if (count === 0) return null;
          return (
            <div
              key={type}
              className="inline-flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5"
            >
              <BusinessTypeBadge type={type} short />
              <span className="text-sm font-semibold tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
