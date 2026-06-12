import { getToken } from '@/lib/auth';
import { TeamPerformanceClient } from './team-performance-client';

export default async function TeamPerformancePage() {
  const token = await getToken();
  return <TeamPerformanceClient token={token ?? ''} />;
}
