'use client';

import type React from 'react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { BusinessTypeBadge } from '@/components/BusinessTypeBreakdown';
import type { BusinessType } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { OnboardingPips, type OnboardingStatus, isOnboardingComplete } from '@/components/OnboardingPips';

export type TenantHealthStatus = 'HEALTHY' | 'AT_RISK' | 'CHURNING';

export type TenantHealthRow = {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  botName: string;
  industryTemplate: string;
  tenantStatus: string;
  tier: string;
  plan: string;
  lastBotActivity: string | null;
  appointmentsLast30d: number;
  customerCount: number;
  staffUserCount: number;
  healthStatus: TenantHealthStatus;
  onboarding: OnboardingStatus;
  onboardingComplete: boolean;
};

export type { OnboardingStatus };

type SortKey =
  | 'name'
  | 'businessType'
  | 'plan'
  | 'lastBotActivity'
  | 'appointmentsLast30d'
  | 'customerCount'
  | 'healthStatus'
  | 'onboardingComplete';

type SortDir = 'asc' | 'desc';

const HEALTH_CHIP: Record<TenantHealthStatus, string> = {
  HEALTHY: 'bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30',
  AT_RISK: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  CHURNING: 'bg-destructive/10 text-destructive border-destructive/30',
};

function formatLastActive(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function healthRank(status: TenantHealthStatus): number {
  if (status === 'CHURNING') return 0;
  if (status === 'AT_RISK') return 1;
  return 2;
}

function compareRows(a: TenantHealthRow, b: TenantHealthRow, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case 'name':
      cmp = a.name.localeCompare(b.name);
      break;
    case 'businessType':
      cmp = a.businessType.localeCompare(b.businessType);
      break;
    case 'plan':
      cmp = a.plan.localeCompare(b.plan);
      break;
    case 'lastBotActivity': {
      const ta = a.lastBotActivity ? new Date(a.lastBotActivity).getTime() : 0;
      const tb = b.lastBotActivity ? new Date(b.lastBotActivity).getTime() : 0;
      cmp = ta - tb;
      break;
    }
    case 'appointmentsLast30d':
      cmp = a.appointmentsLast30d - b.appointmentsLast30d;
      break;
    case 'customerCount':
      cmp = a.customerCount - b.customerCount;
      break;
    case 'healthStatus':
      cmp = healthRank(a.healthStatus) - healthRank(b.healthStatus);
      break;
    case 'onboardingComplete':
      cmp = Number(a.onboardingComplete) - Number(b.onboardingComplete);
      break;
  }
  return dir === 'asc' ? cmp : -cmp;
}

type Props = {
  tenants: TenantHealthRow[];
  loading?: boolean;
  healthFilter?: TenantHealthStatus | null;
  incompleteOnly?: boolean;
  actions?: (tenant: TenantHealthRow) => React.ReactNode;
};

export function TenantHealthTable({ tenants, loading, healthFilter, incompleteOnly, actions }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('healthStatus');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const filtered = useMemo(() => {
    let rows = tenants;
    if (healthFilter) rows = rows.filter((t) => t.healthStatus === healthFilter);
    if (incompleteOnly) rows = rows.filter((t) => !isOnboardingComplete(t.onboarding));
    return rows;
  }, [tenants, healthFilter, incompleteOnly]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  function SortableHead({
    label,
    column,
    className,
  }: {
    label: string;
    column: SortKey;
    className?: string;
  }) {
    const active = sortKey === column;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(column)}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {label}
          <Icon className={cn('size-3.5', active ? 'text-foreground' : 'text-muted-foreground/50')} />
        </button>
      </TableHead>
    );
  }

  const colSpan = actions ? 9 : 8;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Name" column="name" />
              <SortableHead label="Type" column="businessType" />
              <SortableHead label="Plan" column="plan" />
              <SortableHead label="Last active" column="lastBotActivity" />
              <SortableHead label="Appts (30d)" column="appointmentsLast30d" className="text-right" />
              <SortableHead label="Customers" column="customerCount" className="text-right" />
              <SortableHead label="Onboarding" column="onboardingComplete" />
              <SortableHead label="Health" column="healthStatus" />
              {actions && <TableHead className="text-right w-[220px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-10 text-muted-foreground">
                  Loading tenant health…
                </TableCell>
              </TableRow>
            )}
            {!loading && sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-10 text-muted-foreground">
                  {healthFilter
                    ? `No ${healthFilter.replace('_', ' ').toLowerCase()} tenants.`
                    : incompleteOnly
                      ? 'No incomplete onboarding tenants.'
                      : 'No businesses found.'}
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              sorted.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div>
                      <Link
                        href={`/admin/businesses/${t.id}`}
                        className="font-medium hover:text-primary hover:underline underline-offset-2"
                      >
                        {t.name}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono">{t.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <BusinessTypeBadge type={t.businessType} short />
                  </TableCell>
                  <TableCell className="text-sm">{t.plan}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLastActive(t.lastBotActivity)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.appointmentsLast30d}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.customerCount}</TableCell>
                  <TableCell>
                    <OnboardingPips status={t.onboarding} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] font-medium border', HEALTH_CHIP[t.healthStatus])}
                    >
                      {t.healthStatus.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  {actions && <TableCell className="text-right">{actions(t)}</TableCell>}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
