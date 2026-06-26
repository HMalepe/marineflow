'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  GitMerge,
  Loader2,
  Megaphone,
  Search,
  Users,
  XCircle,
} from 'lucide-react';
import {
  CustomerCard,
  CustomerDuplicateRow,
  type CustomerListItem,
  type CustomerStatsView,
} from '@/components/CustomerCard';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CUSTOMERS_LABEL } from '@/lib/dashboard-nav';
import { CollapsibleSection } from '@/components/collapsible-section';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { DashboardToast } from '@/components/dashboard-toast';

interface Customer extends CustomerListItem {
  noShowRisk: string;
  noShowCount: number;
}

interface CustomerGroup {
  primary: Customer;
  duplicates: Customer[];
}

type SegmentFilter = 'all' | 'new' | 'at_risk' | 'champions' | 'vip';

interface SegmentCounts {
  all: number;
  new: number;
  at_risk: number;
  champions: number;
  vip: number;
}

interface Props {
  token: string;
}

const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-sky-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-indigo-500',
];

const SEGMENT_PILLS: { key: SegmentFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'at_risk', label: 'At Risk' },
  { key: 'champions', label: 'Champions' },
  { key: 'vip', label: 'VIP' },
];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

function avatarColor(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function displayName(c: Customer): string {
  if (c.displayName) return c.displayName;
  const first = c.firstName?.trim();
  const last = c.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  if (c.waId) return formatPhone(c.waId);
  return 'Unknown customer';
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase() || '?';
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/^\+/, '');
  if (digits.startsWith('27') && digits.length === 11) {
    return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return raw.startsWith('+') ? raw : `+${raw}`;
}

function normalizePhone(waId: string | null): string | null {
  if (!waId) return null;
  return waId.replace(/^\+/, '');
}

function betterRecord(a: Customer, b: Customer): Customer {
  const score = (c: Customer) =>
    (c.displayName ? 10 : 0) +
    (c.firstName ? 5 : 0) +
    (c.lastName ? 5 : 0) +
    (c.email ? 3 : 0) +
    c.bookingCount;
  return score(a) >= score(b) ? a : b;
}

function groupByPhone(customers: Customer[]): CustomerGroup[] {
  const map = new Map<string, Customer[]>();
  for (const c of customers) {
    const key = normalizePhone(c.waId) ?? `id:${c.id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }

  const groups: CustomerGroup[] = [];
  for (const members of map.values()) {
    const primary = members.reduce((best, c) => betterRecord(best, c));
    const duplicates = members.filter((m) => m.id !== primary.id);
    groups.push({ primary, duplicates });
  }

  groups.sort((a, b) => new Date(b.primary.createdAt).getTime() - new Date(a.primary.createdAt).getTime());
  return groups;
}

function matchesSegment(
  customer: Customer,
  stats: CustomerStatsView | undefined,
  segment: SegmentFilter,
): boolean {
  if (segment === 'all') return true;

  const createdMs = new Date(customer.createdAt).getTime();
  const now = Date.now();

  if (segment === 'new') return createdMs >= now - THIRTY_DAYS_MS;

  if (segment === 'vip') {
    return customer.tags.some((t) => t.toLowerCase() === 'vip');
  }

  if (segment === 'champions') {
    return stats?.ltvBadge === 'champion';
  }

  if (segment === 'at_risk') {
    if (stats?.ltvBadge === 'at_risk') return true;
    if ((stats?.visitCount ?? 0) === 0 && createdMs < now - SIXTY_DAYS_MS) return true;
    if (stats?.lastVisitAt && new Date(stats.lastVisitAt).getTime() < now - SIXTY_DAYS_MS) {
      return true;
    }
    return false;
  }

  return true;
}

export function CustomersClient({ token }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerStats, setCustomerStats] = useState<Record<string, CustomerStatsView>>({});
  const [segmentCounts, setSegmentCounts] = useState<SegmentCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all');
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [campaignCreating, setCampaignCreating] = useState(false);
  const [mergeConfirm, setMergeConfirm] = useState<{
    primaryId: string;
    dupId: string;
    primaryName: string;
    dupName: string;
    dupBookings: number;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const loadSegments = useCallback(async () => {
    try {
      const res = await apiFetch<{ segments: SegmentCounts }>('/customers/segments', {}, token);
      setSegmentCounts(res.segments);
    } catch {
      setSegmentCounts(null);
    }
  }, [token]);

  const loadStats = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        setCustomerStats({});
        setStatsLoading(false);
        return;
      }
      setStatsLoading(true);
      try {
        const res = await apiFetch<{ stats: Record<string, CustomerStatsView> }>(
          '/customers/stats-batch',
          { method: 'POST', body: JSON.stringify({ ids }) },
          token,
        );
        setCustomerStats(res.stats ?? {});
      } catch {
        setCustomerStats({});
      } finally {
        setStatsLoading(false);
      }
    },
    [token],
  );

  const load = useCallback(
    async (q = '') => {
      setLoading(true);
      try {
        if (q.length >= 2) {
          const res = await apiFetch<{ results: Customer[] }>(
            `/customers/search?q=${encodeURIComponent(q)}`,
            {},
            token,
          );
          const list = res.results ?? [];
          setCustomers(list);
          void loadStats(list.map((c) => c.id));
        } else {
          const res = await apiFetch<{ customers: Customer[] }>('/customers?limit=200', {}, token);
          const list = res.customers ?? [];
          setCustomers(list);
          void loadStats(list.map((c) => c.id));
        }
      } catch (e) {
        showToast(e instanceof ApiError ? e.message : 'Could not load customers', 'error');
      } finally {
        setLoading(false);
      }
    },
    [token, loadStats],
  );

  useEffect(() => {
    void load();
    void loadSegments();
  }, [load, loadSegments]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => void load(value), 300);
  };

  const confirmMerge = (
    primaryId: string,
    dupId: string,
    primaryName: string,
    dupName: string,
    dupBookings: number,
  ) => {
    setMergeConfirm({ primaryId, dupId, primaryName, dupName, dupBookings });
  };

  const handleMerge = async () => {
    if (!mergeConfirm) return;
    const { primaryId, dupId } = mergeConfirm;
    setMergeConfirm(null);
    setMergingId(dupId);
    try {
      await apiFetch(
        `/customers/${primaryId}/merge`,
        {
          method: 'POST',
          body: JSON.stringify({ secondaryId: dupId }),
        },
        token,
      );
      showToast('Profiles combined successfully', 'success');
      await load(search);
      await loadSegments();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Merge failed', 'error');
    } finally {
      setMergingId(null);
    }
  };

  const createReengagementCampaign = async () => {
    setCampaignCreating(true);
    try {
      await apiFetch(
        '/campaigns',
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Re-engagement — at-risk customers',
            message:
              'Hi! We miss you — it has been a while since your last visit. Reply BOOK to schedule your next appointment.',
            audienceFilter: { type: 'inactive', inactiveDays: 60 },
          }),
        },
        token,
      );
      showToast('Campaign draft saved — finish and send from Newsletters', 'success');
      router.push('/campaigns');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not create campaign draft', 'error');
    } finally {
      setCampaignCreating(false);
    }
  };

  const allGroups = useMemo(() => groupByPhone(customers), [customers]);

  const groups = useMemo(
    () =>
      allGroups.filter((g) =>
        matchesSegment(g.primary, customerStats[g.primary.id], segmentFilter),
      ),
    [allGroups, customerStats, segmentFilter],
  );

  const duplicateCount = useMemo(
    () => groups.filter((g) => g.duplicates.length > 0).length,
    [groups],
  );

  return (
    <div className="dashboard-page-flow space-y-6 max-w-4xl">
      <DashboardPageHeader
        title={CUSTOMERS_LABEL}
        variant="fuchsia"
        subtitle={
          loading ? (
            '—'
          ) : (
            <>
              {`${groups.length} customer${groups.length === 1 ? '' : 's'}`}
              {!loading && duplicateCount > 0 && (
                <span className="ml-2 text-amber-600 font-semibold">
                  · {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'} found
                </span>
              )}
            </>
          )
        }
        actions={
          <>
            <div className="relative flex-1 sm:w-72 min-w-[12rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Name, email, or phone…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
              {loading && search && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(search)}
              disabled={loading}
              className="shrink-0"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Refresh'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                const a = document.createElement('a');
                a.href = `/api/proxy/customers/export-csv`;
                a.download = 'customers.csv';
                a.click();
              }}
              title="Download all customers as CSV"
            >
              Export CSV
            </Button>
          </>
        }
      />

      <CollapsibleSection id="customers-segments" title="Segment filters" defaultOpen>
      <div className="flex flex-wrap items-center gap-2">
        {SEGMENT_PILLS.map(({ key, label }) => (
          <Button
            key={key}
            variant={segmentFilter === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSegmentFilter(key)}
            className="gap-1.5 h-8"
          >
            {label}
            {segmentCounts != null && (
              <span
                className={cn(
                  'tabular-nums text-[10px] rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center',
                  segmentFilter === key ? 'bg-primary-foreground/20' : 'bg-muted',
                )}
              >
                {segmentCounts[key]}
              </span>
            )}
          </Button>
        ))}
      </div>
      </CollapsibleSection>

      {segmentFilter === 'at_risk' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-3">
          <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">
            Reach customers who haven&apos;t visited in 60+ days with a re-engagement newsletter.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-orange-500/40 shrink-0"
            disabled={campaignCreating}
            onClick={() => void createReengagementCampaign()}
          >
            {campaignCreating ? (
              <Loader2 className="size-4 animate-spin mr-1.5" />
            ) : (
              <Megaphone className="size-4 mr-1.5" />
            )}
            Send re-engagement campaign
          </Button>
        </div>
      )}

      {!loading && duplicateCount > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.07] to-transparent px-4 py-3.5 flex gap-3 items-start">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <GitMerge className="size-4 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="text-sm space-y-1">
            <p className="font-medium text-foreground">
              {duplicateCount} phone number{duplicateCount === 1 ? '' : 's'} have more than one profile
            </p>
            <p className="text-muted-foreground leading-relaxed">
              This usually happens when WhatsApp saved the number with and without a{' '}
              <span className="font-mono text-xs">+</span>. Combine extras into the main profile
              below — nothing is deleted except the duplicate entry.
            </p>
          </div>
        </div>
      )}

      <CollapsibleSection
        id="customers-directory"
        title="Customer directory"
        count={groups.length}
        subtitle={search ? `Showing results for “${search}”` : undefined}
        defaultOpen
      >
      {loading && customers.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[76px] rounded-xl bg-muted animate-pulse ring-1 ring-border/50" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-4">
            <Users className="size-7 text-muted-foreground" />
          </div>
          <p className="font-medium">
            {search || segmentFilter !== 'all' ? 'No customers found' : 'No customers yet'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search
              ? 'Try a different name, email, or phone number.'
              : segmentFilter !== 'all'
                ? 'Try another segment filter.'
                : 'Customers appear here once they message your WhatsApp number.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(({ primary, duplicates }) => {
            const name = displayName(primary);
            const color = avatarColor(normalizePhone(primary.waId) ?? primary.id);
            const hasDupes = duplicates.length > 0;

            return (
              <CustomerCard
                key={primary.id}
                customer={primary}
                stats={customerStats[primary.id] ?? null}
                statsLoading={statsLoading}
                displayName={name}
                avatarColor={color}
                avatarInitials={initials(name)}
                formatPhone={formatPhone}
                hasDuplicates={hasDupes}
                duplicateCount={duplicates.length + 1}
                duplicateRow={
                  hasDupes
                    ? duplicates.map((dup) => (
                        <CustomerDuplicateRow
                          key={dup.id}
                          dupName={displayName(dup)}
                          waId={dup.waId}
                          bookingCount={dup.bookingCount}
                          createdAt={dup.createdAt}
                          primaryName={name}
                          formatPhone={formatPhone}
                          merging={mergingId === dup.id}
                          onMerge={() =>
                            confirmMerge(
                              primary.id,
                              dup.id,
                              displayName(primary),
                              displayName(dup),
                              dup.bookingCount,
                            )
                          }
                        />
                      ))
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
      </CollapsibleSection>

      {mergeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 shrink-0">
                <GitMerge className="size-5 text-amber-700 dark:text-amber-300" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Combine duplicate profiles?</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  One customer, one history. The extra profile is removed after its data is moved
                  over.
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4 text-sm space-y-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  Keeping
                </p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  <span className="font-semibold">{mergeConfirm.primaryName}</span>
                </div>
              </div>
              <div className="border-t border-border/60 pt-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  Removing
                </p>
                <div className="flex items-center gap-2">
                  <XCircle className="size-4 text-muted-foreground shrink-0" />
                  <span>{mergeConfirm.dupName}</span>
                </div>
              </div>
            </div>

            <ul className="text-xs text-muted-foreground space-y-1.5 px-1">
              <li>WhatsApp chat history is merged into one thread</li>
              <li>
                {mergeConfirm.dupBookings > 0
                  ? `${mergeConfirm.dupBookings} booking${mergeConfirm.dupBookings === 1 ? '' : 's'} transfer to the kept profile`
                  : 'Bookings and loyalty stay on the kept profile'}
              </li>
              <li>This cannot be undone</li>
            </ul>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setMergeConfirm(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => void handleMerge()}
              >
                <GitMerge className="size-4 mr-1.5" />
                Combine profiles
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && <DashboardToast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
