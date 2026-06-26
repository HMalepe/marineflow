'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
  id?: string;
  title: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  titleClassName?: string;
}

/** Settings-style card with a collapsible header toggle. */
export function CollapsibleCard({
  id,
  title,
  description,
  children,
  className,
  defaultOpen = true,
  titleClassName,
}: CollapsibleCardProps) {
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
            <CardTitle className={titleClassName}>{title}</CardTitle>
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
