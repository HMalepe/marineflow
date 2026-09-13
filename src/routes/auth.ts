import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import type { StaffUser } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { revokeStaffTokens, assertStaffSessionActive } from '../lib/staffTokenAuth.js';
import { normalizeLoginPhone } from '../lib/phone.js';
import {
  findSalonByWhatsAppPhone,
  isTwilioRegisteredWhatsAppNumber,
  isValidSaLoginPhone,
  ownerEmailForSalon,
  validateStrongPassword,
} from '../lib/salonPhoneLookup.js';

/** Normalise login username: uppercase, trim, alphanumeric only. */
function normalizeUsername(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const KNOWN_USERNAMES = ['SALON', 'DISPENSARY'] as const;
type KnownUsername = typeof KNOWN_USERNAMES[number];

function isKnownUsername(u: string): u is KnownUsername {
  return (KNOWN_USERNAMES as readonly string[]).includes(u);
}

async function findSalonForUsername(username: KnownUsername) {
  if (username === 'DISPENSARY') {
    return prisma.salon.findFirst({
      where: { deletedAt: null, isBusinessRouter: false, industryTemplate: 'dispensary' },
      select: { id: true, name: true, slug: true },
    });
  }
  // SALON → first non-dispensary, non-router salon
  return prisma.salon.findFirst({
    where: {
      deletedAt: null,
      isBusinessRouter: false,
      NOT: { industryTemplate: 'dispensary' },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, slug: true },
  });
}

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
      phone: user.phone ?? undefined,
      name: user.name,
      salonId: user.salonId,
      role: user.role,
    },
    { expiresIn: '8h' },
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

    if (!(await isTwilioRegisteredWhatsAppNumber(phone))) {
      return reply.code(404).send({ error: 'number_not_on_twilio' });
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

    return reply.code(404).send({ error: 'number_not_linked' });
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

    if (!(await isTwilioRegisteredWhatsAppNumber(phone))) {
      return reply.code(404).send({ error: 'number_not_on_twilio' });
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
      return reply.code(404).send({ error: 'number_not_linked' });
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
      await revokeStaffTokens(owner.id);
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
    const body = request.body as { email?: string; phone?: string; username?: string; password?: string };
    const password = body.password ?? '';
    const email = body.email?.trim().toLowerCase();
    const phoneRaw = body.phone?.trim();
    const usernameRaw = body.username?.trim();

    if (!password) {
      return reply.code(400).send({ error: 'password_required' });
    }

    let user: StaffUser | null = null;

    if (usernameRaw) {
      const username = normalizeUsername(usernameRaw);
      user = await prisma.staffUser.findUnique({ where: { username } });
    } else if (phoneRaw) {
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

  /** Check if a username can log in or needs first-time password setup. */
  app.post('/check-username', {
    config: { rateLimit: { max: 20, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    const { username: usernameRaw } = request.body as { username?: string };
    if (!usernameRaw?.trim()) {
      return reply.code(400).send({ error: 'username_required' });
    }
    const username = normalizeUsername(usernameRaw);
    if (!isKnownUsername(username)) {
      return reply.code(404).send({ error: 'username_not_found' });
    }

    const existing = await prisma.staffUser.findUnique({
      where: { username },
      include: { salon: { select: { name: true } } },
    });
    if (existing?.active) {
      return { status: 'login', salonName: existing.salon.name };
    }

    const salon = await findSalonForUsername(username);
    if (!salon) {
      return reply.code(404).send({ error: 'salon_not_found' });
    }
    return { status: 'setup', salonName: salon.name };
  });

  /** First-time setup: set password + security question for a username. */
  app.post('/setup-username-password', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    const body = request.body as {
      username?: string;
      password?: string;
      securityQuestion?: string;
      securityAnswer?: string;
    };
    const username = normalizeUsername(body.username?.trim() ?? '');
    const password = body.password ?? '';
    const securityQuestion = body.securityQuestion?.trim() ?? '';
    const securityAnswer = body.securityAnswer?.trim() ?? '';

    if (!isKnownUsername(username)) {
      return reply.code(404).send({ error: 'username_not_found' });
    }
    if (!securityQuestion) {
      return reply.code(400).send({ error: 'security_question_required' });
    }
    if (!securityAnswer) {
      return reply.code(400).send({ error: 'security_answer_required' });
    }

    const taken = await prisma.staffUser.findUnique({ where: { username } });
    if (taken?.active) {
      return reply.code(409).send({ error: 'username_already_setup' });
    }

    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      return reply.code(400).send({ error: 'weak_password', message: passwordError });
    }

    const salon = await findSalonForUsername(username);
    if (!salon) {
      return reply.code(404).send({ error: 'salon_not_found' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const securityAnswerHash = await bcrypt.hash(securityAnswer.toLowerCase(), BCRYPT_ROUNDS);

    let owner = await prisma.staffUser.findFirst({
      where: { salonId: salon.id, role: 'OWNER', active: true },
    });

    if (owner) {
      owner = await prisma.staffUser.update({
        where: { id: owner.id },
        data: { username, passwordHash, securityQuestion, securityAnswerHash },
      });
    } else {
      owner = await prisma.staffUser.create({
        data: {
          salonId: salon.id,
          email: ownerEmailForSalon(salon.slug),
          username,
          passwordHash,
          securityQuestion,
          securityAnswerHash,
          name: salon.name,
          role: 'OWNER',
        },
      });
    }

    return issueToken(app, owner);
  });

  /** Return the security question for a username (to enable forgot-password). */
  app.post('/forgot/question', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    const { username: usernameRaw } = request.body as { username?: string };
    const username = normalizeUsername(usernameRaw?.trim() ?? '');
    if (!isKnownUsername(username)) {
      return reply.code(404).send({ error: 'username_not_found' });
    }
    const user = await prisma.staffUser.findUnique({ where: { username }, select: { securityQuestion: true } });
    if (!user?.securityQuestion) {
      return reply.code(404).send({ error: 'no_security_question' });
    }
    return { securityQuestion: user.securityQuestion };
  });

  /** Verify security answer and reset password. */
  app.post('/forgot/reset', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const body = request.body as {
      username?: string;
      securityAnswer?: string;
      newPassword?: string;
    };
    const username = normalizeUsername(body.username?.trim() ?? '');
    const securityAnswer = (body.securityAnswer ?? '').trim().toLowerCase();
    const newPassword = body.newPassword ?? '';

    if (!isKnownUsername(username)) {
      return reply.code(404).send({ error: 'username_not_found' });
    }
    if (!securityAnswer) {
      return reply.code(400).send({ error: 'security_answer_required' });
    }

    const user = await prisma.staffUser.findUnique({ where: { username } });
    if (!user?.securityAnswerHash) {
      return reply.code(404).send({ error: 'no_security_question' });
    }

    const answerOk = await bcrypt.compare(securityAnswer, user.securityAnswerHash);
    if (!answerOk) {
      return reply.code(401).send({ error: 'wrong_answer' });
    }

    const passwordError = validateStrongPassword(newPassword);
    if (passwordError) {
      return reply.code(400).send({ error: 'weak_password', message: passwordError });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const updated = await prisma.staffUser.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await revokeStaffTokens(updated.id);

    return issueToken(app, updated);
  });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  if (!(await assertStaffSessionActive(request, reply))) return;
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
