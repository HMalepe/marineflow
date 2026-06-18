'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SetupHealthCheckId =
  | 'staff_no_services'
  | 'services_uncategorized'
  | 'faqs_pending'
  | 'branches_no_staff'
  | 'popia_optin_low';

export type SetupHealthCheck = {
  id: SetupHealthCheckId;
  label: string;
  fixHref: string;
  fixLabel: string;
  penalty: number;
  count: number;
};

export type SetupHealthData = {
  salonId: string;
  score: number;
  checks: SetupHealthCheck[];
};

const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function dismissKey(salonId: string, checkId: string): string {
  return `setup-health-dismissed:${salonId}:${checkId}`;
}

function readDismissedAt(salonId: string, checkId: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(dismissKey(salonId, checkId));
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

function isDismissed(salonId: string, checkId: string): boolean {
  const at = readDismissedAt(salonId, checkId);
  if (!at) return false;
  return Date.now() - at < DISMISS_MS;
}

function scoreBarClass(score: number): string {
  if (score > 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreTextClass(score: number): string {
  if (score > 70) return 'text-emerald-700 dark:text-emerald-300';
  if (score >= 40) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

type Props = {
  data: SetupHealthData;
};

export function SetupHealthScore({ data }: Props) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const set = new Set<string>();
    for (const check of data.checks) {
      if (isDismissed(data.salonId, check.id)) set.add(check.id);
    }
    setDismissedIds(set);
  }, [data.checks, data.salonId]);

  const visibleChecks = useMemo(
    () => data.checks.filter((c) => !dismissedIds.has(c.id)),
    [data.checks, dismissedIds],
  );

  const dismiss = useCallback(
    (checkId: SetupHealthCheckId) => {
      try {
        localStorage.setItem(dismissKey(data.salonId, checkId), String(Date.now()));
      } catch {
        // ignore quota / private mode
      }
      setDismissedIds((prev) => new Set(prev).add(checkId));
    },
    [data.salonId],
  );

  if (data.score >= 100 && data.checks.length === 0) {
    return null;
  }

  if (visibleChecks.length === 0 && data.score < 100) {
    return (
      <div className="rounded-xl border bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold">Setup health</p>
          <p className={cn('text-sm font-bold tabular-nums', scoreTextClass(data.score))}>
            {data.score}/100
          </p>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', scoreBarClass(data.score))}
            style={{ width: `${data.score}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          All setup reminders dismissed — issues may still need attention.
        </p>
      </div>
    );
  }

  if (visibleChecks.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Setup health</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fix these to improve bookings and bot quality
          </p>
        </div>
        <p className={cn('text-lg font-bold tabular-nums', scoreTextClass(data.score))}>
          {data.score}/100
        </p>
      </div>

      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', scoreBarClass(data.score))}
          style={{ width: `${data.score}%` }}
          role="progressbar"
          aria-valuenow={data.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup health score"
        />
      </div>

      <ul className="space-y-2">
        {visibleChecks.map((check) => (
          <li
            key={check.id}
            className="flex items-start gap-2 rounded-lg border bg-background/80 px-3 py-2 text-sm"
          >
            <span className="shrink-0 mt-0.5" aria-hidden>
              ⚠
            </span>
            <div className="min-w-0 flex-1">
              <span>{check.label}</span>
              <span className="text-muted-foreground"> → </span>
              <Link
                href={check.fixHref}
                className="font-medium text-primary hover:underline underline-offset-2"
              >
                {check.fixLabel}
              </Link>
            </div>
            <button
              type="button"
              onClick={() => dismiss(check.id)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={`Dismiss ${check.label}`}
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
