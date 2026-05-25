import type { FastifyReply, FastifyRequest } from 'fastify';
import { withTenantContext } from './tenantSession.js';
import { prisma } from '../prisma.js';

/**
 * Extracts the authenticated user's salonId from the JWT and wraps the
 * request handler in a tenant-scoped RLS context.
 *
 * Usage in routes:
 *   app.get('/stuff', async (request, reply) => withUserTenant(request, reply, async () => { ... }));
 */
export async function withUserTenant<T>(
  request: FastifyRequest,
  _reply: FastifyReply,
  handler: (user: { sub: string; salonId: string; role: string }) => Promise<T>,
): Promise<T> {
  const payload = request.user as { sub: string; salonId: string; role: string };
  if (!payload?.salonId) throw new Error('missing_salon_context');

  return withTenantContext(payload.salonId, () => handler(payload));
}

/**
 * Prehandler-style: resolves user and populates request.tenantContext.
 * This exists for routes that just need the salonId without wrapping in a callback.
 */
export async function resolveDashboardUser(request: FastifyRequest) {
  const payload = request.user as { sub: string; salonId?: string };
  if (!payload?.sub) throw new Error('unauthorized');

  const user = await prisma.staffUser.findUniqueOrThrow({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true, salonId: true },
  });

  return user;
}
