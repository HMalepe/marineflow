import { getToken, getUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { BranchesClient, type BranchRow } from './branches-client';

export default async function BranchesPage() {
  const token = await getToken();
  const user = await getUser();
  let branches: BranchRow[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ branches: BranchRow[] }>('/branches', {}, token);
    branches = data.branches;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-5xl">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <BranchesClient
      token={token ?? ''}
      initialBranches={branches}
      canAdd={user?.role === 'OWNER'}
      canEdit={user?.role === 'OWNER' || user?.role === 'MANAGER'}
    />
  );
}
