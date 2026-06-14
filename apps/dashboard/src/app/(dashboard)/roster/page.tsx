import { getToken } from '@/lib/auth';
import { RosterClient } from './roster-client';

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ addStaff?: string }>;
}) {
  const token = await getToken();
  const params = await searchParams;
  return (
    <RosterClient
      token={token ?? ''}
      openAddStaff={params.addStaff === '1'}
    />
  );
}
