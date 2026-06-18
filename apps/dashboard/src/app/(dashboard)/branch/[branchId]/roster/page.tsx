import { getToken } from '@/lib/auth';
import { RosterClient } from '@/app/(dashboard)/roster/roster-client';

export default async function BranchRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<{ addStaff?: string }>;
}) {
  const token = await getToken();
  const { branchId } = await params;
  const sp = await searchParams;

  return (
    <RosterClient
      token={token ?? ''}
      branchId={branchId}
      hidePageHeader
      openAddStaff={sp.addStaff === '1'}
    />
  );
}
