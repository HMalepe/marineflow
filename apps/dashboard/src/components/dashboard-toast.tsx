'use client';

import { cn } from '@/lib/utils';
import { formatSaveSuccess } from '@/components/save-feedback';

/** Bottom-right toast — success messages always show the green ✓ pattern. */
export function DashboardToast({
  message,
  type,
  onDismiss,
  className,
}: {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
  className?: string;
}) {
  const display = type === 'success' ? formatSaveSuccess(message) : message;

  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg max-w-sm animate-in slide-in-from-bottom-4',
        type === 'success'
          ? 'bg-card border-green-600/30 text-green-700 dark:text-green-400'
          : 'bg-destructive/10 border-destructive/40 text-destructive',
        className,
      )}
    >
      <span className="flex-1">{display}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs opacity-70 hover:opacity-100 ml-1 shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
