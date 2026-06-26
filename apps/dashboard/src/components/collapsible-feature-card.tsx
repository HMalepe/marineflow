'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CollapsibleFeatureCardProps {
  id?: string;
  icon?: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

/** Feature card (automations, power features) with collapsible header. */
export function CollapsibleFeatureCard({
  id,
  icon: Icon,
  title,
  description,
  children,
  className,
  defaultOpen = true,
}: CollapsibleFeatureCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card
      id={id}
      data-section-label={title}
      className={cn('dashboard-section-anchor', className)}
    >
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-start justify-between gap-3 text-left touch-manipulation"
          aria-expanded={open}
          aria-controls={id ? `${id}-panel` : undefined}
        >
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {Icon && <Icon className="size-4" />}
              {title}
            </CardTitle>
            {description && (
              <CardDescription className={cn(!open && 'hidden')}>{description}</CardDescription>
            )}
          </div>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 mt-1 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </CardHeader>
      <CardContent id={id ? `${id}-panel` : undefined} className={cn(!open && 'hidden')}>
        {children}
      </CardContent>
    </Card>
  );
}
