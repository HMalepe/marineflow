import type { PrismaTx } from '../../lib/db/tenantSession.js';
import { isDispensarySalon } from '../../lib/retailSettings.js';

export type SetupHealthCheckId =
  | 'staff_no_services'
  | 'services_uncategorized'
  | 'faqs_pending'
  | 'branches_no_staff'
  | 'popia_optin_low';

export type SetupHealthCheck = {
  id: SetupHealthCheckId;
  label: string;
  fixHref: string;
  fixLabel: string;
  penalty: number;
  count: number;
};

export type TenantSetupHealth = {
  salonId: string;
  score: number;
  checks: SetupHealthCheck[];
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

/**
 * Setup completeness — score out of 100 with actionable failing checks.
 * Retail tenants have no staff roster or branches in their dashboard, so
 * those checks are skipped rather than silently docking their score for
 * salon concepts and linking them to pages they cannot navigate to.
 */
export async function getTenantSetupHealth(
  db: PrismaTx,
  salonId: string,
  industryTemplate?: string | null,
): Promise<TenantSetupHealth> {
  const retail = isDispensarySalon(industryTemplate);
  const [
    staffNoServicesCount,
    uncategorizedServicesCount,
    pendingFaqsCount,
    branches,
    popiaOptInCount,
  ] = await Promise.all([
    db.staff.count({
      where: {
        salonId,
        deletedAt: null,
        active: true,
        services: { none: {} },
      },
    }),
    db.service.count({
      where: {
        salonId,
        deletedAt: null,
        active: true,
        OR: [
          { categoryId: null },
          {
            category: {
              OR: [
                { slug: 'other' },
                { name: { equals: 'Other', mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
    }),
    db.faqItem.count({
      where: { salonId, status: 'DRAFT' },
    }),
    db.branch.findMany({
      where: { salonId, isActive: true },
      select: {
        id: true,
        _count: {
          select: {
            staff: { where: { deletedAt: null, active: true } },
          },
        },
      },
    }),
    db.customer.count({
      where: {
        salonId,
        deletedAt: null,
        marketingConsentStatus: 'ACCEPTED',
      },
    }),
  ]);

  const emptyBranchCount = branches.filter((b) => b._count.staff === 0).length;
  const checks: SetupHealthCheck[] = [];
  let score = 100;

  if (!retail && staffNoServicesCount > 0) {
    const penalty = Math.min(staffNoServicesCount * 15, 30);
    score -= penalty;
    checks.push({
      id: 'staff_no_services',
      label: `${staffNoServicesCount} staff have no services linked`,
      fixHref: '/roster',
      fixLabel: 'Fix in Roster',
      penalty,
      count: staffNoServicesCount,
    });
  }

  if (uncategorizedServicesCount > 0) {
    score -= 20;
    checks.push({
      id: 'services_uncategorized',
      label: retail
        ? `${uncategorizedServicesCount} product${uncategorizedServicesCount === 1 ? '' : 's'} missing a real category (uncategorised or "Other")`
        : `${uncategorizedServicesCount} service${uncategorizedServicesCount === 1 ? '' : 's'} missing a real category (uncategorised or "Other")`,
      fixHref: '/services',
      fixLabel: retail ? 'Fix in Products' : 'Fix in Services',
      penalty: 20,
      count: uncategorizedServicesCount,
    });
  }

  if (pendingFaqsCount > 3) {
    score -= 15;
    checks.push({
      id: 'faqs_pending',
      label: `${pendingFaqsCount} bot FAQs pending approval`,
      fixHref: '/faqs',
      fixLabel: 'Review in Bot FAQs',
      penalty: 15,
      count: pendingFaqsCount,
    });
  }

  if (!retail && emptyBranchCount > 0) {
    const penalty = Math.min(emptyBranchCount * 10, 20);
    score -= penalty;
    checks.push({
      id: 'branches_no_staff',
      label: `${emptyBranchCount} branch${emptyBranchCount === 1 ? '' : 'es'} with no staff assigned`,
      fixHref: '/branches',
      fixLabel: 'Fix in Branches',
      penalty,
      count: emptyBranchCount,
    });
  }

  if (popiaOptInCount < 5) {
    score -= 15;
    checks.push({
      id: 'popia_optin_low',
      label: `POPIA marketing opt-in audience is ${popiaOptInCount} (need at least 5)`,
      fixHref: '/customers',
      fixLabel: retail ? 'View buyers' : 'View customers',
      penalty: 15,
      count: popiaOptInCount,
    });
  }

  return {
    salonId,
    score: clampScore(score),
    checks,
  };
}
