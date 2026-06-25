import type React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: string | number;
  href?: string;
  className?: string;
  badge?: React.ReactNode;
};

export function StatCard({ label, value, href, className, badge }: Props) {
  const inner = (
    <>
      {badge}
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
    </>
  );

  const classes = cn(
    'stat-card-premium dashboard-kpi-tile relative rounded-xl p-4',
    href && 'hover:border-primary/40 block',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }

  return <div className={classes}>{inner}</div>;
}
