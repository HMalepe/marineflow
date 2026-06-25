import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function OverviewSectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300',
        'pb-1 border-b-2 border-violet-500/45 inline-block min-w-[4rem]',
        className,
      )}
    >
      {children}
    </p>
  );
}
