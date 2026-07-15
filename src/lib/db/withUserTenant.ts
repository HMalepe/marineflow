import type { FastifyReply, FastifyRequest } from 'fastify';
import { withTenantContext } from './tenantSession.js';
import { prisma } from '../prisma.js';

export type DashboardTenantUser = {
  sub: string;
  salonId: string;
  role: string;
  impersonatedBy?: string;
};

/**
 * Extracts the authenticated staff user and wraps the handler in a
 * tenant-scoped RLS context.
 *
 * CRITICAL: Tenant scope always comes from StaffUser.salonId in the database —
 * never from the JWT alone. This prevents cross-tenant data bleed if a token is
 * stale, forged, or if RLS is bypassed by a table-owner DB role.
 *
 * Impersonation tokens are minted as the *target* salon's OWNER, so the DB
 * salonId is still the correct tenant.
 */
export async function withUserTenant<T>(
  request: FastifyRequest,
  _reply: FastifyReply,
  handler: (user: DashboardTenantUser) => Promise<T>,
): Promise<T> {
  const payload = request.user as {
    sub?: string;
    salonId?: string;
    role?: string;
    impersonatedBy?: string;
  };

  if (!payload?.sub) {
    throw new Error('missing_user_context');
  }

  const staff = await prisma.staffUser.findUnique({
    where: { id: payload.sub },
    select: { id: true, salonId: true, role: true, active: true },
  });

  if (!staff) {
    throw new Error('user_not_found');
  }
  if (!staff.active) {
    throw new Error('account_inactive');
  }

  // Reject JWT that claims a different salon than the staff user belongs to.
  // (Impersonation always uses the target OWNER's sub, so salonIds must still match.)
  if (payload.salonId && payload.salonId !== staff.salonId) {
    throw new Error('salon_mismatch');
  }

  const user: DashboardTenantUser = {
    sub: staff.id,
    salonId: staff.salonId,
    role: staff.role,
    ...(payload.impersonatedBy ? { impersonatedBy: payload.impersonatedBy } : {}),
  };

  return withTenantContext(user.salonId, () => handler(user));
}

/**
 * Resolves the dashboard user from the DB (source of truth for salonId).
 */
export async function resolveDashboardUser(request: FastifyRequest) {
  const payload = request.user as { sub: string; salonId?: string };
  if (!payload?.sub) throw new Error('unauthorized');

  const user = await prisma.staffUser.findUniqueOrThrow({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true, salonId: true, active: true },
  });

  if (!user.active) throw new Error('account_inactive');

  if (payload.salonId && payload.salonId !== user.salonId) {
    throw new Error('salon_mismatch');
  }

  return user;
}
