import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { branchPath } from '@/lib/branch-path';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BranchRow } from '@/app/(dashboard)/branches/branches-client';

export default async function BranchOverviewPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const token = await getToken();
  const data = await apiFetch<{ branch: BranchRow }>(`/branches/${branchId}`, {}, token);
  const branch = data.branch;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Staff Roster</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Manage shifts and time off for staff at {branch.name}.
          </p>
          <Link href={branchPath(branchId, '/roster')} className={cn(buttonVariants({ size: 'sm' }))}>
            Open roster
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{APPOINTMENTS_LABEL}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            View bookings scheduled at this location.
          </p>
          <Link href={branchPath(branchId, '/appointments')} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            View appointments
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Branch settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Edit this branch&apos;s name, address, and phone. Bot and service prices are salon-wide.
          </p>
          <Link href={branchPath(branchId, '/settings')} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            Edit branch
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
