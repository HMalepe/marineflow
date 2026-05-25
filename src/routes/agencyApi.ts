import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

/**
 * Agency/reseller routes — guarded by agency JWT (isAgency: true in token).
 * Agencies see only their own salons (filtered by agencyId).
 */
export async function agencyApiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAgency);

  // ─── Agency Login ──────────────────────────────────────────────────
  app.post('/login', { preHandler: [] }, async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';
    if (!email) return reply.code(400).send({ error: 'email_required' });

    const user = await prisma.agencyUser.findUnique({
      where: { email },
      include: { agency: true },
    });
    if (!user?.active || !user.agency.active) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'invalid_credentials' });

    await prisma.agencyUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = app.jwt.sign(
      { sub: user.id, agencyId: user.agencyId, isAgency: true, agencyRole: user.role },
      { expiresIn: '8h' },
    );

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      agency: { id: user.agency.id, name: user.agency.name, slug: user.agency.slug },
    };
  });

  // ─── Agency Profile ────────────────────────────────────────────────
  app.get('/profile', async (request) => {
    const { agencyId } = getAgencyPayload(request);
    const agency = await prisma.agency.findUniqueOrThrow({
      where: { id: agencyId },
    });
    return { agency };
  });

  app.patch('/profile', async (request, reply) => {
    const { agencyId, agencyRole } = getAgencyPayload(request);
    if (agencyRole !== 'OWNER') return reply.code(403).send({ error: 'owner_required' });

    const body = request.body as {
      name?: string;
      logoUrl?: string;
      primaryColor?: string;
      domain?: string;
      contactEmail?: string;
    };

    const agency = await prisma.agency.update({
      where: { id: agencyId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
        ...(body.primaryColor !== undefined && { primaryColor: body.primaryColor }),
        ...(body.domain !== undefined && { domain: body.domain || null }),
        ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail }),
      },
    });

    return { agency };
  });

  // ─── Agency Salons ─────────────────────────────────────────────────
  app.get('/salons', async (request) => {
    const { agencyId } = getAgencyPayload(request);
    const q = request.query as { status?: string; search?: string; page?: string };
    const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
    const take = 25;
    const skip = (page - 1) * take;

    const where: Record<string, unknown> = { agencyId };
    if (q.status) where.status = q.status;
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
          _count: { select: { staff: true, customers: true, appointments: true } },
        },
      }),
      prisma.salon.count({ where }),
    ]);

    return { salons, total, page, pages: Math.ceil(total / take) };
  });

  app.post('/salons', async (request, reply) => {
    const { agencyId, agencyRole } = getAgencyPayload(request);
    if (agencyRole === 'VIEWER') return reply.code(403).send({ error: 'insufficient_role' });

    const body = request.body as { name: string; slug: string; ownerEmail: string; ownerPassword: string };
    if (!body.name || !body.slug || !body.ownerEmail || !body.ownerPassword) {
      return reply.code(400).send({ error: 'missing_fields' });
    }
    if (body.ownerPassword.length < 8) {
      return reply.code(400).send({ error: 'password_too_short' });
    }
    if (!/^[a-z0-9-]+$/.test(body.slug)) {
      return reply.code(400).send({ error: 'invalid_slug_format' });
    }

    const existing = await prisma.salon.findUnique({ where: { slug: body.slug } });
    if (existing) return reply.code(409).send({ error: 'slug_taken' });

    const salon = await prisma.salon.create({
      data: {
        name: body.name,
        slug: body.slug,
        agencyId,
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const passwordHash = await bcrypt.hash(body.ownerPassword, 10);
    await prisma.staffUser.create({
      data: {
        salonId: salon.id,
        email: body.ownerEmail.toLowerCase().trim(),
        passwordHash,
        name: body.name,
        role: 'OWNER',
      },
    });

    return { salon };
  });

  // ─── Aggregate Metrics ─────────────────────────────────────────────
  app.get('/metrics', async (request) => {
    const { agencyId } = getAgencyPayload(request);

    const [totalSalons, activeSalons, totalCustomers, totalAppointments] = await Promise.all([
      prisma.salon.count({ where: { agencyId } }),
      prisma.salon.count({ where: { agencyId, status: 'ACTIVE' } }),
      prisma.customer.count({ where: { salon: { agencyId } } }),
      prisma.appointment.count({ where: { salon: { agencyId } } }),
    ]);

    return { totalSalons, activeSalons, totalCustomers, totalAppointments };
  });

  // ─── Agency Users ──────────────────────────────────────────────────
  app.get('/users', async (request) => {
    const { agencyId } = getAgencyPayload(request);
    const users = await prisma.agencyUser.findMany({
      where: { agencyId },
      select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return { users };
  });

  app.post('/users', async (request, reply) => {
    const { agencyId, agencyRole } = getAgencyPayload(request);
    if (agencyRole !== 'OWNER') return reply.code(403).send({ error: 'owner_required' });

    const body = request.body as { email: string; name: string; password: string; role?: string };
    if (!body.email || !body.name || !body.password) {
      return reply.code(400).send({ error: 'missing_fields' });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.agencyUser.create({
      data: {
        agencyId,
        email: body.email.toLowerCase().trim(),
        passwordHash,
        name: body.name,
        role: (body.role as 'OWNER' | 'MANAGER' | 'VIEWER') ?? 'VIEWER',
      },
    });

    return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });
}

function getAgencyPayload(request: FastifyRequest) {
  const payload = request.user as { sub: string; agencyId?: string; agencyRole?: string };
  return {
    sub: payload.sub,
    agencyId: payload.agencyId!,
    agencyRole: payload.agencyRole ?? 'VIEWER',
  };
}

async function requireAgency(request: FastifyRequest, reply: FastifyReply) {
  if (request.url.endsWith('/login') && request.method === 'POST') return;

  try {
    await request.jwtVerify();
    const payload = request.user as { isAgency?: boolean };
    if (!payload.isAgency) {
      return reply.code(403).send({ error: 'agency_required' });
    }
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
}
