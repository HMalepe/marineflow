import { getToken } from '@/lib/auth';
import { AnalyticsClient } from './analytics-client';

export default async function AnalyticsPage() {
  const token = await getToken();
  return <AnalyticsClient token={token ?? ''} />;
}
