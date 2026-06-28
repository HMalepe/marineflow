'use client';

import { cn } from '@/lib/utils';

export type CollapsedAttention = {
  count: number;
  label?: string;
  badgeText?: string;
  severity?: 'warning' | 'critical';
};

export function resolveCollapsedAttention(
  explicit: CollapsedAttention | undefined,
  actionCount: number | undefined,
  contextCount: number,
  options?: Pick<CollapsedAttention, 'label' | 'badgeText' | 'severity'>,
): CollapsedAttention | undefined {
  if (explicit && explicit.count > 0) return explicit;

  const count = actionCount ?? contextCount;
  if (count <= 0) return undefined;

  return {
    count,
    label: options?.label,
    badgeText: options?.badgeText,
    severity: options?.severity,
  };
}

export function CollapsedAttentionBadge({ attention }: { attention: CollapsedAttention }) {
  const severity = attention.severity ?? 'warning';
  const badgeText = attention.badgeText ?? 'to action';
  const label =
    attention.label ??
    (attention.count === 1 ? '1 item needs action' : `${attention.count} items need action`);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide tabular-nums',
        severity === 'critical'
          ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
      )}
      title={label}
    >
      <span className="relative flex size-2 shrink-0" aria-hidden>
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-70',
            severity === 'critical' ? 'bg-red-400' : 'bg-amber-400',
          )}
        />
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            severity === 'critical' ? 'bg-red-500' : 'bg-amber-500',
          )}
        />
      </span>
      <span className="normal-case tracking-normal">
        {attention.count} {badgeText}
      </span>
    </span>
  );
}
