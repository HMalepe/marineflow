import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import type { Customer } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { validateStrongPassword } from '../lib/salonPhoneLookup.js';

const BCRYPT_ROUNDS = 12;

/** Normalise any phone input to E.164 +27 format. */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('27') && digits.length === 11) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+27${digits.slice(1)}`;
  if (digits.length === 9) return `+27${digits}`;
  return `+${digits}`;
}

function isValidPhone(phone: string): boolean {
  return /^\+27[6-8]\d{8}$/.test(phone);
}

function issueToken(app: FastifyInstance, customer: Customer) {
  const token = app.jwt.sign(
    {
      sub: customer.id,
      salonId: customer.salonId,
      phone: customer.waId,
      name: customer.displayName ?? customer.firstName ?? 'Client',
      role: 'CLIENT',
    },
    { expiresIn: '30d' },
  );

  return {
    token,
    customer: {
      id: customer.id,
      salonId: customer.salonId,
      phone: customer.waId,
      name: customer.displayName ?? customer.firstName,
      email: customer.email,
    },
  };
}

export async function clientAuthRoutes(app: FastifyInstance) {
  /**
   * Register or set a password for the first time.
   * Client provides their phone number and chosen password.
   * If a Customer record exists for that phone in the salon, the password is attached.
   * If not, a new Customer record is created.
   */
  app.post('/register', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    const body = request.body as {
      phone?: string;
      password?: string;
      salonId?: string;
      name?: string;
    };

    const phoneRaw = body.phone?.trim();
    const password = body.password ?? '';
    const salonId = body.salonId?.trim();

    if (!phoneRaw) return reply.code(400).send({ error: 'phone_required' });
    if (!salonId) return reply.code(400).send({ error: 'salon_id_required' });

    const phone = normalisePhone(phoneRaw);
    if (!isValidPhone(phone)) return reply.code(400).send({ error: 'invalid_phone' });

    const passwordError = validateStrongPassword(password);
    if (passwordError) return reply.code(400).send({ error: 'weak_password', message: passwordError });

    const salon = await prisma.salon.findUnique({ where: { id: salonId } });
    if (!salon) return reply.code(404).send({ error: 'salon_not_found' });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let customer = await prisma.customer.findUnique({
      where: { salonId_waId: { salonId, waId: phone } },
    });

    if (customer) {
      if (customer.passwordHash) {
        return reply.code(409).send({ error: 'already_registered', message: 'An account already exists — sign in instead' });
      }
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { passwordHash, displayName: body.name?.trim() || customer.displayName },
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          salonId,
          waId: phone,
          passwordHash,
          displayName: body.name?.trim() || undefined,
          source: 'web',
        },
      });
    }

    return issueToken(app, customer);
  });

  /**
   * Login with phone + password.
   * Optionally scoped to a salonId; if omitted, finds the first matching customer record.
   */
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    const body = request.body as { phone?: string; password?: string; salonId?: string };

    const phoneRaw = body.phone?.trim();
    const password = body.password ?? '';
    const salonId = body.salonId?.trim();

    if (!phoneRaw) return reply.code(400).send({ error: 'phone_required' });
    if (!password) return reply.code(400).send({ error: 'password_required' });

    const phone = normalisePhone(phoneRaw);
    if (!isValidPhone(phone)) return reply.code(400).send({ error: 'invalid_phone' });

    let customer: Customer | null = null;

    if (salonId) {
      customer = await prisma.customer.findUnique({
        where: { salonId_waId: { salonId, waId: phone } },
      });
    } else {
      customer = await prisma.customer.findFirst({
        where: { waId: phone, passwordHash: { not: null }, deletedAt: null },
        orderBy: { lastInteractionAt: 'desc' },
      });
    }

    if (!customer?.passwordHash) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    if (customer.deletedAt) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    const ok = await bcrypt.compare(password, customer.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'invalid_credentials' });

    return issueToken(app, customer);
  });

  /** Change password (requires current token). */
  app.post('/change-password', {
    config: { rateLimit: { max: 5, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const payload = request.user as { sub: string; role?: string };
    if (payload.role !== 'CLIENT') return reply.code(403).send({ error: 'forbidden' });

    const body = request.body as { currentPassword?: string; newPassword?: string };
    if (!body.currentPassword || !body.newPassword) {
      return reply.code(400).send({ error: 'both_passwords_required' });
    }

    const customer = await prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!customer?.passwordHash) return reply.code(401).send({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(body.currentPassword, customer.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'invalid_credentials' });

    const passwordError = validateStrongPassword(body.newPassword);
    if (passwordError) return reply.code(400).send({ error: 'weak_password', message: passwordError });

    await prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash: await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS) },
    });

    return { success: true };
  });
}

export async function requireClientAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as { role?: string };
    if (payload.role !== 'CLIENT') throw new Error('not a client token');
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
}
