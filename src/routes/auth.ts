import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import type { StaffUser } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { normalizeLoginPhone } from '../lib/phone.js';
import {
  findSalonByWhatsAppPhone,
  isValidSaLoginPhone,
  ownerEmailForSalon,
  validateStrongPassword,
} from '../lib/salonPhoneLookup.js';

const BCRYPT_ROUNDS = 12;

async function authenticateStaffUser(
  user: StaffUser | null,
  password: string,
): Promise<StaffUser | null> {
  if (!user?.active) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

function issueToken(app: FastifyInstance, user: StaffUser) {
  const token = app.jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      salonId: user.salonId,
      role: user.role,
    },
    { expiresIn: '7d' },
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      salonId: user.salonId,
    },
  };
}

export async function authRoutes(app: FastifyInstance) {
  /** Check if a WhatsApp business number can log in or needs first-time password setup. */
  app.post('/check-phone', {
    config: { rateLimit: { max: 20, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    const { phone: phoneRaw } = request.body as { phone?: string };
    if (!phoneRaw?.trim()) {
      return reply.code(400).send({ error: 'phone_required' });
    }
    const phone = normalizeLoginPhone(phoneRaw.trim());
    if (!isValidSaLoginPhone(phone)) {
      return reply.code(400).send({ error: 'invalid_phone' });
    }

    const existingUser = await prisma.staffUser.findUnique({
      where: { phone },
      include: { salon: { select: { name: true } } },
    });
    if (existingUser?.active) {
      return {
        status: 'login',
        salonName: existingUser.salon.name,
      };
    }

    const salon = await findSalonByWhatsAppPhone(phone);
    if (salon) {
      return {
        status: 'setup',
        salonName: salon.name,
      };
    }

    return reply.code(404).send({ error: 'number_not_registered' });
  });

  /** First-time setup: owner sets password for their registered WhatsApp business number. */
  app.post('/setup-password', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    const body = request.body as { phone?: string; password?: string };
    const phoneRaw = body.phone?.trim();
    const password = body.password ?? '';

    if (!phoneRaw) {
      return reply.code(400).send({ error: 'phone_required' });
    }
    const phone = normalizeLoginPhone(phoneRaw);
    if (!isValidSaLoginPhone(phone)) {
      return reply.code(400).send({ error: 'invalid_phone' });
    }

    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      return reply.code(400).send({ error: 'weak_password', message: passwordError });
    }

    const taken = await prisma.staffUser.findUnique({ where: { phone } });
    if (taken) {
      return reply.code(409).send({ error: 'phone_already_setup' });
    }

    const salon = await findSalonByWhatsAppPhone(phone);
    if (!salon) {
      return reply.code(404).send({ error: 'number_not_registered' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let owner = await prisma.staffUser.findFirst({
      where: { salonId: salon.id, role: 'OWNER', active: true },
    });

    if (owner) {
      owner = await prisma.staffUser.update({
        where: { id: owner.id },
        data: { phone, passwordHash },
      });
    } else {
      owner = await prisma.staffUser.create({
        data: {
          salonId: salon.id,
          email: ownerEmailForSalon(salon.slug),
          phone,
          passwordHash,
          name: salon.name,
          role: 'OWNER',
        },
      });
    }

    return issueToken(app, owner);
  });

  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    const body = request.body as { email?: string; phone?: string; password?: string };
    const password = body.password ?? '';
    const email = body.email?.trim().toLowerCase();
    const phoneRaw = body.phone?.trim();

    if (!password) {
      return reply.code(400).send({ error: 'password_required' });
    }

    let user: StaffUser | null = null;

    if (phoneRaw) {
      const phone = normalizeLoginPhone(phoneRaw);
      if (!isValidSaLoginPhone(phone)) {
        return reply.code(400).send({ error: 'invalid_phone' });
      }
      user = await prisma.staffUser.findUnique({ where: { phone } });
    } else if (email) {
      user = await prisma.staffUser.findUnique({ where: { email } });
    } else {
      return reply.code(400).send({ error: 'email_or_phone_required' });
    }

    const authed = await authenticateStaffUser(user, password);
    if (!authed) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    return issueToken(app, authed);
  });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    const payload = request.user as { role?: string };
    if (!payload.role || !roles.includes(payload.role)) {
      return reply.code(403).send({ error: 'forbidden' });
    }
  };
}
