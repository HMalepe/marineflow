import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from './auth.js';
import { withUserTenant } from '../lib/db/withUserTenant.js';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { earnStampForCompletedVisit } from '../services/loyalty.js';
import { refundPaymentStaff } from '../services/payments.js';

export async function dashboardApiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    await requireAuth(request, reply);
  });

  app.get('/me', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const u = await db.staffUser.findUniqueOrThrow({
        where: { id: user.sub },
        select: { id: true, email: true, name: true, role: true, salonId: true },
      });
      return { user: u };
    });
  });

  app.get('/appointments/today', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const rows = await db.appointment.findMany({
        where: {
          start: { gte: start, lt: end },
          status: { not: 'CANCELLED' },
        },
        include: { service: true, staff: true, customer: true },
        orderBy: { start: 'asc' },
      });
      return { appointments: rows };
    });
  });

  app.get('/appointments', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as { from?: string; to?: string };
      const from = q.from ? new Date(q.from) : new Date(Date.now() - 7 * 86400000);
      const to = q.to ? new Date(q.to) : new Date(Date.now() + 30 * 86400000);

      const rows = await db.appointment.findMany({
        where: {
          start: { gte: from, lte: to },
        },
        include: { service: true, staff: true, customer: true },
        orderBy: { start: 'asc' },
        take: 500,
      });
      return { appointments: rows };
    });
  });

  app.post<{ Params: { id: string } }>(
    '/appointments/:id/complete',
    { preHandler: requireRole('OWNER', 'MANAGER', 'STYLIST') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const appt = await db.appointment.findFirst({
          where: { id: request.params.id },
          include: { service: true },
        });
        if (!appt) {
          reply.code(404);
          return { error: 'not_found' };
        }

        await db.appointment.update({
          where: { id: appt.id },
          data: { status: 'COMPLETED' },
        });

        await earnStampForCompletedVisit({
          salonId: appt.salonId,
          customerId: appt.customerId,
          appointmentId: appt.id,
          service: appt.service,
        });

        await db.analyticsEvent.create({
          data: {
            salonId: appt.salonId,
            customerId: appt.customerId,
            appointmentId: appt.id,
            staffId: appt.staffId,
            type: 'appointment_completed_dashboard',
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'appointment_complete',
            entity: 'Appointment',
            entityId: appt.id,
          },
        });

        return { ok: true };
      });
    },
  );

  app.post<{ Params: { id: string }; Body: { csat?: number } }>(
    '/appointments/:id/csat',
    async (request, reply) => {
      return withUserTenant(request, reply, async () => {
        const db = getTenantDb();
        const score = request.body?.csat;
        if (typeof score !== 'number' || score < 1 || score > 5) {
          reply.code(400);
          return { error: 'invalid_csat' };
        }
        const appt = await db.appointment.findFirst({
          where: { id: request.params.id },
        });
        if (!appt) {
          reply.code(404);
          return { error: 'not_found' };
        }

        await db.analyticsEvent.create({
          data: {
            salonId: appt.salonId,
            customerId: appt.customerId,
            appointmentId: appt.id,
            type: 'csat',
            payload: { score },
          },
        });
        return { ok: true };
      });
    },
  );

  app.get('/tickets', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const tickets = await db.ticket.findMany({
        include: { customer: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
      return { tickets };
    });
  });

  app.patch<{ Params: { id: string }; Body: { status?: string; assigneeStaffUserId?: string | null } }>(
    '/tickets/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async () => {
        const db = getTenantDb();
        const t = await db.ticket.findFirst({
          where: { id: request.params.id },
        });
        if (!t) {
          reply.code(404);
          return { error: 'not_found' };
        }
        const updated = await db.ticket.update({
          where: { id: t.id },
          data: {
            status: request.body.status as never,
            assigneeStaffUserId: request.body.assigneeStaffUserId,
          },
        });
        return { ticket: updated };
      });
    },
  );

  app.get('/faq', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const items = await db.faqItem.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      return { items };
    });
  });

  app.post<{ Body: { question: string; answer: string; keywords?: string[] } }>(
    '/faq',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { question, answer } = request.body;
        if (!question?.trim() || !answer?.trim()) {
          reply.code(400);
          return { error: 'invalid' };
        }
        const item = await db.faqItem.create({
          data: {
            salonId: user.salonId,
            question: question.trim(),
            answer: answer.trim(),
            keywords: request.body.keywords ?? [],
          },
        });
        return { item };
      });
    },
  );

  app.get('/reports/summary', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const since = new Date(Date.now() - 30 * 86400000);
      const [appts, revenue] = await Promise.all([
        db.appointment.groupBy({
          by: ['status'],
          where: { createdAt: { gte: since } },
          _count: true,
        }),
        db.payment.aggregate({
          where: {
            status: 'SUCCEEDED',
            createdAt: { gte: since },
          },
          _sum: { amountCents: true },
        }),
      ]);
      return {
        appointmentsByStatus: appts,
        revenueCents30d: revenue._sum.amountCents ?? 0,
      };
    });
  });

  app.get('/export/appointments.csv', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as { from?: string; to?: string };
      const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400000);
      const to = q.to ? new Date(q.to) : new Date();

      const rows = await db.appointment.findMany({
        where: { start: { gte: from, lte: to } },
        include: { service: true, staff: true, customer: true },
        orderBy: { start: 'asc' },
        take: 5000,
      });

      const header = 'id,start,end,status,service,staff,customerWa\n';
      const lines = rows.map((r) =>
        [
          r.id,
          r.start.toISOString(),
          r.end.toISOString(),
          r.status,
          csvEscape(r.service.name),
          csvEscape(r.staff.name),
          r.customer.waId,
        ].join(','),
      );
      const csv = header + lines.join('\n');
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="appointments.csv"')
        .send(csv);
    });
  });

  app.get('/export/payments.csv', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as { from?: string; to?: string };
      const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400000);
      const to = q.to ? new Date(q.to) : new Date();

      const rows = await db.payment.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { customer: true },
        orderBy: { createdAt: 'asc' },
        take: 5000,
      });

      const header = 'id,createdAt,status,amountCents,currency,customerWa,stripePaymentIntentId\n';
      const lines = rows.map((r) =>
        [
          r.id,
          r.createdAt.toISOString(),
          r.status,
          r.amountCents,
          r.currency,
          r.customer.waId,
          r.stripePaymentIntentId ?? '',
        ].join(','),
      );
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="payments.csv"')
        .send(header + lines.join('\n'));
    });
  });

  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/payments/:id/refund',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const reason = request.body?.reason?.trim();
        if (!reason) {
          reply.code(400);
          return { error: 'reason_required' };
        }
        try {
          await refundPaymentStaff({
            paymentId: request.params.id,
            actorUserId: user.sub,
            reason,
          });
        } catch {
          reply.code(400);
          return { error: 'refund_failed' };
        }
        return { ok: true };
      });
    },
  );

  app.get('/audit', { preHandler: requireRole('OWNER') }, async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const logs = await db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return { logs };
    });
  });

  app.get('/staff', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const staff = await db.staff.findMany({
        where: { deletedAt: null },
        include: { services: { include: { service: true } }, workingHours: true },
        orderBy: { sortOrder: 'asc' },
      });
      return { staff };
    });
  });

  app.get('/working-hours', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as { staffId?: string };
      const where = q.staffId ? { staffId: q.staffId } : {};
      const hours = await db.workingHour.findMany({
        where,
        orderBy: [{ staffId: 'asc' }, { weekday: 'asc' }],
      });
      return { hours };
    });
  });

  app.get('/customers', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as {
        search?: string;
        tag?: string;
        limit?: string;
        offset?: string;
      };
      const take = Math.min(Number(q.limit) || 50, 200);
      const skip = Number(q.offset) || 0;

      const where: Record<string, unknown> = { deletedAt: null };
      if (q.tag) {
        where.tags = { has: q.tag };
      }
      if (q.search) {
        const term = q.search.trim();
        where.OR = [
          { displayName: { contains: term, mode: 'insensitive' } },
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { waId: { contains: term } },
          { email: { contains: term, mode: 'insensitive' } },
        ];
      }

      const [customers, total] = await Promise.all([
        db.customer.findMany({
          where,
          orderBy: { lastInteractionAt: { sort: 'desc', nulls: 'last' } },
          take,
          skip,
          include: { preferredStaff: { select: { id: true, name: true } } },
        }),
        db.customer.count({ where }),
      ]);

      return { customers, total, take, skip };
    });
  });

  app.get<{ Params: { id: string } }>('/customers/:id', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const customer = await db.customer.findFirst({
        where: { id: request.params.id, deletedAt: null },
        include: {
          preferredStaff: { select: { id: true, name: true } },
          appointments: { orderBy: { start: 'desc' }, take: 10, include: { service: true, staff: true } },
          loyaltyLedgers: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });
      if (!customer) {
        reply.code(404);
        return { error: 'not_found' };
      }
      return { customer };
    });
  });

  app.patch<{ Params: { id: string }; Body: { tags?: string[]; notes?: string; marketingConsent?: boolean; preferredStaffId?: string | null } }>(
    '/customers/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.customer.findFirst({
          where: { id: request.params.id, deletedAt: null },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        const data: Record<string, unknown> = {};
        if (request.body.tags !== undefined) data.tags = request.body.tags;
        if (request.body.notes !== undefined) data.notes = request.body.notes;
        if (request.body.preferredStaffId !== undefined) data.preferredStaffId = request.body.preferredStaffId;
        if (request.body.marketingConsent !== undefined) {
          data.marketingConsent = request.body.marketingConsent;
          data.marketingConsentAt = request.body.marketingConsent ? new Date() : null;
        }

        const updated = await db.customer.update({
          where: { id: existing.id },
          data,
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'customer_update',
            entity: 'Customer',
            entityId: existing.id,
            payload: data as unknown as Record<string, string | number | boolean | null>,
          },
        });

        return { customer: updated };
      });
    },
  );
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
