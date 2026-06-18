import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { redirect, notFound } from 'next/navigation';
import { BranchShell } from './branch-shell';
import type { BranchRow } from '@/app/(dashboard)/branches/branches-client';

export default async function BranchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ branchId: string }>;
}) {
  const token = await getToken();
  if (!token) redirect('/login');

  const { branchId } = await params;

  try {
    const data = await apiFetch<{ branch: BranchRow }>(`/branches/${branchId}`, {}, token);
    return <BranchShell branch={data.branch}>{children}</BranchShell>;
  } catch {
    notFound();
  }
}
