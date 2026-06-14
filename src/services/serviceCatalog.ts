import type { Prisma } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { logger } from '../lib/logger.js';
import { syncSalonRosterLater } from './rosterSync.js';

type TenantDb = ReturnType<typeof getTenantDb>;

export type RemoveServiceResult = {
  ok: true;
  hadAppointments: boolean;
};

/**
 * Soft-remove a service from the bookable catalog (dashboard + WhatsApp).
 * Keeps the row for historical appointments; sets deletedAt + active=false.
 */
export async function removeServiceFromCatalog(
  db: TenantDb,
  user: { sub: string; salonId: string },
  serviceId: string,
): Promise<RemoveServiceResult> {
  const existing = await db.service.findFirst({
    where: { id: serviceId, salonId: user.salonId, deletedAt: null },
  });
  if (!existing) {
    const err = new Error('not_found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const hadAppointments = (await db.appointment.count({
    where: {
      serviceId: existing.id,
      status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
    },
  })) > 0;

  try {
    await db.service.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), active: false },
    });
  } catch (err) {
    // Production DB may lack deletedAt until ensureSchema runs — still hide from bot.
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code?: string }).code === 'P2022'
    ) {
      logger.warn({ serviceId, err }, 'service_delete_missing_deletedAt_fallback');
      await db.service.update({
        where: { id: existing.id },
        data: { active: false },
      });
    } else {
      throw err;
    }
  }

  await db.auditLog.create({
    data: {
      salonId: user.salonId,
      actorUserId: user.sub,
      action: hadAppointments ? 'service_deactivate' : 'service_delete',
      entity: 'Service',
      entityId: existing.id,
      payload: {
        hadAppointments,
        removedFromCatalog: true,
      } as Prisma.InputJsonValue,
    },
  });

  syncSalonRosterLater(user.salonId, 'services', {
    serviceId: existing.id,
    action: hadAppointments ? 'deactivate' : 'delete',
  });

  return { ok: true, hadAppointments };
}
