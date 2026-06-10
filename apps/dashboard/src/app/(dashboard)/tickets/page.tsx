import { getToken } from '@/lib/auth';
import { TicketsClient } from './tickets-client';

export default async function TicketsPage() {
  const token = await getToken();

  return <TicketsClient token={token ?? ''} />;
}
