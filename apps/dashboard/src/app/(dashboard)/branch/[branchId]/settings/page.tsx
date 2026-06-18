import { getToken, getUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { BranchSettingsClient } from './branch-settings-client';
import type { BranchRow } from '@/app/(dashboard)/branches/branches-client';

export default async function BranchSettingsPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const token = await getToken();
  const user = await getUser();
  const { branchId } = await params;

  const data = await apiFetch<{ branch: BranchRow }>(`/branches/${branchId}`, {}, token);

  return (
    <BranchSettingsClient
      token={token ?? ''}
      initialBranch={data.branch}
      canEdit={user?.role === 'OWNER' || user?.role === 'MANAGER'}
    />
  );
}
