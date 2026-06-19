import type { PrismaTx } from '../../lib/db/tenantSession.js';

export type BranchStats = {
  bookingsThisMonth: number;
  revenueCentsThisMonth: number;
  topService: string | null;
  setup: {
    hasStaff: boolean;
    hasLinkedServices: boolean;
    hasAddress: boolean;
  };
};

function currentMonthBounds(): { monthStart: Date; monthEnd: Date } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { monthStart, monthEnd };
}

const COUNTABLE_STATUSES = ['HELD', 'CONFIRMED', 'CONFIRMED_PAID', 'COMPLETED', 'NO_SHOW'] as const;

/** Bookings, revenue, top service, and setup checklist flags for a branch. */
export async function getBranchStats(
  db: PrismaTx,
  salonId: string,
  branchId: string,
): Promise<BranchStats | null> {
  const branch = await db.branch.findFirst({
    where: { id: branchId, salonId },
    select: {
      id: true,
      address: true,
      _count: { select: { staff: true } },
    },
  });
  if (!branch) return null;

  const { monthStart, monthEnd } = currentMonthBounds();

  const [appointments, linkedServices, topServiceRow] = await Promise.all([
    db.appointment.findMany({
      where: {
        salonId,
        branchId,
        start: { gte: monthStart, lt: monthEnd },
        status: { in: [...COUNTABLE_STATUSES] },
      },
      select: {
        service: { select: { name: true, priceCents: true } },
      },
    }),
    db.staffService.count({
      where: {
        staff: { branchId, salonId, deletedAt: null },
        service: { deletedAt: null, active: true },
      },
    }),
    db.appointment.groupBy({
      by: ['serviceId'],
      where: {
        salonId,
        branchId,
        start: { gte: monthStart, lt: monthEnd },
        status: { in: [...COUNTABLE_STATUSES] },
      },
      _count: { _all: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 1,
    }),
  ]);

  let topService: string | null = null;
  if (topServiceRow[0]?.serviceId) {
    const svc = await db.service.findUnique({
      where: { id: topServiceRow[0].serviceId },
      select: { name: true },
    });
    topService = svc?.name ?? null;
  }

  const revenueCentsThisMonth = appointments.reduce(
    (sum, row) => sum + (row.service?.priceCents ?? 0),
    0,
  );

  return {
    bookingsThisMonth: appointments.length,
    revenueCentsThisMonth,
    topService,
    setup: {
      hasStaff: branch._count.staff > 0,
      hasLinkedServices: linkedServices > 0,
      hasAddress: Boolean(branch.address?.trim()),
    },
  };
}
