'use client';

import { cn } from '@/lib/utils';

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

export function MiniBarChart({ title = "Today's revenue — last 7 days", data, className }: Props) {
  const max = Math.max(...data.map((d) => d.revenueCents), 1);
  const chartH = 88;
  const barGap = 6;
  const barW = 28;
  const width = data.length * (barW + barGap) + barGap;

  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm', className)}>
      <p className="text-sm font-semibold mb-3">{title}</p>
      <svg
        viewBox={`0 0 ${width} ${chartH + 36}`}
        className="w-full max-w-md h-auto text-primary"
        role="img"
        aria-label="Revenue bar chart for the last seven days"
      >
        {data.map((point, i) => {
          const h = Math.max(4, (point.revenueCents / max) * chartH);
          const x = barGap + i * (barW + barGap);
          const y = chartH - h;
          const isToday = i === data.length - 1;
          return (
            <g key={point.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                className={cn('fill-primary/80', isToday && 'fill-primary')}
              />
              <text
                x={x + barW / 2}
                y={chartH + 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {formatDayLabel(point.date)}
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
