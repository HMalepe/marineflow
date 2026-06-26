'use client';

import { cn } from '@/lib/utils';
import { OverviewCollapsibleSection } from '@/components/overview/OverviewCollapsibleSection';
import { overviewNeonBox } from '@/components/overview/overviewNeon';

export type BarChartPoint = {
  date: string;
  revenueCents: number;
};

function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString('en-ZA', { weekday: 'short' });
}

function formatZarShort(cents: number): string {
  if (cents >= 100000) return `R ${Math.round(cents / 100).toLocaleString('en-ZA')}`;
  return `R ${(cents / 100).toFixed(0)}`;
}

type Props = {
  title?: string;
  data: BarChartPoint[];
  className?: string;
};

export function MiniBarChart({ title = 'Revenue — last 7 days', data, className }: Props) {
  const points = Array.isArray(data) ? data : [];
  if (points.length === 0) return null;

  const max = Math.max(...points.map((d) => d.revenueCents), 1);
  const total = points.reduce((sum, p) => sum + p.revenueCents, 0);
  const avg = Math.round(total / points.length);
  const chartH = 100;
  const barGap = 8;
  const barW = 32;
  const width = points.length * (barW + barGap) + barGap;

  return (
    <OverviewCollapsibleSection
      id="overview-revenue"
      label="Trends"
      title={title}
      className={className}
      trailing={
        <span className="text-xs font-bold text-muted-foreground tabular-nums shrink-0 px-2.5 py-1 rounded-md border-2 border-violet-500/30 bg-violet-500/10">
          7-day avg {formatZarShort(avg)}
        </span>
      }
    >
      <div className={overviewNeonBox('cyan', 'p-4 sm:p-5')}>
        <svg
          viewBox={`0 0 ${width} ${chartH + 40}`}
          className="w-full h-auto"
          role="img"
          aria-label="Revenue bar chart for the last seven days"
        >
          <defs>
            <linearGradient id="overview-bar-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.95" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="overview-bar-today" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(262 83% 58%)" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(292 84% 61%)" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          {points.map((point, i) => {
            const h = Math.max(6, (point.revenueCents / max) * chartH);
            const x = barGap + i * (barW + barGap);
            const y = chartH - h;
            const isToday = i === points.length - 1;
            return (
              <g key={point.date}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={6}
                  fill={isToday ? 'url(#overview-bar-today)' : 'url(#overview-bar-fill)'}
                />
                <text
                  x={x + barW / 2}
                  y={chartH + 16}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {formatDayLabel(point.date)}
                </text>
                {point.revenueCents > 0 && (
                  <text
                    x={x + barW / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className="fill-foreground text-[9px] font-medium"
                  >
                    {formatZarShort(point.revenueCents)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </OverviewCollapsibleSection>
  );
}

export type MonthlyBarChartPoint = {
  month: string;
  revenueCents: number;
};

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString('en-ZA', { month: 'short' });
}

type MonthlyProps = {
  title?: string;
  data: MonthlyBarChartPoint[];
  className?: string;
};

export function MonthlyRevenueBarChart({
  title = 'Payment volume — last 6 months',
  data,
  className,
}: MonthlyProps) {
  const max = Math.max(...data.map((d) => d.revenueCents), 1);
  const chartH = 88;
  const barGap = 8;
  const barW = 36;
  const width = data.length * (barW + barGap) + barGap;

  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm', className)}>
      <p className="text-sm font-semibold mb-3">{title}</p>
      <svg
        viewBox={`0 0 ${width} ${chartH + 36}`}
        className="w-full h-auto text-primary"
        role="img"
        aria-label="Revenue bar chart for the last six months"
      >
        {data.map((point, i) => {
          const h = Math.max(4, (point.revenueCents / max) * chartH);
          const x = barGap + i * (barW + barGap);
          const y = chartH - h;
          const isLatest = i === data.length - 1;
          return (
            <g key={point.month}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                className={cn('fill-primary/80', isLatest && 'fill-primary')}
              />
              <text
                x={x + barW / 2}
                y={chartH + 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {formatMonthLabel(point.month)}
              </text>
              {point.revenueCents > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-foreground text-[8px] font-medium"
                >
                  {formatZarShort(point.revenueCents)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
