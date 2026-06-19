import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Live Pulse</h1>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return <PulseClient token={token ?? ''} initialBranches={branches} />;
}
