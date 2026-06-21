'use client';

import { Button } from '@/components/ui/button';
import { DashboardErrorDetails } from '@/components/dashboard-error-details';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4 px-4">
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <DashboardErrorDetails error={error} />
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
