import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { PulseClient } from './pulse-client';

interface BranchRow {
  id: string;
  name: string;
}

export default async function PulsePage() {
  const token = await getToken();
  let branches: BranchRow[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ branches: BranchRow[] }>('/branches', {}, token);
    branches = data.branches ?? [];
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load branches';
  }

  if (error && !token) {
    return (
      <div className="dashboard-page-flow space-y-6">
        <DashboardPageHeader title="Live Pulse" variant="cyan" subtitle={error} />
      </div>
    );
  }

  return <PulseClient token={token ?? ''} initialBranches={branches} />;
}
