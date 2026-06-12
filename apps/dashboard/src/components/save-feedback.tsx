'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Standard green save confirmation — matches Settings profile feedback. */
export function formatSaveSuccess(message: string): string {
  const trimmed = message.trim().replace(/\s*✓\s*$/, '');
  if (!trimmed) return '';
  return `${trimmed} ✓`;
}

export function SaveSuccessFeedback({
  message,
  className,
}: {
  message: string | null | undefined;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p role="status" aria-live="polite" className={cn('text-sm text-green-600 dark:text-green-400', className)}>
      {formatSaveSuccess(message)}
    </p>
  );
}

export function SaveErrorFeedback({
  message,
  className,
}: {
  message: string | null | undefined;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p role="alert" className={cn('text-sm text-destructive', className)}>
      {message}
    </p>
  );
}

export function SaveFormFooter({
  success,
  error,
  children,
  className,
}: {
  success?: string | null;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <SaveSuccessFeedback message={success} />
      <SaveErrorFeedback message={error} />
      {children}
    </div>
  );
}

export type SectionFeedback = { success?: string; error?: string };

export function SectionSaveFeedback({
  feedback,
  className,
}: {
  feedback?: SectionFeedback;
  className?: string;
}) {
  if (!feedback?.success && !feedback?.error) return null;
  return (
    <div className={cn('space-y-1', className)}>
      <SaveSuccessFeedback message={feedback.success} />
      <SaveErrorFeedback message={feedback.error} />
    </div>
  );
}
