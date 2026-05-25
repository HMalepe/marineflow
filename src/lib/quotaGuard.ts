import type { FastifyReply } from 'fastify';
import { getTenantDb } from './db/tenantSession.js';
import { checkQuota } from '../services/subscription.js';

/**
 * Checks whether the salon has capacity for the given resource.
 * Returns true if allowed; sends 403 and returns false if quota exceeded.
 */
export async function enforceQuota(
  salonTier: string,
  resource: 'staff' | 'branches' | 'services',
  reply: FastifyReply,
): Promise<boolean> {
  const db = getTenantDb();

  let currentCount = 0;
  if (resource === 'staff') {
    currentCount = await db.staff.count({ where: { deletedAt: null } });
  } else if (resource === 'branches') {
    currentCount = await db.branch.count();
  } else if (resource === 'services') {
    currentCount = await db.service.count({ where: { deletedAt: null } });
  }

  const { allowed, limit } = checkQuota(salonTier, resource, currentCount);

  if (!allowed) {
    reply.code(403);
    reply.send({
      error: 'quota_exceeded',
      message: `Your plan allows a maximum of ${limit} ${resource}. Please upgrade.`,
      resource,
      limit,
      current: currentCount,
    });
    return false;
  }

  return true;
}
