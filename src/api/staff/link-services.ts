import type { PrismaTx } from '../../lib/db/tenantSession.js';

export type LinkStaffServicesResult =
  | { ok: true; serviceIds: string[] }
  | { ok: false; error: string; message?: string };

/** Replace a staff member's linked services (tenant-scoped). */
export async function linkStaffServices(
  db: PrismaTx,
  input: {
    salonId: string;
    actorUserId: string;
    staffId: string;
    serviceIds: string[];
  },
): Promise<LinkStaffServicesResult> {
  const staff = await db.staff.findFirst({
    where: { id: input.staffId, salonId: input.salonId, deletedAt: null },
  });
  if (!staff) {
    return { ok: false, error: 'not_found', message: 'Staff member not found' };
  }

  const ids = [...new Set((input.serviceIds ?? []).filter(Boolean))];

  const services = await db.service.findMany({
    where: { id: { in: ids }, salonId: input.salonId, deletedAt: null, active: true },
    select: { id: true },
  });
  const validIds = services.map((s) => s.id);

  const existing = await db.staffService.findMany({
    where: { staffId: input.staffId },
    select: { serviceId: true, priceCentsOverride: true },
  });
  const overrideMap = new Map(existing.map((e) => [e.serviceId, e.priceCentsOverride]));

  await db.staffService.deleteMany({ where: { staffId: input.staffId } });
  if (validIds.length > 0) {
    await db.staffService.createMany({
      data: validIds.map((serviceId) => ({
        staffId: input.staffId,
        serviceId,
        priceCentsOverride: overrideMap.get(serviceId) ?? null,
      })),
    });
  }

  await db.auditLog.create({
    data: {
      salonId: input.salonId,
      actorUserId: input.actorUserId,
      action: 'staff_link_services',
      entity: 'Staff',
      entityId: input.staffId,
      payload: { serviceIds: validIds },
    },
  });

  return { ok: true, serviceIds: validIds };
}
