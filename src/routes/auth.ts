import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';
    if (!email) {
      return reply.code(400).send({ error: 'email_required' });
    }

    const user = await prisma.staffUser.findUnique({
      where: { email },
    });
    if (!user?.active) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

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
