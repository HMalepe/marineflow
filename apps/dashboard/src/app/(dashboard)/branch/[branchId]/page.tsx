import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import type { BranchRow } from '@/app/(dashboard)/branches/branches-client';
import { BranchOverviewCards } from './branch-overview-cards';

export default async function BranchOverviewPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const token = await getToken();
  const data = await apiFetch<{ branch: BranchRow }>(`/branches/${branchId}`, {}, token);
  const branch = data.branch;

  return <BranchOverviewCards branchId={branchId} branchName={branch.name} />;
}
