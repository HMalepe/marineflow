import { Suspense } from 'react';
import { getToken, getUser } from '@/lib/auth';
import { AnalyticsClient } from './analytics-client';

function AnalyticsFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 h-20 bg-muted/20" />
        ))}
      </div>
    </div>
  );
}

async function AnalyticsPageInner({
  searchParams,
}: {
  searchParams: Promise<{ business?: string }>;
}) {
  const token = await getToken();
  const user = await getUser();
  const { business } = await searchParams;
  const isAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <AnalyticsClient
      token={token ?? ''}
      isAdmin={isAdmin}
      initialBusinessId={business ?? ''}
    />
  );
}

export default function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string }>;
}) {
  return (
    <Suspense fallback={<AnalyticsFallback />}>
      <AnalyticsPageInner searchParams={searchParams} />
    </Suspense>
  );
}
