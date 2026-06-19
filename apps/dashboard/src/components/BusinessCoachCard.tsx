'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Loader2, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type CoachActionType =
  | 'draft_campaign'
  | 'open_roster'
  | 'open_services'
  | 'open_appointments'
  | 'open_customers';

interface CoachInsight {
  id: string;
  headline: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel: string;
  action: {
    type: CoachActionType;
    payload?: Record<string, unknown>;
  };
}

interface CoachResponse {
  generatedAt: string;
  insights: CoachInsight[];
  aiPowered: boolean;
  cached: boolean;
}

interface Props {
  token: string;
}

const PRIORITY_STYLES = {
  high: 'border-l-orange-500 bg-orange-500/[0.04]',
  medium: 'border-l-blue-500 bg-blue-500/[0.04]',
  low: 'border-l-muted-foreground/40',
};

export function BusinessCoachCard({ token }: Props) {
  const router = useRouter();
  const [data, setData] = useState<CoachResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!token) return;
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<CoachResponse>(
          `/tenant/business-coach${force ? '?refresh=1' : ''}`,
          {},
          token,
        );
        setData(res);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load coach insights');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const executeAction = async (insight: CoachInsight) => {
    setActingId(insight.id);
    try {
      const { type, payload } = insight.action;
      if (type === 'draft_campaign' && payload) {
        await apiFetch(
          '/campaigns',
          {
            method: 'POST',
            body: JSON.stringify({
              name: payload.name,
              message: payload.message,
              audienceFilter: payload.audienceFilter ?? { type: 'all' },
            }),
          },
          token,
        );
        router.push('/campaigns');
        return;
      }
      if (type === 'open_roster') {
        router.push('/roster');
        return;
      }
      if (type === 'open_services') {
        router.push('/services');
        return;
      }
      if (type === 'open_appointments') {
        router.push('/appointments');
        return;
      }
      if (type === 'open_customers') {
        router.push('/customers');
        return;
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  return (
    <Card className="overflow-hidden border-violet-500/25 bg-gradient-to-br from-violet-500/[0.06] via-background to-amber-500/[0.04]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <Brain className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                AI Business Coach
                {data?.aiPowered && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-normal text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                    <Sparkles className="size-3" />
                    Claude
                  </span>
                )}
              </CardTitle>
              <CardDescription className="mt-0.5">
                Proactive recommendations from your bookings, revenue, and customer data — not another report.
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 size-8"
            onClick={() => void load(true)}
            disabled={refreshing}
            title="Refresh insights"
          >
            <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !data?.insights.length ? (
          <p className="text-sm text-muted-foreground">No insights right now — check back after more booking activity.</p>
        ) : (
          data.insights.map((insight) => (
            <div
              key={insight.id}
              className={cn(
                'rounded-xl border border-l-4 p-4 flex flex-col sm:flex-row sm:items-center gap-3',
                PRIORITY_STYLES[insight.priority],
              )}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-semibold text-sm leading-snug">{insight.headline}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{insight.body}</p>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
                disabled={actingId === insight.id}
                onClick={() => void executeAction(insight)}
              >
                {actingId === insight.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Zap className="size-3.5" />
                )}
                {insight.actionLabel}
              </Button>
            </div>
          ))
        )}
        {data?.cached && !loading && (
          <p className="text-[11px] text-muted-foreground text-right">Today&apos;s insights · refreshes once daily</p>
        )}
      </CardContent>
    </Card>
  );
}
