import { getToken } from '@/lib/auth';
import { WebhooksClient } from './webhooks-client';

export default async function WebhooksPage() {
  const token = await getToken();
  return <WebhooksClient token={token ?? ''} />;
}
