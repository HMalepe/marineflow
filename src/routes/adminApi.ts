import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { StaffRole, TenantStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { normalizeLoginPhone } from '../lib/phone.js';
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_BOT_NAME,
  isValidSalonSlug,
} from '../lib/salonDefaults.js';
import { findTwilioSenderByPhone, listTwilioWhatsAppSenders } from '../lib/twilioSenders.js';
import { getPlatformMetrics, getConversationFunnel, checkAlertThresholds } from '../services/observability.js';
import { isIndustryTemplateId } from '../lib/industryTemplates.js';
import { getIndustryTemplate } from '../lib/industryTemplates.js';
import { businessTypeFromIndustryTemplate } from '../lib/labels.js';
import {
  getPlatformInboxUnreadCount,
  listPlatformInboxAlerts,
  listPlatformInboxByCategory,
  updatePlatformAlertStatus,
} from '../services/platformInbox.js';
import {
  getAdminAnalyticsFunnel,
  getAdminAnalyticsOverview,
  getAdminMonthlyReport,
  getAdminNoShowPatterns,
  getAdminStaffRevenue,
  listAnalyticsBusinesses,
} from '../services/adminAnalytics.js';
import { getAdminRevenue } from '../api/admin/revenue.js';
import { getAdminBotHealth } from '../api/admin/bot-health.js';

const BCRYPT_ROUNDS = 12;
const VALID_STATUSES: TenantStatus[] = ['LEAD', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CHURNED'];
const VALID_STAFF_ROLES: StaffRole[] = ['OWNER', 'MANAGER', 'STYLIST', 'RECEPTIONIST', 'VIEWER'];

function stripStaffUser(user: {
  id: string;
  salonId: string;
  email: string;
  phone: string | null;
  name: string;
  role: StaffRole;
  active: boolean;
  createdAt: Date;
  staffId: string | null;
}) {
  return {
    id: user.id,
    salonId: user.salonId,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    staffId: user.staffId,
  };
}

/**
 * Platform admin routes — AdminUser JWT (isAdmin) or StaffUser SUPER_ADMIN JWT.
 */
export async function adminApiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);

  // ─── Admin Login (AdminUser table) ─────────────────────────────────
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

  // ─── Twilio WhatsApp numbers (platform account) ────────────────────
  app.get('/twilio/whatsapp-numbers', async () => {
    const senders = await listTwilioWhatsAppSenders();
    const assigned = await prisma.salon.findMany({
      where: { deletedAt: null, twilioWhatsAppFrom: { not: null } },
      select: { id: true, name: true, twilioWhatsAppFrom: true },
    });

    return {
      numbers: senders.map((s) => ({
        phoneE164: s.phoneE164,
        twilioWhatsAppFrom: s.twilioWhatsAppFrom,
        status: s.status ?? null,
        assignedSalon: assigned.find((a) => a.twilioWhatsAppFrom === s.twilioWhatsAppFrom) ?? null,
      })),
    };
  });

  // ─── Create Salon ──────────────────────────────────────────────────
  app.post('/salons', async (request, reply) => {
    const body = request.body as {
      name?: string;
      slug?: string;
      ownerEmail?: string;
      ownerName?: string;
      ownerPassword?: string;
      ownerPhone?: string;
      timezone?: string;
      currency?: string;
      whatsappNumber?: string;
      industryTemplate?: string;
    };

    const name = body.name?.trim();
    const slug = body.slug?.trim().toLowerCase();
    const ownerEmail = body.ownerEmail?.trim().toLowerCase();
    const ownerName = body.ownerName?.trim();
    const ownerPassword = body.ownerPassword ?? '';

    if (!name || !slug || !ownerEmail || !ownerName) {
      return reply.code(400).send({ error: 'missing_required_fields' });
    }
    if (!body.whatsappNumber?.trim()) {
      return reply.code(400).send({ error: 'whatsapp_number_required' });
    }
    if (!isValidSalonSlug(slug)) {
      return reply.code(400).send({ error: 'invalid_slug_format' });
    }
    if (ownerPassword.length > 0 && ownerPassword.length < 8) {
      return reply.code(400).send({ error: 'password_too_short' });
    }
    if (body.industryTemplate !== undefined && !isIndustryTemplateId(body.industryTemplate.trim())) {
      return reply.code(400).send({ error: 'invalid_industry_template' });
    }

    const existing = await prisma.salon.findUnique({ where: { slug } });
    if (existing) return reply.code(409).send({ error: 'slug_taken' });

    const emailTaken = await prisma.staffUser.findUnique({ where: { email: ownerEmail } });
    if (emailTaken) return reply.code(409).send({ error: 'email_taken' });

    let ownerPhone: string | undefined;
    if (body.ownerPhone?.trim()) {
      ownerPhone = normalizeLoginPhone(body.ownerPhone.trim());
      const phoneTaken = await prisma.staffUser.findUnique({ where: { phone: ownerPhone } });
      if (phoneTaken) return reply.code(409).send({ error: 'phone_taken' });
    }

    const twilioSender = await findTwilioSenderByPhone(body.whatsappNumber.trim());
    if (!twilioSender) {
      return reply.code(400).send({ error: 'whatsapp_not_on_twilio' });
    }

    const alreadyAssigned = await prisma.salon.findFirst({
      where: { deletedAt: null, twilioWhatsAppFrom: twilioSender.twilioWhatsAppFrom },
    });
    if (alreadyAssigned) {
      return reply.code(409).send({ error: 'whatsapp_already_assigned', salonName: alreadyAssigned.name });
    }

    const twilioWhatsAppFrom = twilioSender.twilioWhatsAppFrom;

    const passwordHash = await bcrypt.hash(
      ownerPassword.length >= 8 ? ownerPassword : randomBytes(32).toString('hex'),
      BCRYPT_ROUNDS,
    );

    const result = await prisma.$transaction(async (tx) => {
      const salon = await tx.salon.create({
        data: {
          name,
          slug,
          botName: DEFAULT_BOT_NAME,
          status: 'TRIAL',
          tier: 'starter',
          timezone: body.timezone?.trim() || 'Africa/Johannesburg',
          defaultCurrency: body.currency?.trim().toLowerCase() || 'zar',
          industryTemplate: body.industryTemplate?.trim() || 'salon',
          businessType: businessTypeFromIndustryTemplate(body.industryTemplate?.trim() || 'salon'),
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          ...(twilioWhatsAppFrom && { twilioWhatsAppFrom }),
        },
      });

      for (const h of DEFAULT_BUSINESS_HOURS) {
        await tx.businessHour.create({
          data: { salonId: salon.id, ...h },
        });
      }

      await tx.loyaltyProgram.create({
        data: {
          salonId: salon.id,
          stampsPerReward: 10,
          rewardKind: 'FREE_SERVICE_TIER',
        },
      });

      const user = await tx.staffUser.create({
        data: {
          salonId: salon.id,
          email: ownerEmail,
          name: ownerName,
          passwordHash,
          role: 'OWNER',
          ...(ownerPhone && { phone: ownerPhone }),
        },
      });

      return { salon, user };
    });

    return {
      salon: {
        id: result.salon.id,
        slug: result.salon.slug,
        name: result.salon.name,
        status: result.salon.status,
        tier: result.salon.tier,
        timezone: result.salon.timezone,
        industryTemplate: result.salon.industryTemplate,
        createdAt: result.salon.createdAt,
      },
      user: stripStaffUser(result.user),
    };
  });

  // ─── Salon List ────────────────────────────────────────────────────
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

    const [rows, total] = await Promise.all([
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
          botName: true,
          industryTemplate: true,
          businessType: true,
          createdAt: true,
          trialEndsAt: true,
          _count: {
            select: {
              staffUsers: true,
              customers: true,
              appointments: true,
              branches: true,
              staff: true,
            },
          },
        },
      }),
      prisma.salon.count({ where }),
    ]);

    const salons = rows.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      botName: s.botName,
      status: s.status,
      tier: s.tier,
      industryTemplate: s.industryTemplate,
      businessType: s.businessType,
      createdAt: s.createdAt,
      trialEndsAt: s.trialEndsAt,
      staffUserCount: s._count.staffUsers,
      customerCount: s._count.customers,
      _count: s._count,
    }));

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
            staffUsers: true,
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

  app.get('/salons/:id/summary', async (request, reply) => {
    const { id } = request.params as { id: string };
    const salon = await prisma.salon.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        tier: true,
        botName: true,
        industryTemplate: true,
        businessType: true,
        timezone: true,
        createdAt: true,
        trialEndsAt: true,
        phoneDisplay: true,
        contactEmail: true,
        subscription: {
          select: {
            status: true,
            trialEndsAt: true,
            plan: { select: { name: true, priceMonthly: true } },
          },
        },
        _count: {
          select: {
            staff: true,
            staffUsers: true,
            customers: true,
            appointments: true,
            branches: true,
            services: true,
            conversations: true,
            tickets: true,
            campaigns: true,
          },
        },
      },
    });

    if (!salon) return reply.code(404).send({ error: 'not_found' });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      funnel,
      unreadAlerts,
      appointments7d,
      appointments30d,
      completed7d,
      messages7d,
      staffUsers,
      inbox,
    ] = await Promise.all([
      getConversationFunnel(id),
      prisma.platformAlert.count({ where: { salonId: id, status: 'UNREAD' } }),
      prisma.appointment.count({ where: { salonId: id, createdAt: { gte: sevenDaysAgo } } }),
      prisma.appointment.count({ where: { salonId: id, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.appointment.count({
        where: { salonId: id, status: 'COMPLETED', updatedAt: { gte: sevenDaysAgo } },
      }),
      prisma.message.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
          conversation: { salonId: id },
        },
      }),
      prisma.staffUser.findMany({
        where: { salonId: id },
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      listPlatformInboxAlerts({ salonId: id, limit: 15 }),
    ]);

    const industry = getIndustryTemplate(salon.industryTemplate);

    return {
      business: {
        ...salon,
        industryLabel: industry.label,
        createdAt: salon.createdAt.toISOString(),
        trialEndsAt: salon.trialEndsAt?.toISOString() ?? null,
      },
      stats: {
        appointments7d,
        appointments30d,
        completed7d,
        messages7d,
        unreadAlerts,
      },
      funnel,
      staffUsers: staffUsers.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
      alerts: inbox.alerts,
    };
  });

  // ─── Add Staff User to Salon ───────────────────────────────────────
  app.post('/salons/:id/users', async (request, reply) => {
    const { id: salonId } = request.params as { id: string };
    const body = request.body as {
      email?: string;
      name?: string;
      password?: string;
      phone?: string;
      role?: StaffRole;
    };

    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    const password = body.password ?? '';
    const role = body.role ?? 'STYLIST';

    if (!email || !name || !password) {
      return reply.code(400).send({ error: 'missing_required_fields' });
    }
    if (password.length < 8) {
      return reply.code(400).send({ error: 'password_too_short' });
    }
    if (!VALID_STAFF_ROLES.includes(role)) {
      return reply.code(400).send({ error: 'invalid_role' });
    }

    const salon = await prisma.salon.findUnique({ where: { id: salonId } });
    if (!salon) return reply.code(404).send({ error: 'salon_not_found' });

    const emailTaken = await prisma.staffUser.findUnique({ where: { email } });
    if (emailTaken) return reply.code(409).send({ error: 'email_taken' });

    let phone: string | undefined;
    if (body.phone?.trim()) {
      phone = normalizeLoginPhone(body.phone.trim());
      const phoneTaken = await prisma.staffUser.findUnique({ where: { phone } });
      if (phoneTaken) return reply.code(409).send({ error: 'phone_taken' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.staffUser.create({
      data: {
        salonId,
        email,
        name,
        passwordHash,
        role,
        ...(phone && { phone }),
      },
    });

    return { user: stripStaffUser(user) };
  });

  // ─── Update Salon ──────────────────────────────────────────────────
  app.patch('/salons/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      botName?: string;
      status?: string;
      tier?: string;
      timezone?: string;
      whatsappNumber?: string;
      industryTemplate?: string;
    };
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) return reply.code(400).send({ error: 'invalid_name' });
      data.name = name;
    }
    if (body.botName !== undefined) {
      const botName = body.botName.trim();
      if (!botName || botName.length < 2 || botName.length > 40) {
        return reply.code(400).send({ error: 'invalid_bot_name' });
      }
      data.botName = botName;
    }
    if (body.status) {
      if (!VALID_STATUSES.includes(body.status as TenantStatus)) {
        return reply.code(400).send({ error: 'invalid_status' });
      }
      data.status = body.status;
      data.statusChangedAt = new Date();
    }
    if (body.tier !== undefined) {
      data.tier = body.tier.trim().toLowerCase();
    }
    if (body.timezone !== undefined) {
      const tz = body.timezone.trim();
      if (!tz) return reply.code(400).send({ error: 'invalid_timezone' });
      data.timezone = tz;
    }
    if (body.industryTemplate !== undefined) {
      const template = body.industryTemplate.trim();
      if (!isIndustryTemplateId(template)) {
        return reply.code(400).send({ error: 'invalid_industry_template' });
      }
      data.industryTemplate = template;
      data.businessType = businessTypeFromIndustryTemplate(template);
    }
    if (body.whatsappNumber !== undefined) {
      const raw = body.whatsappNumber.trim();
      if (!raw) {
        return reply.code(400).send({ error: 'whatsapp_number_required' });
      }
      const twilioSender = await findTwilioSenderByPhone(raw);
      if (!twilioSender) {
        return reply.code(400).send({ error: 'whatsapp_not_on_twilio' });
      }
      const alreadyAssigned = await prisma.salon.findFirst({
        where: {
          deletedAt: null,
          twilioWhatsAppFrom: twilioSender.twilioWhatsAppFrom,
          NOT: { id },
        },
      });
      if (alreadyAssigned) {
        return reply.code(409).send({ error: 'whatsapp_already_assigned', salonName: alreadyAssigned.name });
      }
      data.twilioWhatsAppFrom = twilioSender.twilioWhatsAppFrom;
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: 'nothing_to_update' });
    }

    const salon = await prisma.salon.update({ where: { id }, data });
    return {
      salon: {
        id: salon.id,
        slug: salon.slug,
        name: salon.name,
        botName: salon.botName,
        status: salon.status,
        tier: salon.tier,
        timezone: salon.timezone,
        industryTemplate: salon.industryTemplate,
        businessType: salon.businessType,
        twilioWhatsAppFrom: salon.twilioWhatsAppFrom,
        createdAt: salon.createdAt,
      },
    };
  });

  // ─── Impersonation Token ───────────────────────────────────────────
  app.post('/salons/:id/impersonate', async (request, reply) => {
    const adminPayload = request.user as { isSuperAdmin?: boolean; role?: string };
    if (!adminPayload.isSuperAdmin && adminPayload.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'super_admin_required' });
    }

    const { id } = request.params as { id: string };
    const salon = await prisma.salon.findUnique({ where: { id } });
    if (!salon) return reply.code(404).send({ error: 'not_found' });

    const owner = await prisma.staffUser.findFirst({
      where: { salonId: id, role: 'OWNER', active: true },
    });

    if (!owner) return reply.code(404).send({ error: 'no_owner_found' });

    const token = app.jwt.sign(
      {
        sub: owner.id,
        email: owner.email,
        name: owner.name,
        salonId: id,
        role: 'OWNER',
        impersonatedBy: (request.user as { sub: string }).sub,
      },
      { expiresIn: '1h' },
    );

    return { token, salon: { id: salon.id, name: salon.name }, impersonating: owner.email };
  });

  // ─── Platform Revenue (SUPER_ADMIN only) ───────────────────────────
  app.get('/revenue', { preHandler: requireSuperAdmin }, async () => {
    return getAdminRevenue();
  });

  // ─── Bot Health (SUPER_ADMIN only) ─────────────────────────────────
  app.get('/bot-health', { preHandler: requireSuperAdmin }, async () => {
    return getAdminBotHealth();
  });

  // ─── Platform Usage Summary ────────────────────────────────────────
  app.get('/stats', async () => {
    const [
      totalBusinesses,
      activeBusinesses,
      totalCustomers,
      totalAppointments,
      recentSignups,
      byBusinessType,
    ] = await Promise.all([
      prisma.salon.count({ where: { deletedAt: null } }),
      prisma.salon.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.customer.count(),
      prisma.appointment.count(),
      prisma.salon.count({
        where: {
          deletedAt: null,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.salon.groupBy({
        by: ['businessType'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
    ]);

    return {
      totalBusinesses,
      activeBusinesses,
      /** @deprecated use totalBusinesses */
      totalSalons: totalBusinesses,
      /** @deprecated use activeBusinesses */
      activeSalons: activeBusinesses,
      totalCustomers,
      totalAppointments,
      recentSignups,
      byBusinessType: byBusinessType.map((row) => ({
        type: row.businessType,
        count: row._count.id,
      })),
    };
  });

  // ─── Usage Alerts ──────────────────────────────────────────────────
  app.get('/alerts', async () => {
    const [pastDue, trialExpiring] = await Promise.all([
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
    ]);

    return { pastDue, trialExpiring };
  });

  // ─── Billing Overview ─────────────────────────────────────────────
  app.get('/billing', async () => {
    const [activeSubscriptions, allSubscriptions, statusGroups] = await Promise.all([
      prisma.salonSubscription.findMany({
        where: { status: 'ACTIVE' },
        include: { plan: true },
      }),
      prisma.salonSubscription.findMany({
        include: {
          plan: true,
          salon: { select: { id: true, name: true, slug: true, status: true, tier: true, createdAt: true } },
        },
        orderBy: { salon: { createdAt: 'desc' } },
      }),
      prisma.salonSubscription.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    const mrr = activeSubscriptions.reduce((sum, sub) => sum + sub.plan.priceMonthly, 0);
    const arr = mrr * 12;

    const byStatus: Record<string, number> = {
      ACTIVE: 0,
      TRIAL: 0,
      PAST_DUE: 0,
      CANCELLED: 0,
      PAUSED: 0,
    };
    for (const g of statusGroups) {
      byStatus[g.status] = g._count.status;
    }

    const subscriptions = allSubscriptions.map((sub) => ({
      salonId: sub.salon.id,
      salonName: sub.salon.name,
      salonSlug: sub.salon.slug,
      salonStatus: sub.salon.status,
      tier: sub.salon.tier,
      status: sub.status,
      planId: sub.planId,
      planName: sub.plan.name,
      priceMonthly: sub.plan.priceMonthly,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      createdAt: sub.salon.createdAt,
    }));

    return { mrr, arr, byStatus, subscriptions };
  });

  // ─── Platform analytics (all businesses or one) ───────────────────────
  function parseAnalyticsSalonId(query: { salonId?: string }) {
    const raw = query.salonId?.trim();
    if (!raw || raw === 'all') return undefined;
    return raw;
  }

  app.get('/analytics/businesses', async () => {
    const businesses = await listAnalyticsBusinesses();
    return { businesses };
  });

  app.get('/analytics/overview', async (request, reply) => {
    try {
      const q = request.query as { salonId?: string; month?: string };
      const salonId = parseAnalyticsSalonId(q);
      const data = await getAdminAnalyticsOverview(salonId);
      return data;
    } catch (e) {
      if (e instanceof Error && e.message === 'business_not_found') {
        return reply.code(404).send({ error: 'business_not_found' });
      }
      throw e;
    }
  });

  app.get('/analytics/monthly-report', async (request, reply) => {
    try {
      const q = request.query as { salonId?: string; month?: string };
      const salonId = parseAnalyticsSalonId(q);
      return await getAdminMonthlyReport(salonId, q.month);
    } catch (e) {
      if (e instanceof Error && e.message === 'business_not_found') {
        return reply.code(404).send({ error: 'business_not_found' });
      }
      throw e;
    }
  });

  app.get('/analytics/funnel', async (request, reply) => {
    try {
      const salonId = parseAnalyticsSalonId(request.query as { salonId?: string });
      return await getAdminAnalyticsFunnel(salonId);
    } catch (e) {
      if (e instanceof Error && e.message === 'business_not_found') {
        return reply.code(404).send({ error: 'business_not_found' });
      }
      throw e;
    }
  });

  app.get('/analytics/no-show-patterns', async (request, reply) => {
    try {
      const salonId = parseAnalyticsSalonId(request.query as { salonId?: string });
      return await getAdminNoShowPatterns(salonId);
    } catch (e) {
      if (e instanceof Error && e.message === 'business_not_found') {
        return reply.code(404).send({ error: 'business_not_found' });
      }
      throw e;
    }
  });

  app.get('/analytics/staff-revenue', async (request, reply) => {
    try {
      const salonId = parseAnalyticsSalonId(request.query as { salonId?: string });
      return await getAdminStaffRevenue(salonId);
    } catch (e) {
      if (e instanceof Error && e.message === 'business_not_found') {
        return reply.code(404).send({ error: 'business_not_found' });
      }
      throw e;
    }
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

  // ─── Platform inbox (owner messages + bot errors) ────────────────────
  app.get('/platform-inbox/unread-count', async () => {
    const count = await getPlatformInboxUnreadCount();
    return { count };
  });

  app.get('/platform-inbox/summary', async () => {
    return listPlatformInboxByCategory();
  });

  app.get('/platform-inbox', async (request) => {
    const { status, salonId, limit, offset } = request.query as {
      status?: string;
      salonId?: string;
      limit?: string;
      offset?: string;
    };
    const parsedStatus =
      status === 'UNREAD' || status === 'READ' || status === 'ARCHIVED' ? status : undefined;
    return listPlatformInboxAlerts({
      status: parsedStatus,
      salonId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  });

  app.patch<{ Params: { id: string }; Body: { status?: string } }>(
    '/platform-inbox/:id',
    async (request, reply) => {
      const { id } = request.params;
      const status = request.body?.status;
      if (status !== 'READ' && status !== 'ARCHIVED' && status !== 'UNREAD') {
        return reply.code(400).send({ error: 'invalid_status' });
      }
      try {
        const alert = await updatePlatformAlertStatus(id, status);
        return {
          alert: {
            id: alert.id,
            status: alert.status,
            readAt: alert.readAt?.toISOString() ?? null,
          },
        };
      } catch {
        return reply.code(404).send({ error: 'not_found' });
      }
    },
  );
}

async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as { isSuperAdmin?: boolean; role?: string };
    if (payload.isSuperAdmin || payload.role === 'SUPER_ADMIN') {
      return;
    }
    return reply.code(403).send({ error: 'super_admin_required' });
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const pathname = request.url.split('?')[0];
  if (pathname.endsWith('/login') && request.method === 'POST') return;

  try {
    await request.jwtVerify();
    const payload = request.user as { isAdmin?: boolean; role?: string };
    if (payload.isAdmin || payload.role === 'SUPER_ADMIN') {
      return;
    }
    return reply.code(403).send({ error: 'admin_required' });
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
}
