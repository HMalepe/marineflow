'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, ChevronDown, ChevronRight, MessageSquare, User } from 'lucide-react';
import { OpenClientDashboardButton } from '@/components/open-client-dashboard-button';
import { ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { resolveApiUrl } from '@/lib/api-config';

interface InboxAlert {
  id: string;
  kind: 'OWNER_MESSAGE' | 'BOT_ERROR';
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  title: string;
  body: string;
  createdAt: string;
  business: {
    id: string;
    name: string;
    slug: string;
    industryTemplate: string;
    industryLabel: string;
    status: string;
  };
  from: { name: string; email: string } | null;
}

interface CategorySummary {
  industryTemplate: string;
  label: string;
  unreadCount: number;
  businesses: {
    id: string;
    name: string;
    slug: string;
    status: string;
    unreadCount: number;
    latestAt: string | null;
  }[];
}

async function adminFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(resolveApiUrl('admin', path, { forBrowser: true }), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export function AdminPlatformInbox({ token }: { token: string }) {
  const [summary, setSummary] = useState<{ categories: CategorySummary[]; totalUnread: number } | null>(null);
  const [alerts, setAlerts] = useState<InboxAlert[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const didExpandAll = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, alertsData] = await Promise.all([
        adminFetch<{ categories: CategorySummary[]; totalUnread: number }>(
          '/platform-inbox/summary',
          token,
        ),
        adminFetch<{ alerts: InboxAlert[] }>(
          `/platform-inbox?status=UNREAD&limit=30${selectedBusinessId ? `&salonId=${selectedBusinessId}` : ''}`,
          token,
        ),
      ]);
      setSummary(summaryData);
      setAlerts(alertsData.alerts);
      if (summaryData.categories.length > 0 && !didExpandAll.current) {
        didExpandAll.current = true;
        setExpandedCategories(new Set(summaryData.categories.map((c) => c.industryTemplate)));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [token, selectedBusinessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    try {
      await adminFetch(`/platform-inbox/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'READ' }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      void load();
    } catch {
      // non-critical
    }
  }

  function toggleCategory(id: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-primary/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Owner messages and bot errors — grouped by business category (spa, restaurant, salon, etc.).
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading && !summary && (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading inbox…</p>
        )}

        {summary && summary.categories.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Unread by category
            </p>
            {summary.categories.map((cat) => {
              const open = expandedCategories.has(cat.industryTemplate);
              return (
                <div key={cat.industryTemplate} className="rounded-lg border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.industryTemplate)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/40 hover:bg-muted/70 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      {cat.label}
                    </span>
                    <Badge variant="outline">{cat.unreadCount}</Badge>
                  </button>
                  {open && (
                    <div className="divide-y">
                      {cat.businesses.map((biz) => (
                        <div
                          key={biz.id}
                          className={cn(
                            'flex items-center justify-between gap-2 px-4 py-2 hover:bg-accent/50 transition-colors',
                            selectedBusinessId === biz.id && 'bg-primary/5',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedBusinessId(selectedBusinessId === biz.id ? null : biz.id)}
                            className="flex-1 min-w-0 text-left text-sm font-medium truncate"
                          >
                            {biz.name}
                          </button>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge>{biz.unreadCount}</Badge>
                            <OpenClientDashboardButton
                              businessId={biz.id}
                              businessName={biz.name}
                              variant="outline"
                              size="xs"
                              compact
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && alerts.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">
            No unread alerts{selectedBusinessId ? ' for this business' : ''}. Owner messages and bot errors will appear here.
          </p>
        )}

        {alerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {selectedBusinessId ? 'Alerts for selected business' : 'Latest unread'}
            </p>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'rounded-lg border p-3 space-y-2',
                  alert.status === 'UNREAD' && 'border-l-4 border-l-destructive bg-destructive/5',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {alert.kind === 'BOT_ERROR' ? (
                      <Bot className="size-4 shrink-0 text-destructive" />
                    ) : (
                      <User className="size-4 shrink-0 text-primary" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.business.name} · {alert.business.industryLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <OpenClientDashboardButton
                      businessId={alert.business.id}
                      businessName={alert.business.name}
                      variant="outline"
                      size="xs"
                      compact
                    />
                    <Badge variant="outline" className="text-[10px]">
                      {alert.kind === 'BOT_ERROR' ? 'Bot error' : 'Owner message'}
                    </Badge>
                    {alert.status === 'UNREAD' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void markRead(alert.id)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words text-foreground/90">{alert.body}</p>
                {alert.from && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="size-3" />
                    From {alert.from.name} ({alert.from.email})
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {new Date(alert.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {summary && summary.totalUnread === 0 && alerts.length === 0 && !loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-2">
            <AlertTriangle className="size-4" />
            All clear — no pending owner messages or bot errors.
          </div>
        )}
    </div>
  );
}
