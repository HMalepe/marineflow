'use client';

import { DashboardErrorDetails } from '@/components/dashboard-error-details';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-4 p-8 flex flex-col items-center max-w-3xl w-full">
          <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
          <DashboardErrorDetails error={error} hint="A critical error occurred. Please refresh the page." />
          <button
            onClick={reset}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
