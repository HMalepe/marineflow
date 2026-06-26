'use client';

import Link from 'next/link';
import { CollapsibleSection } from '@/components/collapsible-section';
import { buttonVariants } from '@/components/ui/button';
import { branchPath } from '@/lib/branch-path';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';

export function BranchOverviewCards({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <CollapsibleSection
        id="branch-overview-roster"
        title="Staff Roster"
        subtitle={`Manage shifts and time off for staff at ${branchName}.`}
        defaultOpen
      >
        <Link href={branchPath(branchId, '/roster')} className={cn(buttonVariants({ size: 'sm' }))}>
          Open roster
        </Link>
      </CollapsibleSection>

      <CollapsibleSection
        id="branch-overview-appointments"
        title={APPOINTMENTS_LABEL}
        subtitle="View bookings scheduled at this location."
        defaultOpen
      >
        <Link
          href={branchPath(branchId, '/appointments')}
          className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
        >
          View appointments
        </Link>
      </CollapsibleSection>

      <CollapsibleSection
        id="branch-overview-settings"
        title="Branch settings"
        subtitle="Edit this branch's name, address, and phone. Bot and service prices are salon-wide."
        defaultOpen
      >
        <Link
          href={branchPath(branchId, '/settings')}
          className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
        >
          Edit branch
        </Link>
      </CollapsibleSection>
    </div>
  );
}
