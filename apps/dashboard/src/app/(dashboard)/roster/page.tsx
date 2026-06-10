import { getToken } from '@/lib/auth';
import { RosterClient } from './roster-client';

export default async function RosterPage() {
  const token = await getToken();
  return <RosterClient token={token ?? ''} />;
}
