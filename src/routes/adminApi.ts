import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { getPlatformMetrics, getConversationFunnel, checkAlertThresholds } from '../services/observability.js';

/**
 * Platform admin routes — guarded by admin JWT (isAdmin: true in token).
 * These are NOT tenant-scoped; they operate across all salons.
 */
export async function adminApiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);

  // ─── Admin Login ───────────────────────────────────────────────────
  app.post('/login', { preHandler: [] }, async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';
    if (!email) return reply.code(400).send({ error: 'email_required' });

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin?.active) return reply.code(401).send({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'invalid_credentials' });

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = app.jwt.sign(
      { sub: admin.id, isAdmin: true, isSuperAdmin: admin.isSuperAdmin },
      { expiresIn: '4h' },
    );

    return { token, admin: { id: admin.id, email: admin.email, name: admin.name } };
  });

  // ─── Salon List with Metrics ────────────────────────────────────────
  app.get('/salons', async (request) => {
    const q = request.query as { status?: string; tier?: string; search?: string; page?: string };
    const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
    const take = 25;
    const skip = (page - 1) * take;

    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.tier) where.tier = q.tier;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { slug: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [salons, total] = await Promise.all([
      prisma.salon.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          tier: true,
          createdAt: true,
          trialEndsAt: true,
          _count: {
            select: {
              staff: true,
              customers: true,
              appointments: true,
              branches: true,
            },
          },
        },
      }),
      prisma.salon.count({ where }),
    ]);

    return { salons, total, page, pages: Math.ceil(total / take) };
  });

  // ─── Salon Detail ──────────────────────────────────────────────────
  app.get('/salons/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const salon = await prisma.salon.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        _count: {
          select: {
            staff: true,
            customers: true,
            appointments: true,
            branches: true,
            services: true,
          },
        },
      },
    });

    if (!salon) return reply.code(404).send({ error: 'not_found' });
    return { salon };
  });

  // ─── Update Salon Status/Tier ──────────────────────────────────────
  app.patch('/salons/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status?: string; tier?: string };
    const data: Record<string, unknown> = {};

    if (body.status) data.status = body.status;
    if (body.tier) data.tier = body.tier;

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: 'nothing_to_update' });
    }

    const salon = await prisma.salon.update({ where: { id }, data });
    return { salon: { id: salon.id, status: salon.status, tier: salon.tier } };
  });

  // ─── Impersonation Token ───────────────────────────────────────────
  app.post('/salons/:id/impersonate', async (request, reply) => {
    const adminPayload = request.user as { isSuperAdmin?: boolean };
    if (!adminPayload.isSuperAdmin) {
      return reply.code(403).send({ error: 'super_admin_required' });
    }

    const { id } = request.params as { id: string };
    const salon = await prisma.salon.findUnique({ where: { id } });
    if (!salon) return reply.code(404).send({ error: 'not_found' });

    // Find the salon owner
    const owner = await prisma.staffUser.findFirst({
      where: { salonId: id, role: 'OWNER', active: true },
    });

    if (!owner) return reply.code(404).send({ error: 'no_owner_found' });

    const token = app.jwt.sign(
      {
        sub: owner.id,
        salonId: id,
        role: 'OWNER',
        impersonatedBy: (request.user as { sub: string }).sub,
      },
      { expiresIn: '1h' },
    );

    return { token, salon: { id: salon.id, name: salon.name }, impersonating: owner.email };
  });

  // ─── Platform Usage Summary ────────────────────────────────────────
  app.get('/stats', async () => {
    const [totalSalons, activeSalons, totalCustomers, totalAppointments, recentSignups] =
      await Promise.all([
        prisma.salon.count(),
        prisma.salon.count({ where: { status: 'ACTIVE' } }),
        prisma.customer.count(),
        prisma.appointment.count(),
        prisma.salon.count({
          where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        }),
      ]);

    return { totalSalons, activeSalons, totalCustomers, totalAppointments, recentSignups };
  });

  // ─── Usage Alerts ──────────────────────────────────────────────────
  app.get('/alerts', async () => {
    const [pastDue, trialExpiring, overQuota] = await Promise.all([
      prisma.salon.findMany({
        where: { status: 'PAST_DUE' },
        select: { id: true, name: true, slug: true, statusChangedAt: true },
      }),
      prisma.salon.findMany({
        where: {
          status: 'TRIAL',
          trialEndsAt: { lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, name: true, slug: true, trialEndsAt: true },
      }),
      // Salons on starter tier with more than 3 staff
      prisma.salon.findMany({
        where: {
          tier: 'starter',
          staff: { some: {} },
        },
        select: {
          id: true,
          name: true,
          tier: true,
          _count: { select: { staff: true } },
        },
      }).then((salons) => salons.filter((s) => s._count.staff > 3)),
    ]);

    return { pastDue, trialExpiring, overQuota };
  });

  // ─── Observability ───────────────────────────────────────────────────
  app.get('/observability/metrics', async () => {
    return getPlatformMetrics();
  });

  app.get('/observability/funnel', async (request) => {
    const { salonId } = request.query as { salonId?: string };
    return getConversationFunnel(salonId);
  });

  app.get('/observability/alerts', async () => {
    return checkAlertThresholds();
  });
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  // Skip auth for the login endpoint
  if (request.url.endsWith('/login') && request.method === 'POST') return;

  try {
    await request.jwtVerify();
    const payload = request.user as { isAdmin?: boolean };
    if (!payload.isAdmin) {
      return reply.code(403).send({ error: 'admin_required' });
    }
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
}
