import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import type { StaffUser } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { normalizeLoginPhone } from '../lib/phone.js';

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
      if (!/^\+27\d{9}$/.test(phone)) {
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
