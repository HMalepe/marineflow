import { getToken } from '@/lib/auth';
import { AutomationsClient } from './automations-client';

export default async function AutomationsPage() {
  const token = await getToken();
  return <AutomationsClient token={token ?? ''} />;
}
