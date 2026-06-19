import type { PrismaTx } from '../../lib/db/tenantSession.js';

export type BulkUpdateCategoryResult =
  | { ok: true; updated: number }
  | { ok: false; error: string; message?: string };

/** Assign multiple services to one category (tenant-scoped). */
export async function bulkUpdateServiceCategory(
  db: PrismaTx,
  input: {
    salonId: string;
    actorUserId: string;
    serviceIds: string[];
    categoryId: string;
  },
): Promise<BulkUpdateCategoryResult> {
  const ids = [...new Set(input.serviceIds.filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, error: 'service_ids_required', message: 'Select at least one service' };
  }

  const category = await db.serviceCategory.findFirst({
    where: { id: input.categoryId, salonId: input.salonId },
  });
  if (!category) {
    return { ok: false, error: 'category_not_found', message: 'Category not found' };
  }

  const owned = await db.service.findMany({
    where: { id: { in: ids }, salonId: input.salonId, deletedAt: null },
    select: { id: true },
  });
  if (owned.length !== ids.length) {
    return { ok: false, error: 'invalid_services', message: 'One or more services were not found' };
  }

  const result = await db.service.updateMany({
    where: { id: { in: ids }, salonId: input.salonId, deletedAt: null },
    data: { categoryId: category.id },
  });

  await db.auditLog.create({
    data: {
      salonId: input.salonId,
      actorUserId: input.actorUserId,
      action: 'service_bulk_category',
      entity: 'ServiceCategory',
      entityId: category.id,
      payload: { serviceIds: ids, count: result.count },
    },
  });

  return { ok: true, updated: result.count };
}
