import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { requireAuth, requireRole } from './auth.js';
import { validateStrongPassword } from '../lib/salonPhoneLookup.js';
import { withUserTenant } from '../lib/db/withUserTenant.js';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { earnStampForCompletedVisit } from '../services/loyalty.js';
import { refundPaymentStaff } from '../services/payments.js';
import { fuzzySearchCustomers } from '../services/customerSearch.js';
import { sendWithFallback } from '../services/channelRouter.js';
import { MessageDirection, ConversationStep } from '@prisma/client';
import { emitMessageReceived } from '../lib/eventBus.js';
import {
  getPlans,
  getSalonSubscription,
  createPayfastSubscription,
  cancelSubscription,
  checkQuota,
} from '../services/subscription.js';
import { billingReturnUrl, resolveDashboardOrigin } from '../lib/billingUrls.js';
import {
  generatePresignedUpload,
  confirmUpload,
  listUploads,
  deleteUpload,
} from '../services/uploads.js';
import { exportCustomerData, eraseCustomerData } from '../services/compliance.js';
import { generateWebhookSecret } from '../services/webhookDelivery.js';
import { embedFaqItem } from '../services/knowledge.js';
import type { FaqStatus } from '@prisma/client';
import {
  setMarketingConsent,
  parseMarketingConsentStatus,
} from '../services/marketingConsent.js';

export type MarketingConsentStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';
import {
  cancelCampaign,
  countAudience,
  countOptedInCustomers,
  createCampaign,
  getCampaign,
  listCampaigns,
  listCustomerTags,
  queueCampaignSend,
  serializeCampaign,
  parseCampaignMediaType,
  validateCampaignMedia,
  updateCampaign,
  type AudienceFilter,
} from '../services/campaigns.js';
import { claudeJson, isAnthropicConfigured } from '../lib/integrations/ai/claude.js';

type FaqApiStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

function faqToApiStatus(status: FaqStatus): FaqApiStatus {
  if (status === 'APPROVED') return 'APPROVED';
  if (status === 'ARCHIVED') return 'REJECTED';
  return 'PENDING';
}

function faqFromApiStatus(status: FaqApiStatus): FaqStatus {
  if (status === 'APPROVED') return 'APPROVED';
  if (status === 'REJECTED') return 'ARCHIVED';
  return 'DRAFT';
}

function serializeFaq(item: {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  status: FaqStatus;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    sortOrder: item.sortOrder,
    status: faqToApiStatus(item.status),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function dashboardApiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    await requireAuth(request, reply);
  });

  app.patch('/me/name', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { name } = request.body as { name?: string };
      const trimmed = name?.trim();
      if (!trimmed || trimmed.length < 2 || trimmed.length > 80) {
        return reply.code(400).send({ error: 'invalid_name' });
      }
      const db = getTenantDb();
      const u = await db.staffUser.update({
        where: { id: user.sub },
        data: { name: trimmed },
        select: { id: true, email: true, name: true, role: true, salonId: true },
      });
      return { user: u };
    });
  });

  app.patch('/me/email', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { email } = request.body as { email?: string };
      const trimmed = email?.trim().toLowerCase();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return reply.code(400).send({ error: 'invalid_email' });
      }
      const db = getTenantDb();
      const u = await db.staffUser.update({
        where: { id: user.sub },
        data: { email: trimmed },
        select: { id: true, email: true, name: true, role: true, salonId: true },
      });
      return { user: u };
    });
  });

  app.post('/me/change-password', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { currentPassword, newPassword } = request.body as {
        currentPassword?: string;
        newPassword?: string;
      };
      if (!currentPassword || !newPassword) {
        return reply.code(400).send({ error: 'fields_required' });
      }
      const passwordError = validateStrongPassword(newPassword);
      if (passwordError) {
        return reply.code(400).send({ error: 'weak_password', message: passwordError });
      }
      const db = getTenantDb();
      const u = await db.staffUser.findUniqueOrThrow({
        where: { id: user.sub },
        select: { passwordHash: true },
      });
      const ok = await bcrypt.compare(currentPassword, u.passwordHash);
      if (!ok) {
        return reply.code(401).send({ error: 'wrong_current_password' });
      }
      const hash = await bcrypt.hash(newPassword, 12);
      await db.staffUser.update({ where: { id: user.sub }, data: { passwordHash: hash } });
      await db.auditLog.create({
        data: {
          salonId: user.salonId,
          actorUserId: user.sub,
          action: 'PASSWORD_CHANGED',
          entity: 'StaffUser',
          entityId: user.sub,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        },
      });
      return { ok: true };
    });
  });

  app.get('/me', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const u = await db.staffUser.findUniqueOrThrow({
        where: { id: user.sub },
        select: { id: true, email: true, name: true, role: true, salonId: true },
      });
      const salon = await db.salon.findUniqueOrThrow({
        where: { id: user.salonId },
        select: { name: true, tradingName: true },
      });
      const displayName = salon.tradingName?.trim() || salon.name;
      return {
        user: u,
        salon: { displayName, whatsappName: salon.name },
      };
    });
  });

  app.get('/settings', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const salon = await db.salon.findUniqueOrThrow({
        where: { id: user.salonId },
        select: {
          id: true,
          name: true,
          tradingName: true,
          logoUrl: true,
          timezone: true,
          openTime: true,
          closeTime: true,
          welcomeMessage: true,
          afterHoursMessage: true,
          status: true,
          botName: true,
          botAskMarketingConsent: true,
          botAllowStaffPick: true,
          botLoyaltyEnabled: true,
          botRequireDepositStep: true,
          inactivityMessage1: true,
          inactivityMessage1DelayMin: true,
          inactivityMessage2: true,
          inactivityMessage2DelayMin: true,
          closingMessage: true,
        },
      });
      return {
        salon: {
          ...salon,
          botActive: salon.status === 'ACTIVE',
        },
      };
    });
  });

  app.patch<{
    Body: {
      tradingName?: string | null;
      openTime?: string;
      closeTime?: string;
      timezone?: string;
      welcomeMessage?: string | null;
      afterHoursMessage?: string | null;
      logoUrl?: string | null;
      botActive?: boolean;
      status?: 'ACTIVE' | 'SUSPENDED';
      botName?: string;
      botAskMarketingConsent?: boolean;
      botAllowStaffPick?: boolean;
      botLoyaltyEnabled?: boolean;
      botRequireDepositStep?: boolean;
      inactivityMessage1?: string | null;
      inactivityMessage1DelayMin?: number;
      inactivityMessage2?: string | null;
      inactivityMessage2DelayMin?: number;
      closingMessage?: string | null;
    };
  }>(
    '/settings',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const {
          tradingName,
          logoUrl,
          openTime,
          closeTime,
          timezone,
          welcomeMessage,
          afterHoursMessage,
          botActive,
          status,
          botName,
          botAskMarketingConsent,
          botAllowStaffPick,
          botLoyaltyEnabled,
          botRequireDepositStep,
          inactivityMessage1,
          inactivityMessage1DelayMin,
          inactivityMessage2,
          inactivityMessage2DelayMin,
          closingMessage,
        } = request.body;

        if (logoUrl !== undefined && logoUrl !== null) {
          const maxBytes = 600_000; // ~600KB base64 → ~450KB image — enough for any logo
          if (logoUrl.length > maxBytes) {
            reply.code(400);
            return { error: 'logo_too_large' };
          }
          if (!logoUrl.startsWith('data:image/') && !/^https?:\/\//.test(logoUrl)) {
            reply.code(400);
            return { error: 'invalid_logo_url' };
          }
        }

        if (tradingName !== undefined && tradingName !== null && !tradingName.trim()) {
          reply.code(400);
          return { error: 'invalid_trading_name' };
        }

        const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (openTime !== undefined && !timeRe.test(openTime)) {
          reply.code(400);
          return { error: 'invalid_open_time' };
        }
        if (closeTime !== undefined && !timeRe.test(closeTime)) {
          reply.code(400);
          return { error: 'invalid_close_time' };
        }
        if (timezone !== undefined && !timezone.trim()) {
          reply.code(400);
          return { error: 'invalid_timezone' };
        }
        if (botName !== undefined) {
          const trimmed = botName.trim();
          if (!trimmed || trimmed.length < 2 || trimmed.length > 40) {
            reply.code(400);
            return { error: 'invalid_bot_name' };
          }
        }

        let nextStatus = status;
        if (botActive !== undefined) {
          nextStatus = botActive ? 'ACTIVE' : 'SUSPENDED';
        }

        const updated = await db.salon.update({
          where: { id: user.salonId },
          data: {
            ...(tradingName !== undefined && {
              tradingName: tradingName?.trim() || null,
            }),
            ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
            ...(openTime !== undefined && { openTime }),
            ...(closeTime !== undefined && { closeTime }),
            ...(timezone !== undefined && { timezone: timezone.trim() }),
            ...(welcomeMessage !== undefined && { welcomeMessage: welcomeMessage?.trim() || null }),
            ...(afterHoursMessage !== undefined && {
              afterHoursMessage: afterHoursMessage?.trim() || null,
            }),
            ...(botName !== undefined && { botName: botName.trim() }),
            ...(botAskMarketingConsent !== undefined && { botAskMarketingConsent }),
            ...(botAllowStaffPick !== undefined && { botAllowStaffPick }),
            ...(botLoyaltyEnabled !== undefined && { botLoyaltyEnabled }),
            ...(botRequireDepositStep !== undefined && { botRequireDepositStep }),
            ...(inactivityMessage1 !== undefined && { inactivityMessage1: inactivityMessage1?.trim() || null }),
            ...(inactivityMessage1DelayMin !== undefined && { inactivityMessage1DelayMin }),
            ...(inactivityMessage2 !== undefined && { inactivityMessage2: inactivityMessage2?.trim() || null }),
            ...(inactivityMessage2DelayMin !== undefined && { inactivityMessage2DelayMin }),
            ...(closingMessage !== undefined && { closingMessage: closingMessage?.trim() || null }),
            ...(nextStatus !== undefined && {
              status: nextStatus,
              statusChangedAt: new Date(),
            }),
          },
          select: {
            id: true,
            name: true,
            tradingName: true,
            logoUrl: true,
            timezone: true,
            openTime: true,
            closeTime: true,
            welcomeMessage: true,
            afterHoursMessage: true,
            status: true,
            botName: true,
            botAskMarketingConsent: true,
            botAllowStaffPick: true,
            botLoyaltyEnabled: true,
            botRequireDepositStep: true,
            inactivityMessage1: true,
            inactivityMessage1DelayMin: true,
            inactivityMessage2: true,
            inactivityMessage2DelayMin: true,
            closingMessage: true,
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'settings_update',
            entity: 'Salon',
            entityId: user.salonId,
          },
        });

        return {
          salon: {
            ...updated,
            botActive: updated.status === 'ACTIVE',
          },
        };
      });
    },
  );

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

  // ─── Roster ──────────────────────────────────────────────────────────────

  app.get('/roster', { preHandler: requireRole('OWNER', 'MANAGER') }, async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as { from?: string; to?: string };

      // Validate and clamp date range — bad/missing params fall back to current week
      const parseDate = (s: string | undefined, fallback: Date): Date => {
        if (!s) return fallback;
        const d = new Date(s);
        return isNaN(d.getTime()) ? fallback : d;
      };
      const now  = new Date();
      const from = parseDate(q.from, now);
      const to   = parseDate(q.to, new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000));

      // Hard cap: never return more than 31 days in one call
      const maxTo = new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
      const clampedTo = to > maxTo ? maxTo : to;

      const staff = await db.staff.findMany({
        where: { deletedAt: null },
        include: {
          workingHours: true,
          timeOff: {
            where: { start: { lte: clampedTo }, end: { gte: from } },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      return {
        staff: staff.map((s) => ({
          id: s.id,
          name: s.name,
          displayName: s.displayName,
          avatarUrl: s.avatarUrl,
          active: s.active,
          isBookable: s.isBookable,
          workingHours: s.workingHours.map((wh) => ({
            id: wh.id,
            weekday: wh.weekday,
            startTime: wh.startTime,
            endTime: wh.endTime,
          })),
          // Return YYYY-MM-DD using UTC date parts — dates stored as midnight UTC in DB
          timeOff: s.timeOff.map((t) => ({
            id: t.id,
            start: t.start.toISOString().slice(0, 10),
            end:   t.end.toISOString().slice(0, 10),
            reason: t.reason ?? null,
          })),
        })),
      };
    });
  });

  app.post<{ Params: { id: string }; Body: { start: string; end: string; reason?: string } }>(
    '/staff/:id/time-off',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { id } = request.params;
        const { start, end, reason } = request.body;

        if (!start || !end) {
          reply.code(400);
          return { error: 'missing_fields', message: 'start and end are required.' };
        }

        const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
        if (!ISO_RE.test(start) || !ISO_RE.test(end)) {
          reply.code(400);
          return { error: 'invalid_dates', message: 'Use YYYY-MM-DD format.' };
        }

        const startDate = new Date(`${start}T00:00:00.000Z`);
        const endDate   = new Date(`${end}T00:00:00.000Z`);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          reply.code(400);
          return { error: 'invalid_dates', message: 'Invalid date value.' };
        }
        if (startDate > endDate) {
          reply.code(400);
          return { error: 'invalid_range', message: 'Start date must be on or before end date.' };
        }
        const diffDays = (endDate.getTime() - startDate.getTime()) / 86_400_000;
        if (diffDays > 180) {
          reply.code(400);
          return { error: 'range_too_large', message: 'Time-off range cannot exceed 180 days.' };
        }

        // Confirm staff belongs to this salon
        const staff = await db.staff.findFirst({
          where: { id, salonId: user.salonId, deletedAt: null },
        });
        if (!staff) {
          reply.code(404);
          return { error: 'not_found', message: 'Staff member not found.' };
        }

        const timeOff = await db.timeOff.create({
          data: { staffId: id, start: startDate, end: endDate, reason: reason?.trim() || null },
        });

        return {
          timeOff: {
            id:     timeOff.id,
            start:  timeOff.start.toISOString().slice(0, 10),
            end:    timeOff.end.toISOString().slice(0, 10),
            reason: timeOff.reason ?? null,
          },
        };
      });
    },
  );

  app.delete<{ Params: { id: string; timeOffId: string } }>(
    '/staff/:id/time-off/:timeOffId',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { id, timeOffId } = request.params;

        // Join on salonId so one tenant can't delete another's records
        const existing = await db.timeOff.findFirst({
          where: { id: timeOffId, staffId: id, staff: { salonId: user.salonId } },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found', message: 'Time-off record not found.' };
        }

        await db.timeOff.delete({ where: { id: timeOffId } });
        return { ok: true };
      });
    },
  );

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
        marketingConsent: customer.marketingConsent,
        marketingConsentStatus: customer.marketingConsentStatus,
        marketingConsentAt: customer.marketingConsentAt?.toISOString() ?? null,
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

  app.patch<{
    Params: { id: string };
    Body: {
      tags?: string[];
      notes?: string;
      marketingConsent?: boolean;
      marketingConsentStatus?: MarketingConsentStatus;
      preferredStaffId?: string | null;
    };
  }>(
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

        if (request.body.marketingConsentStatus !== undefined) {
          const status = parseMarketingConsentStatus(request.body.marketingConsentStatus);
          if (!status) {
            reply.code(400);
            return {
              error: 'invalid_consent_status',
              message: 'Marketing consent status must be PENDING, ACCEPTED, or DECLINED.',
            };
          }
          await setMarketingConsent({
            customerId: existing.id,
            salonId: user.salonId,
            status,
            source: 'dashboard',
          });
        } else if (request.body.marketingConsent !== undefined) {
          await setMarketingConsent({
            customerId: existing.id,
            salonId: user.salonId,
            status: request.body.marketingConsent ? 'ACCEPTED' : 'DECLINED',
            source: 'dashboard',
          });
        }

        const patchData = { ...data };

        if (Object.keys(patchData).length > 0) {
          await db.customer.update({ where: { id: existing.id }, data: patchData });
        }

        const finalCustomer = await db.customer.findUniqueOrThrow({ where: { id: existing.id } });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'customer_update',
            entity: 'Customer',
            entityId: existing.id,
            payload: {
              ...patchData,
              ...(request.body.marketingConsentStatus !== undefined ||
              request.body.marketingConsent !== undefined
                ? { marketingConsentStatus: finalCustomer.marketingConsentStatus }
                : {}),
            } as unknown as Record<string, string | number | boolean | null>,
          },
        });

        return { customer: finalCustomer };
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

  // ── Service CRUD ────────────────────────────────────────────

  app.get('/services', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const services = await db.service.findMany({
        where: { deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return { services };
    });
  });

  app.post<{
    Body: {
      name: string;
      description?: string;
      priceCents: number;
      durationMin: number;
      bufferMin?: number;
      active?: boolean;
    };
  }>(
    '/services',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { name, description, priceCents, durationMin, bufferMin, active } = request.body;
        if (!name?.trim()) {
          reply.code(400);
          return { error: 'name_required' };
        }
        if (!Number.isFinite(priceCents) || priceCents < 0) {
          reply.code(400);
          return { error: 'invalid_price' };
        }
        if (!Number.isFinite(durationMin) || durationMin < 1) {
          reply.code(400);
          return { error: 'invalid_duration' };
        }

        const service = await db.service.create({
          data: {
            salonId: user.salonId,
            name: name.trim(),
            description: description?.trim() || null,
            priceCents: Math.round(priceCents),
            durationMin: Math.round(durationMin),
            bufferMin: Math.round(bufferMin ?? 0),
            active: active ?? true,
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'service_create',
            entity: 'Service',
            entityId: service.id,
          },
        });

        return { service };
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string | null;
      priceCents?: number;
      durationMin?: number;
      bufferMin?: number;
      active?: boolean;
    };
  }>(
    '/services/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.service.findFirst({
          where: { id: request.params.id, deletedAt: null },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        const { name, description, priceCents, durationMin, bufferMin, active } = request.body;
        if (name !== undefined && !name.trim()) {
          reply.code(400);
          return { error: 'name_required' };
        }
        if (priceCents !== undefined && (!Number.isFinite(priceCents) || priceCents < 0)) {
          reply.code(400);
          return { error: 'invalid_price' };
        }
        if (durationMin !== undefined && (!Number.isFinite(durationMin) || durationMin < 1)) {
          reply.code(400);
          return { error: 'invalid_duration' };
        }

        const updated = await db.service.update({
          where: { id: existing.id },
          data: {
            ...(name !== undefined && { name: name.trim() }),
            ...(description !== undefined && { description: description?.trim() || null }),
            ...(priceCents !== undefined && { priceCents: Math.round(priceCents) }),
            ...(durationMin !== undefined && { durationMin: Math.round(durationMin) }),
            ...(bufferMin !== undefined && { bufferMin: Math.round(bufferMin) }),
            ...(active !== undefined && { active }),
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'service_update',
            entity: 'Service',
            entityId: existing.id,
          },
        });

        return { service: updated };
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/services/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.service.findFirst({
          where: { id: request.params.id, deletedAt: null },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        const apptCount = await db.appointment.count({
          where: { serviceId: existing.id, status: { notIn: ['CANCELLED'] } },
        });
        if (apptCount > 0) {
          await db.service.update({
            where: { id: existing.id },
            data: { active: false },
          });
          await db.auditLog.create({
            data: {
              salonId: user.salonId,
              actorUserId: user.sub,
              action: 'service_deactivate',
              entity: 'Service',
              entityId: existing.id,
              payload: { reason: 'has_appointments' },
            },
          });
          return { ok: true, deactivated: true };
        }

        await db.service.update({
          where: { id: existing.id },
          data: { deletedAt: new Date(), active: false },
        });
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'service_delete',
            entity: 'Service',
            entityId: existing.id,
          },
        });
        return { ok: true };
      });
    },
  );

  // ── FAQ CRUD ────────────────────────────────────────────────

  app.get('/faqs', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const items = await db.faqItem.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      return { faqs: items.map(serializeFaq) };
    });
  });

  app.post<{
    Body: { question: string; answer: string; sortOrder?: number };
  }>(
    '/faqs',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { question, answer, sortOrder } = request.body;
        if (!question?.trim() || !answer?.trim()) {
          reply.code(400);
          return { error: 'question_and_answer_required' };
        }

        let order = sortOrder;
        if (order === undefined || !Number.isFinite(order)) {
          const max = await db.faqItem.aggregate({ _max: { sortOrder: true } });
          order = (max._max.sortOrder ?? -1) + 1;
        }

        const item = await db.faqItem.create({
          data: {
            salonId: user.salonId,
            question: question.trim(),
            answer: answer.trim(),
            sortOrder: Math.round(order),
            status: 'DRAFT',
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'faq_create',
            entity: 'FaqItem',
            entityId: item.id,
          },
        });

        return { faq: serializeFaq(item) };
      });
    },
  );

  // ─── FAQ Smart Approve (must be before /faqs/:id to avoid param capture) ─
  app.post(
    '/faqs/smart-approve',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const pending = await db.faqItem.findMany({
          where: { salonId: user.salonId, status: faqFromApiStatus('PENDING') },
          select: { id: true, question: true, answer: true },
        });

        if (pending.length === 0) {
          return { results: [], message: 'No pending FAQs to review' };
        }

        // ── Phase 1: free regex check ──────────────────────────────────
        const PLACEHOLDER_RE = /\[(?!e\.g\.\s*\d|\d)[^\]]{2,}\]/i;
        const GENERIC_PHRASES = ['e.g.', '[e.g.', 'route name', 'route number', 'your business'];

        type Decision = { id: string; question: string; decision: 'approve' | 'needs_edit'; reason: string };
        const results: Decision[] = [];
        const needsAi: typeof pending = [];

        for (const faq of pending) {
          const combined = `${faq.question} ${faq.answer}`;
          const hasPlaceholder = PLACEHOLDER_RE.test(combined);
          const hasGeneric = GENERIC_PHRASES.some((p) => combined.toLowerCase().includes(p.toLowerCase()));

          if (hasPlaceholder || hasGeneric) {
            results.push({
              id: faq.id,
              question: faq.question,
              decision: 'needs_edit',
              reason: 'Contains unfilled placeholder text',
            });
          } else if (faq.answer.trim().length < 15) {
            results.push({
              id: faq.id,
              question: faq.question,
              decision: 'needs_edit',
              reason: 'Answer is too short',
            });
          } else {
            needsAi.push(faq);
          }
        }

        // ── Phase 2: one batched Haiku call for borderline FAQs ────────
        if (needsAi.length > 0 && isAnthropicConfigured()) {
          const numbered = needsAi
            .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer.slice(0, 300)}`)
            .join('\n\n');

          const aiResult = await claudeJson<{ results: Array<{ index: number; decision: 'approve' | 'needs_edit'; reason: string }> }>({
            system:
              'You review WhatsApp chatbot FAQ entries for a small business. ' +
              'Decide if each FAQ is complete and ready to use (approve) or needs editing (needs_edit). ' +
              'Flag needs_edit if: answer is vague/generic, clearly unfinished, or looks like a template not filled in. ' +
              'Approve if: the answer gives real, useful information a customer could act on. ' +
              'Be lenient — if it looks like genuine business content, approve it. ' +
              'Respond ONLY with JSON: {"results":[{"index":1,"decision":"approve","reason":"..."},...]}',
            user: `Review these ${needsAi.length} FAQ(s):\n\n${numbered}`,
            maxTokens: 600,
            model: 'claude-haiku-4-5-20251001',
          });

          if (aiResult?.results) {
            for (const r of aiResult.results) {
              const faq = needsAi[r.index - 1];
              if (faq) {
                results.push({ id: faq.id, question: faq.question, decision: r.decision, reason: r.reason });
              }
            }
          } else {
            for (const faq of needsAi) {
              results.push({ id: faq.id, question: faq.question, decision: 'approve', reason: 'Passed basic checks' });
            }
          }
        } else {
          for (const faq of needsAi) {
            results.push({ id: faq.id, question: faq.question, decision: 'approve', reason: 'Passed basic checks' });
          }
        }

        // ── Phase 3: apply approvals ──────────────────────────────────
        const { apply } = request.query as { apply?: string };
        if (apply === '1') {
          const toApprove = results.filter((r) => r.decision === 'approve').map((r) => r.id);
          if (toApprove.length > 0) {
            await db.faqItem.updateMany({
              where: { id: { in: toApprove }, salonId: user.salonId },
              data: { status: 'APPROVED' },
            });
          }
        }

        const approveCount = results.filter((r) => r.decision === 'approve').length;
        const needsEditCount = results.filter((r) => r.decision === 'needs_edit').length;
        return {
          results,
          summary: { total: results.length, approve: approveCount, needsEdit: needsEditCount },
          applied: apply === '1',
        };
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      question?: string;
      answer?: string;
      sortOrder?: number;
      status?: FaqApiStatus;
    };
  }>(
    '/faqs/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.faqItem.findFirst({
          where: { id: request.params.id },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        const { question, answer, sortOrder, status } = request.body;
        if (question !== undefined && !question.trim()) {
          reply.code(400);
          return { error: 'question_required' };
        }
        if (answer !== undefined && !answer.trim()) {
          reply.code(400);
          return { error: 'answer_required' };
        }
        if (status !== undefined && !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
          reply.code(400);
          return { error: 'invalid_status' };
        }

        const dbStatus = status !== undefined ? faqFromApiStatus(status) : undefined;
        const updated = await db.faqItem.update({
          where: { id: existing.id },
          data: {
            ...(question !== undefined && { question: question.trim() }),
            ...(answer !== undefined && { answer: answer.trim() }),
            ...(sortOrder !== undefined && { sortOrder: Math.round(sortOrder) }),
            ...(dbStatus !== undefined && {
              status: dbStatus,
              approvedAt: dbStatus === 'APPROVED' ? new Date() : null,
              approvedBy: dbStatus === 'APPROVED' ? user.sub : null,
            }),
          },
        });

        if (dbStatus === 'APPROVED') {
          try {
            await embedFaqItem(updated.id, user.salonId);
          } catch {
            // Embedding is best-effort; FAQ still saved
          }
        } else if (dbStatus === 'ARCHIVED' || dbStatus === 'DRAFT') {
          await db.faqEmbedding.deleteMany({ where: { faqItemId: updated.id } });
        } else if (
          dbStatus === undefined &&
          (question !== undefined || answer !== undefined) &&
          existing.status === 'APPROVED'
        ) {
          try {
            await embedFaqItem(updated.id, user.salonId);
          } catch {
            // best-effort re-embed after content edit
          }
        }

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'faq_update',
            entity: 'FaqItem',
            entityId: existing.id,
            payload: status ? { status } : undefined,
          },
        });

        return { faq: serializeFaq(updated) };
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/faqs/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.faqItem.findFirst({
          where: { id: request.params.id },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        await db.faqItem.delete({ where: { id: existing.id } });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'faq_delete',
            entity: 'FaqItem',
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

  app.post(
    '/subscription/checkout',
    { preHandler: requireRole('OWNER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { planTier, billingCycle } = request.body as {
          planTier: string;
          billingCycle: 'monthly' | 'annual';
        };

        if (!planTier || !['monthly', 'annual'].includes(billingCycle)) {
          reply.code(400);
          return { error: 'invalid_input' };
        }

        const dashboardOrigin = resolveDashboardOrigin(request.headers.origin);

        const result = await createPayfastSubscription({
          salonId: user.salonId,
          planTier,
          billingCycle,
          returnUrl: billingReturnUrl(dashboardOrigin, 'success'),
          cancelUrl: billingReturnUrl(dashboardOrigin, 'cancelled'),
          notifyUrl: `${process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000'}/webhooks/payfast/subscription`,
        });

        if (!result.ok) {
          const status = result.error === 'payfast_not_configured' ? 503 : 400;
          reply.code(status);
          return { error: result.error };
        }

        return {
          url: result.url,
          formData: result.formData,
          summary: result.summary,
        };
      });
    },
  );

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
        return { ok: true, alreadyScheduled: 'alreadyScheduled' in result ? result.alreadyScheduled : false };
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

      const purposeValue = purpose ?? 'general';
      if (purposeValue === 'campaign') {
        const allowed = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'video/mp4',
          'video/quicktime',
        ];
        if (!allowed.includes(mimeType)) {
          reply.code(400);
          return {
            error: 'invalid_campaign_media',
            message: 'Newsletter media must be JPEG, PNG, WebP, or MP4 video.',
          };
        }
      }

      const result = await generatePresignedUpload(
        user.salonId,
        filename,
        mimeType,
        purposeValue,
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

  // ─── Conversation / Human-Handoff Management ────────────────────────────
  // These routes let staff reply to customers directly, take over a conversation
  // from the bot, or release it back to the bot.

  /** List all conversations, HANDOFF ones first so staff see what needs attention. */
  app.get('/conversations', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const q = request.query as { step?: string; limit?: string; offset?: string };
      const take = Math.min(Number(q.limit) || 50, 200);
      const skip = Number(q.offset) || 0;

      const where: Record<string, unknown> = { salonId: user.salonId };
      if (q.step) where.step = q.step;

      const convs = await db.conversation.findMany({
        where,
        orderBy: [
          // Surface HANDOFF convos first so staff see escalations immediately
          { step: 'asc' },
          { lastMessageAt: 'desc' },
        ],
        take,
        skip,
        include: {
          customer: { select: { id: true, waId: true, displayName: true, firstName: true, lastName: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      return {
        conversations: convs.map((c) => ({
          id: c.id,
          step: c.step,
          lastMessageAt: c.lastMessageAt,
          isHandoff: c.step === 'HANDOFF' || c.step === 'CLOSED',
          customer: c.customer,
          lastMessage: c.messages[0] ?? null,
        })),
        total: convs.length,
        take,
        skip,
      };
    });
  });

  /** Full message thread for a conversation (dashboard chat view). */
  app.get<{ Params: { id: string } }>('/conversations/:id/messages', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const conv = await db.conversation.findFirst({
        where: { id: request.params.id },
        include: {
          customer: {
            select: { id: true, waId: true, displayName: true, firstName: true, lastName: true },
          },
        },
      });
      if (!conv) {
        reply.code(404);
        return { error: 'conversation_not_found' };
      }

      const messages = await db.message.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });

      return {
        conversationId: conv.id,
        step: conv.step,
        customer: conv.customer,
        messages: messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          createdAt: m.createdAt,
        })),
      };
    });
  });

  /**
   * Staff sends a WhatsApp message directly to the customer.
   * Keeps the conversation in HANDOFF — the bot will remain silent.
   */
  app.post<{ Params: { id: string }; Body: { body: string } }>(
    '/conversations/:id/reply',
    { preHandler: requireRole('OWNER', 'MANAGER', 'STYLIST') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const body = request.body?.body?.trim();
        if (!body) {
          reply.code(400);
          return { error: 'body_required' };
        }

        const conv = await db.conversation.findFirst({
          where: { id: request.params.id },
          include: { customer: true },
        });
        if (!conv) {
          reply.code(404);
          return { error: 'conversation_not_found' };
        }

        // Send via WhatsApp (same channel router the bot uses)
        let providerSid: string | null = null;
        try {
          const { result } = await sendWithFallback({
            salonId: user.salonId,
            to: conv.customer.waId,
            body,
          });
          providerSid = result.providerMessageId ?? null;
        } catch {
          reply.code(502);
          return { error: 'message_send_failed' };
        }

        // Record as an outbound message from staff
        const message = await db.message.create({
          data: {
            conversationId: conv.id,
            customerId: conv.customerId,
            direction: MessageDirection.OUTBOUND,
            body,
            providerSid,
          },
        });

        await db.conversation.update({
          where: { id: conv.id },
          data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'staff_whatsapp_reply',
            entity: 'Conversation',
            entityId: conv.id,
            payload: { bodyLen: body.length },
          },
        });

        // Let other dashboard tabs see the outbound message in real-time
        emitMessageReceived(user.salonId, conv.customerId, body).catch(() => {});

        return { ok: true, messageId: message.id };
      });
    },
  );

  /**
   * Take over a conversation — moves it to HANDOFF so the bot goes silent.
   * Call this before replying manually so the bot doesn't race you.
   */
  app.post<{ Params: { id: string } }>(
    '/conversations/:id/handoff',
    { preHandler: requireRole('OWNER', 'MANAGER', 'STYLIST') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const conv = await db.conversation.findFirst({ where: { id: request.params.id } });
        if (!conv) {
          reply.code(404);
          return { error: 'conversation_not_found' };
        }

        const existingCtx = (conv.context ?? {}) as Record<string, unknown>;
        await db.conversation.update({
          where: { id: conv.id },
          data: {
            step: ConversationStep.HANDOFF,
            context: { ...existingCtx, handoffByStaff: true } as object,
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'conversation_handoff',
            entity: 'Conversation',
            entityId: conv.id,
          },
        });

        return { ok: true, step: 'HANDOFF' };
      });
    },
  );

  /**
   * Release a conversation back to the bot — resets step to MENU and clears
   * the error counter so the bot greets the customer cleanly next time they text.
   */
  const releaseConversationHandler = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const conv = await db.conversation.findFirst({ where: { id: request.params.id } });
      if (!conv) {
        reply.code(404);
        return { error: 'conversation_not_found' };
      }

      const currentCtx = (conv.context ?? {}) as Record<string, unknown>;
      const cleanCtx = { ...currentCtx };
      delete cleanCtx.errorCount;
      delete cleanCtx.handoffByStaff;

      await db.conversation.update({
        where: { id: conv.id },
        data: {
          step: ConversationStep.MENU,
          context: cleanCtx as object,
        },
      });

      await db.auditLog.create({
        data: {
          salonId: user.salonId,
          actorUserId: user.sub,
          action: 'conversation_release',
          entity: 'Conversation',
          entityId: conv.id,
        },
      });

      return { ok: true, step: 'MENU' };
    });
  };

  app.post<{ Params: { id: string } }>(
    '/conversations/:id/release',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    releaseConversationHandler,
  );

  app.post<{ Params: { id: string } }>(
    '/conversations/:id/handoff/release',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    releaseConversationHandler,
  );

  // ── Marketing campaigns (WhatsApp newsletter) ───────────────

  app.get('/campaigns', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const items = await listCampaigns();
      return { campaigns: items.map(serializeCampaign) };
    });
  });

  app.get('/campaigns/meta', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const [tags, optedInCount] = await Promise.all([
        listCustomerTags(user.salonId),
        countOptedInCustomers(user.salonId),
      ]);
      return { tags, optedInCount };
    });
  });

  app.post<{ Body: { audienceFilter?: AudienceFilter } }>(
    '/campaigns/audience-preview',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const filter = (request.body?.audienceFilter ?? { type: 'all' }) as AudienceFilter;
        const count = await countAudience(user.salonId, filter);
        return { count };
      });
    },
  );

  app.get<{ Params: { id: string } }>('/campaigns/:id', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const item = await getCampaign(request.params.id);
      if (!item) {
        reply.code(404);
        return { error: 'not_found' };
      }
      return { campaign: serializeCampaign(item) };
    });
  });

  app.post<{
    Body: {
      name: string;
      message?: string;
      mediaUrl?: string | null;
      mediaType?: string | null;
      audienceFilter?: AudienceFilter;
      scheduledAt?: string | null;
      sendNow?: boolean;
    };
  }>(
    '/campaigns',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { name, message, mediaUrl, mediaType, audienceFilter, scheduledAt, sendNow } =
          request.body ?? {};
        if (!name?.trim()) {
          reply.code(400);
          return { error: 'name_required', message: 'Add a campaign name.' };
        }

        const trimmedMessage = message?.trim() ?? '';
        const parsedMediaType = mediaUrl ? parseCampaignMediaType(mediaType) : null;
        const mediaError = validateCampaignMedia(mediaUrl ?? null, parsedMediaType);
        if (mediaError) {
          reply.code(400);
          return { error: 'invalid_media', message: mediaError };
        }
        if (!trimmedMessage && !mediaUrl) {
          reply.code(400);
          return {
            error: 'content_required',
            message: 'Add a message, photo, or video for your newsletter.',
          };
        }
        if (trimmedMessage.length > 1024) {
          reply.code(400);
          return { error: 'message_too_long', message: 'Caption must be 1,024 characters or fewer.' };
        }

        let scheduleDate: Date | null = null;
        if (scheduledAt) {
          scheduleDate = new Date(scheduledAt);
          if (Number.isNaN(scheduleDate.getTime())) {
            reply.code(400);
            return { error: 'invalid_schedule', message: 'That date and time is not valid.' };
          }
          if (scheduleDate.getTime() <= Date.now()) {
            reply.code(400);
            return { error: 'schedule_must_be_future', message: 'Schedule time must be in the future.' };
          }
        }

        if (sendNow && scheduleDate) {
          reply.code(400);
          return { error: 'send_now_or_schedule' };
        }

        const audience = audienceFilter ?? { type: 'all' as const };
        const recipientCount = await countAudience(user.salonId, audience);
        if (recipientCount === 0) {
          reply.code(400);
          return { error: 'empty_audience', message: 'No customers match this audience with marketing consent.' };
        }

        const item = await createCampaign({
          salonId: user.salonId,
          name: name.trim(),
          message: trimmedMessage,
          mediaUrl: mediaUrl ?? null,
          mediaType: parsedMediaType,
          audienceFilter: audience,
          scheduledAt: sendNow ? null : scheduleDate,
          createdBy: user.sub,
        });

        await getTenantDb().auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: sendNow ? 'campaign_send_now' : scheduleDate ? 'campaign_schedule' : 'campaign_create',
            entity: 'Campaign',
            entityId: item.id,
          },
        });

        if (sendNow) {
          await queueCampaignSend(item.id, user.salonId);
        }

        return { campaign: serializeCampaign(item) };
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      message?: string;
      mediaUrl?: string | null;
      mediaType?: string | null;
      clearMedia?: boolean;
      audienceFilter?: AudienceFilter;
      scheduledAt?: string | null;
    };
  }>(
    '/campaigns/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const existing = await getCampaign(request.params.id);
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        const { name, message, mediaUrl, mediaType, clearMedia, audienceFilter, scheduledAt } =
          request.body ?? {};
        if (name !== undefined && !name.trim()) {
          reply.code(400);
          return { error: 'name_required', message: 'Add a campaign name.' };
        }

        const nextMessage = message !== undefined ? message.trim() : existing.templateName;
        let nextMediaUrl = existing.mediaUrl;
        let nextMediaType = parseCampaignMediaType(existing.mediaType);

        if (clearMedia) {
          nextMediaUrl = null;
          nextMediaType = null;
        } else if (mediaUrl !== undefined) {
          nextMediaUrl = mediaUrl;
          nextMediaType = mediaUrl ? parseCampaignMediaType(mediaType) : null;
        } else if (mediaType !== undefined && nextMediaUrl) {
          nextMediaType = parseCampaignMediaType(mediaType);
        }

        if (nextMediaUrl && !nextMediaType) {
          reply.code(400);
          return { error: 'invalid_media', message: 'Choose image or video for the attachment.' };
        }
        const mediaError = validateCampaignMedia(nextMediaUrl, nextMediaType);
        if (mediaError) {
          reply.code(400);
          return { error: 'invalid_media', message: mediaError };
        }
        if (!nextMessage && !nextMediaUrl) {
          reply.code(400);
          return {
            error: 'content_required',
            message: 'Add a message, photo, or video for your newsletter.',
          };
        }
        if (nextMessage.length > 1024) {
          reply.code(400);
          return { error: 'message_too_long', message: 'Caption must be 1,024 characters or fewer.' };
        }

        let scheduleDate: Date | null | undefined;
        if (scheduledAt !== undefined) {
          if (scheduledAt === null) {
            scheduleDate = null;
          } else {
            scheduleDate = new Date(scheduledAt);
            if (Number.isNaN(scheduleDate.getTime())) {
              reply.code(400);
              return { error: 'invalid_schedule', message: 'That date and time is not valid.' };
            }
            if (scheduleDate.getTime() <= Date.now()) {
              reply.code(400);
              return { error: 'schedule_must_be_future', message: 'Schedule time must be in the future.' };
            }
          }
        }

        if (audienceFilter) {
          const count = await countAudience(user.salonId, audienceFilter);
          if (count === 0) {
            reply.code(400);
            return { error: 'empty_audience', message: 'No customers match this audience with marketing consent.' };
          }
        }

        try {
          const updated = await updateCampaign(request.params.id, {
            name: name?.trim(),
            message: message !== undefined ? nextMessage : undefined,
            mediaUrl: clearMedia || mediaUrl !== undefined ? nextMediaUrl : undefined,
            mediaType: clearMedia || mediaUrl !== undefined || mediaType !== undefined ? nextMediaType : undefined,
            audienceFilter,
            scheduledAt: scheduleDate,
          });

          await getTenantDb().auditLog.create({
            data: {
              salonId: user.salonId,
              actorUserId: user.sub,
              action: 'campaign_update',
              entity: 'Campaign',
              entityId: updated.id,
            },
          });

          return { campaign: serializeCampaign(updated) };
        } catch (err) {
          if (err instanceof Error && err.message === 'campaign_not_editable') {
            reply.code(409);
            return { error: 'campaign_not_editable', message: 'Only draft or scheduled campaigns can be edited.' };
          }
          throw err;
        }
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/campaigns/:id/send',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const existing = await getCampaign(request.params.id);
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        try {
          await queueCampaignSend(request.params.id, user.salonId);
          await getTenantDb().auditLog.create({
            data: {
              salonId: user.salonId,
              actorUserId: user.sub,
              action: 'campaign_send_now',
              entity: 'Campaign',
              entityId: existing.id,
            },
          });
          return { ok: true, message: 'Campaign queued for sending.' };
        } catch (err) {
          if (err instanceof Error && err.message === 'campaign_not_sendable') {
            reply.code(409);
            return { error: 'campaign_not_sendable', message: 'This campaign has already been sent or cancelled.' };
          }
          throw err;
        }
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/campaigns/:id/cancel',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const existing = await getCampaign(request.params.id);
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        try {
          const updated = await cancelCampaign(request.params.id);
          await getTenantDb().auditLog.create({
            data: {
              salonId: user.salonId,
              actorUserId: user.sub,
              action: 'campaign_cancel',
              entity: 'Campaign',
              entityId: updated.id,
            },
          });
          return { campaign: serializeCampaign(updated) };
        } catch (err) {
          if (err instanceof Error && err.message === 'campaign_not_cancellable') {
            reply.code(409);
            return { error: 'campaign_not_cancellable', message: 'Only draft or scheduled campaigns can be cancelled.' };
          }
          throw err;
        }
      });
    },
  );
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
