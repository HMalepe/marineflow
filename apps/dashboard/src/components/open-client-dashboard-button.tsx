'use client';

import { useState, useTransition } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { openClientDashboard } from '@/app/(dashboard)/admin/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  businessId: string;
  businessName?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'xs' | 'lg' | 'icon' | 'icon-sm';
  className?: string;
  /** Shorter label for tight table rows */
  compact?: boolean;
  onError?: (message: string) => void;
};

export function OpenClientDashboardButton({
  businessId,
  businessName,
  variant = 'default',
  size = 'sm',
  className,
  compact = false,
  onError,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLocalError(null);
    startTransition(async () => {
      const result = await openClientDashboard(businessId);
      if (result?.error) {
        setLocalError(result.error);
        onError?.(result.error);
      }
    });
  }

  const label = compact ? 'Dashboard' : 'Open dashboard';
  const title = businessName
    ? `Open ${businessName}'s WhatsApp bot dashboard`
    : 'Open client dashboard';

  return (
    <span className={cn('inline-flex flex-col items-start', className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        title={title}
        onClick={handleClick}
        className="gap-1.5"
      >
        <LayoutDashboard className={cn(size === 'xs' || size === 'sm' ? 'size-3.5' : 'size-4')} />
        {pending ? 'Opening…' : label}
      </Button>
      {localError && (
        <span className="text-[10px] text-destructive mt-0.5 max-w-[140px] leading-tight">{localError}</span>
      )}
    </span>
  );
}
