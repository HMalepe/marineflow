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
    'relative rounded-lg border bg-card p-4 shadow-sm',
    href && 'hover:border-primary/40 hover:shadow-md transition-all',
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
