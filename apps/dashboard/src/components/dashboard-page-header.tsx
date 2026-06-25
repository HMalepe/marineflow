import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  dashboardNeonBox,
  type OverviewNeonVariant,
} from '@/components/overview/overviewNeon';

type Props = {
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  variant?: OverviewNeonVariant;
  className?: string;
  /** Trailing actions (buttons, links) */
  actions?: ReactNode;
  children?: ReactNode;
  sectionLabel?: string;
};

export function DashboardPageHeader({
  id,
  title,
  subtitle,
  variant = 'violet',
  className,
  actions,
  children,
  sectionLabel = 'Summary',
}: Props) {
  return (
    <div
      id={id}
      data-section-label={sectionLabel}
      className={cn(
        'dashboard-section-anchor dashboard-neon-block',
        dashboardNeonBox(variant, 'dashboard-page-header p-4 sm:p-5'),
        className,
      )}
    >
      <div
        className={cn(
          actions ? 'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3' : undefined,
        )}
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle != null && subtitle !== '' && (
            <div className="text-muted-foreground text-sm mt-1.5 font-medium">{subtitle}</div>
          )}
        </div>
        {actions && <div className="shrink-0 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
