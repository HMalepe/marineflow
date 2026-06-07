import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { StaffRole, TenantStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { normalizeLoginPhone } from '../lib/phone.js';
import {
  DEFAULT_BUSINESS_HOURS,
  isValidSalonSlug,
  normalizeTwilioWhatsAppFrom,
} from '../lib/salonDefaults.js';
import { getPlatformMetrics, getConversationFunnel, checkAlertThresholds } from '../services/observability.js';

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

    const twilioWhatsAppFrom = body.whatsappNumber?.trim()
      ? normalizeTwilioWhatsAppFrom(body.whatsappNumber)
      : undefined;

    const passwordHash = await bcrypt.hash(
      ownerPassword.length >= 8 ? ownerPassword : randomBytes(32).toString('hex'),
      BCRYPT_ROUNDS,
    );

    const result = await prisma.$transaction(async (tx) => {
      const salon = await tx.salon.create({
        data: {
          name,
          slug,
          status: 'TRIAL',
          tier: 'starter',
          timezone: body.timezone?.trim() || 'Africa/Johannesburg',
          defaultCurrency: body.currency?.trim().toLowerCase() || 'zar',
          industryTemplate: body.industryTemplate?.trim() || 'salon',
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
      status: s.status,
      tier: s.tier,
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
      status?: string;
      tier?: string;
      timezone?: string;
      whatsappNumber?: string;
    };
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) return reply.code(400).send({ error: 'invalid_name' });
      data.name = name;
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
    if (body.whatsappNumber !== undefined) {
      data.twilioWhatsAppFrom = body.whatsappNumber.trim()
        ? normalizeTwilioWhatsAppFrom(body.whatsappNumber)
        : null;
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
        status: salon.status,
        tier: salon.tier,
        timezone: salon.timezone,
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
      prisma.salon
        .findMany({
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
        })
        .then((salons) => salons.filter((s) => s._count.staff > 3)),
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
