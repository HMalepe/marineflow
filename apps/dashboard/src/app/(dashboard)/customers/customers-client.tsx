'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  GitMerge,
  Loader2,
  Search,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DashboardToast } from '@/components/dashboard-toast';

interface Customer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  waId: string | null;
  marketingConsentStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  noShowRisk: string;
  bookingCount: number;
  noShowCount: number;
  tags: string[];
  createdAt: string;
}

interface CustomerGroup {
  primary: Customer;
  duplicates: Customer[];
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
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
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

function consentDot(status: Customer['marketingConsentStatus']) {
  if (status === 'ACCEPTED') return <span className="size-2 rounded-full bg-green-500 shrink-0" title="Marketing accepted" />;
  if (status === 'DECLINED') return <span className="size-2 rounded-full bg-slate-400 shrink-0" title="Marketing declined" />;
  return <span className="size-2 rounded-full bg-amber-400 shrink-0" title="Awaiting POPIA consent" />;
}

export function CustomersClient({ token }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

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
          setCustomers(res.results ?? []);
        } else {
          const res = await apiFetch<{ customers: Customer[] }>('/customers?limit=200', {}, token);
          setCustomers(res.customers ?? []);
        }
      } catch (e) {
        showToast(e instanceof ApiError ? e.message : 'Could not load customers', 'error');
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => void load(value), 300);
  };

  const handleMerge = async (primaryId: string, secondaryId: string) => {
    setMergingId(secondaryId);
    try {
      await apiFetch(`/customers/${primaryId}/merge`, {
        method: 'POST',
        body: JSON.stringify({ secondaryId }),
      }, token);
      showToast('Records merged successfully', 'success');
      await load(search);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Merge failed', 'error');
    } finally {
      setMergingId(null);
    }
  };

  const groups = useMemo(() => groupByPhone(customers), [customers]);
  const duplicateCount = useMemo(() => groups.filter((g) => g.duplicates.length > 0).length, [groups]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading ? '—' : `${groups.length} customer${groups.length === 1 ? '' : 's'}`}
            {!loading && duplicateCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                · {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'} found
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
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
        </div>
      </div>

      {/* Duplicate consolidation banner */}
      {!loading && duplicateCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex gap-3 items-start">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-medium text-amber-800 dark:text-amber-300">
              {duplicateCount} phone number{duplicateCount === 1 ? '' : 's'} matched to multiple records.
            </span>{' '}
            <span className="text-muted-foreground">
              Use the Merge button on each duplicate pair to consolidate history into one profile.
            </span>
          </div>
        </div>
      )}

      {/* Customer list */}
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
          <p className="font-medium">{search ? 'No customers found' : 'No customers yet'}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? 'Try a different name, email, or phone number.' : 'Customers appear here once they message your WhatsApp number.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(({ primary, duplicates }) => {
            const name = displayName(primary);
            const color = avatarColor(normalizePhone(primary.waId) ?? primary.id);
            const hasDupes = duplicates.length > 0;

            return (
              <div
                key={primary.id}
                className={cn(
                  'rounded-xl border bg-card transition-shadow',
                  hasDupes && 'ring-2 ring-amber-400/40 border-amber-400/30',
                )}
              >
                {/* Primary row */}
                <Link
                  href={`/customers/${primary.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors rounded-xl group"
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold ring-2 ring-white/20',
                      color,
                      hasDupes && 'ring-amber-400',
                    )}
                  >
                    {initials(name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{name}</span>
                      {hasDupes && (
                        <Badge variant="outline" className="text-[10px] border-amber-400/50 text-amber-700 dark:text-amber-300 gap-1 shrink-0">
                          <AlertTriangle className="size-2.5" />
                          {duplicates.length + 1} records
                        </Badge>
                      )}
                      {primary.tags?.slice(0, 2).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px] font-normal shrink-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {consentDot(primary.marketingConsentStatus)}
                      {primary.waId && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatPhone(primary.waId)}
                        </span>
                      )}
                      {primary.email && (
                        <span className="text-xs text-muted-foreground truncate">{primary.email}</span>
                      )}
                      {primary.bookingCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {primary.bookingCount} booking{primary.bookingCount === 1 ? '' : 's'}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Since {new Date(primary.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="size-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                {/* Duplicate sub-rows */}
                {duplicates.map((dup) => {
                  const dupName = displayName(dup);
                  const isMerging = mergingId === dup.id;
                  return (
                    <div
                      key={dup.id}
                      className="flex items-center gap-4 px-4 pb-3 pt-0 border-t border-amber-400/20"
                    >
                      <div className="size-11 shrink-0 flex items-center justify-center">
                        <div className="size-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                          <GitMerge className="size-3.5 text-amber-600 dark:text-amber-400" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">{dupName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {dup.waId && (
                            <span className="font-mono text-[11px] text-muted-foreground/70">{formatPhone(dup.waId)}</span>
                          )}
                          <span className="text-[11px] text-muted-foreground/70">
                            · {dup.bookingCount} booking{dup.bookingCount === 1 ? '' : 's'}
                          </span>
                          <span className="text-[11px] text-muted-foreground/70">
                            · since {new Date(dup.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-amber-400/50 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20 gap-1.5 text-xs h-7"
                        onClick={() => void handleMerge(primary.id, dup.id)}
                        disabled={isMerging}
                      >
                        {isMerging ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <GitMerge className="size-3" />
                        )}
                        {isMerging ? 'Merging…' : 'Merge into above'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {toast && <DashboardToast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
