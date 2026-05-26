import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from './auth.js';
import { withUserTenant } from '../lib/db/withUserTenant.js';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { earnStampForCompletedVisit } from '../services/loyalty.js';
import { refundPaymentStaff } from '../services/payments.js';
import { fuzzySearchCustomers } from '../services/customerSearch.js';
import {
  getPlans,
  getSalonSubscription,
  createPayfastSubscription,
  cancelSubscription,
  checkQuota,
} from '../services/subscription.js';
import {
  generatePresignedUpload,
  confirmUpload,
  listUploads,
  deleteUpload,
} from '../services/uploads.js';
import { exportCustomerData, eraseCustomerData } from '../services/compliance.js';
import { generateWebhookSecret } from '../services/webhookDelivery.js';

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
      const fromParsed = q.from ? new Date(q.from) : null;
      const toParsed = q.to ? new Date(q.to) : null;
      const from = fromParsed && !isNaN(fromParsed.getTime()) ? fromParsed : new Date(Date.now() - 7 * 86400000);
      const to = toParsed && !isNaN(toParsed.getTime()) ? toParsed : new Date(Date.now() + 30 * 86400000);

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
        if (appt.status === 'CANCELLED' || appt.status === 'COMPLETED' || appt.status === 'RESCHEDULED' || appt.status === 'NO_SHOW') {
          reply.code(409);
          return { error: 'invalid_status', message: `Cannot complete appointment with status ${appt.status}` };
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
        const validStatuses = ['OPEN', 'WAITING_CUSTOMER', 'RESOLVED'] as const;
        type ValidStatus = typeof validStatuses[number];
        const statusInput = request.body.status;
        if (statusInput && !validStatuses.includes(statusInput as ValidStatus)) {
          reply.code(400);
          return { error: 'invalid_status', valid: validStatuses };
        }
        const updated = await db.ticket.update({
          where: { id: t.id },
          data: {
            status: statusInput as ValidStatus | undefined,
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
          csvEscape(r.customer.waId),
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

  app.get('/payments', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as {
        provider?: string;
        status?: string;
        from?: string;
        to?: string;
        limit?: string;
        offset?: string;
      };
      const take = Math.min(Number(q.limit) || 50, 200);
      const skip = Number(q.offset) || 0;

      const where: Record<string, unknown> = {};
      if (q.provider) where.provider = q.provider;
      if (q.status) where.status = q.status;
      if (q.from || q.to) {
        where.createdAt = {
          ...(q.from ? { gte: new Date(q.from) } : {}),
          ...(q.to ? { lte: new Date(q.to) } : {}),
        };
      }

      const [payments, total] = await Promise.all([
        db.payment.findMany({
          where,
          include: { customer: { select: { id: true, waId: true, displayName: true } } },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        db.payment.count({ where }),
      ]);

      return { payments, total, take, skip };
    });
  });

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

  app.get('/customers/search', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const q = request.query as { q?: string; limit?: string; threshold?: string };
      const query = q.q?.trim() ?? '';
      if (!query) return { results: [] };
      const results = await fuzzySearchCustomers(user.salonId, query, {
        limit: Math.min(Number(q.limit) || 20, 50),
        threshold: Number(q.threshold) || 0.3,
      });
      return { results };
    });
  });

  app.get<{ Params: { id: string } }>('/customers/:id', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const customer = await db.customer.findFirst({
        where: { id: request.params.id, deletedAt: null },
        include: {
          preferredStaff: { select: { id: true, name: true } },
        },
      });
      if (!customer) {
        reply.code(404);
        return { error: 'not_found' };
      }

      const [appointments, messages, loyaltySum] = await Promise.all([
        db.appointment.findMany({
          where: { customerId: customer.id },
          take: 20,
          orderBy: { start: 'desc' },
          include: { service: true, staff: true },
        }),
        db.message.findMany({
          where: { conversation: { customerId: customer.id } },
          take: 30,
          orderBy: { createdAt: 'desc' },
        }),
        db.loyaltyLedger.aggregate({
          where: { customerId: customer.id },
          _sum: { delta: true },
        }),
      ]);

      return {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        displayName: customer.displayName,
        email: customer.email,
        waId: customer.waId,
        createdAt: customer.createdAt,
        loyaltyStamps: loyaltySum._sum.delta ?? 0,
        appointments: appointments.map((a) => ({
          id: a.id,
          start: a.start,
          status: a.status,
          serviceName: a.service?.name ?? 'Unknown',
          staffName: a.staff?.name ?? 'Unknown',
        })),
        messages: messages.reverse().map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          createdAt: m.createdAt,
        })),
      };
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

  // ── Branch CRUD ────────────────────────────────────────────

  app.get('/branches', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const branches = await db.branch.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { staff: true, appointments: true } } },
      });
      return { branches };
    });
  });

  app.post<{ Body: { name: string; address?: string; city?: string; province?: string; postalCode?: string; phone?: string; email?: string; timezone?: string; slug?: string } }>(
    '/branches',
    { preHandler: requireRole('OWNER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { name, address, city, province, postalCode, phone, email, timezone, slug } = request.body;
        if (!name || name.trim().length === 0) {
          reply.code(400);
          return { error: 'name_required' };
        }
        const branch = await db.branch.create({
          data: {
            salonId: user.salonId,
            name: name.trim(),
            slug: slug?.trim() || name.trim().toLowerCase().replace(/\s+/g, '-'),
            address, city, province, postalCode, phone, email, timezone,
          },
        });
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'branch_create',
            entity: 'Branch',
            entityId: branch.id,
          },
        });
        return { branch };
      });
    },
  );

  app.patch<{ Params: { id: string }; Body: { name?: string; address?: string; city?: string; province?: string; postalCode?: string; phone?: string; email?: string; timezone?: string; isActive?: boolean; sortOrder?: number } }>(
    '/branches/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.branch.findFirst({ where: { id: request.params.id } });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }
        const { name, address, city, province, postalCode, phone, email, timezone, isActive, sortOrder } = request.body;
        const updated = await db.branch.update({
          where: { id: existing.id },
          data: {
            ...(name !== undefined && { name }),
            ...(address !== undefined && { address }),
            ...(city !== undefined && { city }),
            ...(province !== undefined && { province }),
            ...(postalCode !== undefined && { postalCode }),
            ...(phone !== undefined && { phone }),
            ...(email !== undefined && { email }),
            ...(timezone !== undefined && { timezone }),
            ...(isActive !== undefined && { isActive }),
            ...(sortOrder !== undefined && { sortOrder }),
          },
        });
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'branch_update',
            entity: 'Branch',
            entityId: existing.id,
          },
        });
        return { branch: updated };
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/branches/:id',
    { preHandler: requireRole('OWNER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.branch.findFirst({ where: { id: request.params.id } });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }
        const staffCount = await db.staff.count({ where: { branchId: existing.id, deletedAt: null } });
        if (staffCount > 0) {
          reply.code(409);
          return { error: 'branch_has_staff', message: 'Reassign staff before deleting branch' };
        }
        await db.branch.delete({ where: { id: existing.id } });
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'branch_delete',
            entity: 'Branch',
            entityId: existing.id,
          },
        });
        return { ok: true };
      });
    },
  );

  // ─── Analytics Overview ──────────────────────────────────────────────
  app.get('/analytics/overview', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const salonId = user.salonId;

      const [dailyBookings, revenue, retention, staffPerformance] = await Promise.all([
        db.$queryRawUnsafe<Array<{
          booking_date: string;
          total_bookings: number;
          completed: number;
          cancelled: number;
          no_shows: number;
        }>>(
          `SELECT booking_date::text, total_bookings::int, completed::int, cancelled::int, no_shows::int
           FROM mv_daily_bookings WHERE "salonId" = $1 ORDER BY booking_date DESC LIMIT 90`,
          salonId,
        ),
        db.$queryRawUnsafe<Array<{
          month: string;
          total_revenue_cents: number;
          unique_customers: number;
          invoice_count: number;
        }>>(
          `SELECT month::text, total_revenue_cents::int, unique_customers::int, invoice_count::int
           FROM mv_revenue_summary WHERE "salonId" = $1 ORDER BY month DESC LIMIT 12`,
          salonId,
        ),
        db.$queryRawUnsafe<Array<{
          month: string;
          unique_customers: number;
          returning_customers: number;
        }>>(
          `SELECT month::text, unique_customers::int, returning_customers::int
           FROM mv_customer_retention WHERE "salonId" = $1 ORDER BY month DESC LIMIT 12`,
          salonId,
        ),
        db.$queryRawUnsafe<Array<{
          staffId: string;
          staffName: string;
          total_appointments: number;
          completed: number;
          no_shows: number;
          revenue_cents: number;
        }>>(
          `SELECT sp."staffId", s.name as "staffName",
                  sp.total_appointments::int, sp.completed::int, sp.no_shows::int, sp.revenue_cents::int
           FROM mv_staff_performance sp
           LEFT JOIN "Staff" s ON s.id = sp."staffId"
           WHERE sp."salonId" = $1
             AND sp.month = DATE_TRUNC('month', CURRENT_DATE)
           ORDER BY sp.revenue_cents DESC`,
          salonId,
        ),
      ]);

      return {
        dailyBookings: dailyBookings.reverse(),
        revenue: revenue.reverse(),
        retention: retention.reverse(),
        staffPerformance,
      };
    });
  });


  // ─── Subscription & Billing ──────────────────────────────────────────
  app.get('/subscription/plans', async () => {
    return { plans: await getPlans() };
  });

  app.get('/subscription', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const sub = await getSalonSubscription(user.salonId);
      return { subscription: sub };
    });
  });

  app.post('/subscription/checkout', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { planTier, billingCycle } = request.body as {
        planTier: string;
        billingCycle: 'monthly' | 'annual';
      };

      if (!planTier || !['monthly', 'annual'].includes(billingCycle)) {
        reply.code(400);
        return { error: 'invalid_input' };
      }

      const result = await createPayfastSubscription({
        salonId: user.salonId,
        planTier,
        billingCycle,
        returnUrl: `${request.headers.origin ?? ''}/settings?billing=success`,
        cancelUrl: `${request.headers.origin ?? ''}/settings?billing=cancelled`,
        notifyUrl: `${process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000'}/webhooks/payfast/subscription`,
      });

      return result;
    });
  });

  app.post(
    '/subscription/cancel',
    { preHandler: requireRole('OWNER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const result = await cancelSubscription(user.salonId);
        if (!result.ok) {
          reply.code(400);
          return { error: result.error };
        }
        return { ok: true };
      });
    },
  );

  app.get('/subscription/quota/:resource', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const { resource } = request.params as { resource: string };
      const salon = await db.salon.findUniqueOrThrow({ where: { id: user.salonId } });

      let currentCount = 0;
      if (resource === 'staff') {
        currentCount = await db.staff.count({ where: { deletedAt: null } });
      } else if (resource === 'branches') {
        currentCount = await db.branch.count();
      } else if (resource === 'services') {
        currentCount = await db.service.count({ where: { deletedAt: null } });
      } else {
        reply.code(400);
        return { error: 'invalid_resource' };
      }

      const result = checkQuota(salon.tier, resource as 'staff' | 'branches' | 'services', currentCount);
      return { resource, currentCount, ...result };
    });
  });

  // ─── File Uploads ────────────────────────────────────────────────────
  app.post('/uploads/presign', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { filename, mimeType, purpose } = request.body as {
        filename: string;
        mimeType: string;
        purpose?: string;
      };

      if (!filename || !mimeType) {
        reply.code(400);
        return { error: 'filename and mimeType required' };
      }

      const result = await generatePresignedUpload(
        user.salonId,
        filename,
        mimeType,
        purpose ?? 'general',
      );

      return result;
    });
  });

  app.post('/uploads/confirm', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { fileKey, filename, mimeType, sizeBytes, purpose } = request.body as {
        fileKey: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
        purpose?: string;
      };

      if (!fileKey || !filename || !mimeType || !sizeBytes) {
        reply.code(400);
        return { error: 'missing_fields' };
      }

      const file = await confirmUpload(
        user.salonId,
        fileKey,
        filename,
        mimeType,
        sizeBytes,
        purpose ?? 'general',
        user.sub,
      );

      return { file };
    });
  });

  app.get('/uploads', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const { purpose } = request.query as { purpose?: string };
      const files = await listUploads(purpose);
      return { files };
    });
  });

  app.delete('/uploads/:id', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const { id } = request.params as { id: string };
      const file = await deleteUpload(id);
      if (!file) {
        reply.code(404);
        return { error: 'not_found' };
      }
      return { ok: true };
    });
  });

  // ─── POPIA/GDPR Compliance ───────────────────────────────────────────
  app.get(
    '/customers/:id/export',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async () => {
        const { id } = request.params as { id: string };
        const data = await exportCustomerData(id);
        if (!data) {
          reply.code(404);
          return { error: 'customer_not_found' };
        }
        return data;
      });
    },
  );

  app.delete(
    '/customers/:id/erase',
    { preHandler: requireRole('OWNER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async () => {
        const { id } = request.params as { id: string };
        const result = await eraseCustomerData(id);
        if (!result) {
          reply.code(404);
          return { error: 'customer_not_found' };
        }
        return result;
      });
    },
  );

  // ─── Webhook Subscriptions ───────────────────────────────────────────
  app.get('/webhooks', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const subs = await db.webhookSubscription.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { deliveries: true } } },
      });
      return { webhooks: subs };
    });
  });

  app.post(
    '/webhooks',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { url, events, description } = request.body as {
          url: string;
          events: string[];
          description?: string;
        };

        if (!url || !events?.length) {
          reply.code(400);
          return { error: 'url and events required' };
        }

        try {
          new URL(url);
        } catch {
          reply.code(400);
          return { error: 'invalid_url' };
        }

        const db = getTenantDb();
        const sub = await db.webhookSubscription.create({
          data: {
            salonId: user.salonId,
            url,
            events,
            secret: generateWebhookSecret(),
            description,
          },
        });

        return { webhook: sub };
      });
    },
  );

  app.delete(
    '/webhooks/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async () => {
        const { id } = request.params as { id: string };
        const db = getTenantDb();
        await db.webhookSubscription.delete({ where: { id } }).catch(() => null);
        return { ok: true };
      });
    },
  );

  app.get('/webhooks/:id/deliveries', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const { id } = request.params as { id: string };
      const db = getTenantDb();
      const deliveries = await db.webhookDelivery.findMany({
        where: { subscriptionId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return { deliveries };
    });
  });
}

function csvEscape(s: string): string {
  let safe = s;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
