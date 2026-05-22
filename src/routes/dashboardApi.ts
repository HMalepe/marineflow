import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from './auth.js';
import { earnStampForCompletedVisit } from '../services/loyalty.js';
import { refundPaymentStaff } from '../services/payments.js';

export async function dashboardApiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    await requireAuth(request, reply);
  });

  app.get('/me', async (request) => {
    const u = request.user as { sub: string };
    const user = await prisma.staffUser.findUniqueOrThrow({
      where: { id: u.sub },
      select: { id: true, email: true, name: true, role: true, salonId: true },
    });
    return { user };
  });

  app.get('/appointments/today', async (request) => {
    const u = request.user as { sub: string; salonId: string };
    const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const rows = await prisma.appointment.findMany({
      where: {
        salonId: user.salonId,
        start: { gte: start, lt: end },
        status: { not: 'CANCELLED' },
      },
      include: { service: true, staff: true, customer: true },
      orderBy: { start: 'asc' },
    });
    return { appointments: rows };
  });

  app.get('/appointments', async (request) => {
    const u = request.user as { sub: string };
    const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
    const q = request.query as { from?: string; to?: string };
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 7 * 86400000);
    const to = q.to ? new Date(q.to) : new Date(Date.now() + 30 * 86400000);

    const rows = await prisma.appointment.findMany({
      where: {
        salonId: user.salonId,
        start: { gte: from, lte: to },
      },
      include: { service: true, staff: true, customer: true },
      orderBy: { start: 'asc' },
      take: 500,
    });
    return { appointments: rows };
  });

  app.post<{ Params: { id: string } }>(
    '/appointments/:id/complete',
    { preHandler: requireRole('OWNER', 'MANAGER', 'STYLIST') },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
      const appt = await prisma.appointment.findFirst({
        where: { id: request.params.id, salonId: user.salonId },
        include: { service: true },
      });
      if (!appt) return reply.code(404).send({ error: 'not_found' });

      await prisma.appointment.update({
        where: { id: appt.id },
        data: { status: 'COMPLETED' },
      });

      await earnStampForCompletedVisit({
        salonId: appt.salonId,
        customerId: appt.customerId,
        appointmentId: appt.id,
        service: appt.service,
      });

      await prisma.analyticsEvent.create({
        data: {
          salonId: appt.salonId,
          customerId: appt.customerId,
          appointmentId: appt.id,
          staffId: appt.staffId,
          type: 'appointment_completed_dashboard',
        },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'appointment_complete',
          entity: 'Appointment',
          entityId: appt.id,
        },
      });

      return { ok: true };
    },
  );

  app.post<{ Params: { id: string }; Body: { csat?: number } }>(
    '/appointments/:id/csat',
    async (request, reply) => {
      const u = request.user as { sub: string };
      const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
      const score = request.body?.csat;
      if (typeof score !== 'number' || score < 1 || score > 5) {
        return reply.code(400).send({ error: 'invalid_csat' });
      }
      const appt = await prisma.appointment.findFirst({
        where: { id: request.params.id, salonId: user.salonId },
      });
      if (!appt) return reply.code(404).send({ error: 'not_found' });

      await prisma.analyticsEvent.create({
        data: {
          salonId: appt.salonId,
          customerId: appt.customerId,
          appointmentId: appt.id,
          type: 'csat',
          payload: { score },
        },
      });
      return { ok: true };
    },
  );

  app.get('/tickets', async (request) => {
    const u = request.user as { sub: string };
    const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
    const tickets = await prisma.ticket.findMany({
      where: { salonId: user.salonId },
      include: { customer: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return { tickets };
  });

  app.patch<{ Params: { id: string }; Body: { status?: string; assigneeStaffUserId?: string | null } }>(
    '/tickets/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
      const t = await prisma.ticket.findFirst({
        where: { id: request.params.id, salonId: user.salonId },
      });
      if (!t) return reply.code(404).send({ error: 'not_found' });
      const updated = await prisma.ticket.update({
        where: { id: t.id },
        data: {
          status: request.body.status as never,
          assigneeStaffUserId: request.body.assigneeStaffUserId,
        },
      });
      return { ticket: updated };
    },
  );

  app.get('/faq', async (request) => {
    const u = request.user as { sub: string };
    const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
    const items = await prisma.faqItem.findMany({
      where: { salonId: user.salonId },
      orderBy: { sortOrder: 'asc' },
    });
    return { items };
  });

  app.post<{ Body: { question: string; answer: string; keywords?: string[] } }>(
    '/faq',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
      const { question, answer } = request.body;
      if (!question?.trim() || !answer?.trim()) {
        return reply.code(400).send({ error: 'invalid' });
      }
      const item = await prisma.faqItem.create({
        data: {
          salonId: user.salonId,
          question: question.trim(),
          answer: answer.trim(),
          keywords: request.body.keywords ?? [],
        },
      });
      return { item };
    },
  );

  app.get('/reports/summary', async (request) => {
    const u = request.user as { sub: string };
    const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
    const since = new Date(Date.now() - 30 * 86400000);
    const [appts, revenue] = await Promise.all([
      prisma.appointment.groupBy({
        by: ['status'],
        where: { salonId: user.salonId, createdAt: { gte: since } },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: {
          salonId: user.salonId,
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

  app.get('/export/appointments.csv', async (request, reply) => {
    const u = request.user as { sub: string };
    const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
    const q = request.query as { from?: string; to?: string };
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400000);
    const to = q.to ? new Date(q.to) : new Date();

    const rows = await prisma.appointment.findMany({
      where: { salonId: user.salonId, start: { gte: from, lte: to } },
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

  app.get('/export/payments.csv', async (request, reply) => {
    const u = request.user as { sub: string };
    const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
    const q = request.query as { from?: string; to?: string };
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400000);
    const to = q.to ? new Date(q.to) : new Date();

    const rows = await prisma.payment.findMany({
      where: { salonId: user.salonId, createdAt: { gte: from, lte: to } },
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

  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/payments/:id/refund',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
      const reason = request.body?.reason?.trim();
      if (!reason) return reply.code(400).send({ error: 'reason_required' });
      try {
        await refundPaymentStaff({
          paymentId: request.params.id,
          actorUserId: user.id,
          reason,
        });
      } catch {
        return reply.code(400).send({ error: 'refund_failed' });
      }
      return { ok: true };
    },
  );

  app.get('/audit', { preHandler: requireRole('OWNER') }, async (request) => {
    const u = request.user as { sub: string };
    const user = await prisma.staffUser.findUniqueOrThrow({ where: { id: u.sub } });
    const logs = await prisma.auditLog.findMany({
      where: {
        actor: { salonId: user.salonId },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { logs };
  });
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
