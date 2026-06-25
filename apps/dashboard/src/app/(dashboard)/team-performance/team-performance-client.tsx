'use client';

import { useCallback, useEffect, useState } from 'react';
import { Crown, Medal, Star, TrendingUp } from 'lucide-react';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { cn } from '@/lib/utils';

interface LeaderboardEntry {
  rank: number;
  staffId: string;
  staffName: string;
  completed: number;
  revenueCents: number;
  noShows: number;
  avgRating: number | null;
  ratingCount: number;
  rebookingRate: number | null;
  incentiveCents: number;
  stars: number;
}

interface LeaderboardData {
  enabled: boolean;
  incentiveEnabled: boolean;
  incentivePercentPerCut: number;
  leaderboard: LeaderboardEntry[];
}

interface Props {
  token: string;
}

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn('size-3.5', i <= count ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
        />
      ))}
    </span>
  );
}

export function TeamPerformanceClient({ token }: Props) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<LeaderboardData>('/analytics/stylist-leaderboard', {}, token);
      setData(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const top = data?.leaderboard[0];

  return (
    <div className="dashboard-page-flow space-y-6">
      <DashboardPageHeader
        variant="fuchsia"
        title={
          <span className="flex items-center gap-2">
            <Crown className="size-7 text-amber-500" />
            Team Performance
          </span>
        }
        subtitle="Leaderboard, ratings, rebooking, and configurable incentives — gamified for your stylists."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading && (
        <div className="grid md:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          {top && (
            <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Medal className="size-5 text-amber-500" />
                  Top performer this month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{top.staffName}</p>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                  <span>{top.completed} completed</span>
                  <span>R{(top.revenueCents / 100).toFixed(0)} revenue</span>
                  {top.avgRating != null && (
                    <span className="flex items-center gap-1">
                      <Stars count={top.stars} /> {top.avgRating.toFixed(1)} ({top.ratingCount})
                    </span>
                  )}
                  {data.incentiveEnabled && top.incentiveCents > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Incentive: R{(top.incentiveCents / 100).toFixed(0)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium w-12">#</th>
                  <th className="p-3 font-medium">Stylist</th>
                  <th className="p-3 font-medium hidden sm:table-cell">{APPOINTMENTS_LABEL}</th>
                  <th className="p-3 font-medium">Revenue</th>
                  <th className="p-3 font-medium hidden md:table-cell">Rating</th>
                  <th className="p-3 font-medium hidden lg:table-cell">Rebook %</th>
                  {data.incentiveEnabled && (
                    <th className="p-3 font-medium">Incentive</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No performance data yet this month.
                    </td>
                  </tr>
                ) : (
                  data.leaderboard.map((row) => (
                    <tr key={row.staffId} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <span
                          className={cn(
                            'inline-flex size-7 items-center justify-center rounded-full text-xs font-bold',
                            row.rank === 1 && 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
                            row.rank === 2 && 'bg-slate-400/20',
                            row.rank === 3 && 'bg-orange-700/20',
                          )}
                        >
                          {row.rank}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{row.staffName}</td>
                      <td className="p-3 hidden sm:table-cell">{row.completed}</td>
                      <td className="p-3">R{(row.revenueCents / 100).toFixed(0)}</td>
                      <td className="p-3 hidden md:table-cell">
                        {row.avgRating != null ? (
                          <span className="flex items-center gap-1">
                            <Stars count={row.stars} />
                            {row.avgRating.toFixed(1)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        {row.rebookingRate != null ? `${row.rebookingRate}%` : '—'}
                      </td>
                      {data.incentiveEnabled && (
                        <td className="p-3 text-emerald-600 dark:text-emerald-400">
                          R{(row.incentiveCents / 100).toFixed(0)}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!data.enabled && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="size-3.5" />
              Enable stylist performance tracking in Power Features → Automations.
            </p>
          )}
        </>
      )}
    </div>
  );
}
