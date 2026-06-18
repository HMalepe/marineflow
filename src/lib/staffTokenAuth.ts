import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './prisma.js';
import { redis } from './redis.js';

const REVOKE_PREFIX = 'auth:revoke:staff:';
/** Match staff JWT expiry (8h) with buffer. */
const REVOKE_TTL_SEC = 60 * 60 * 24;

/** Invalidate existing staff JWTs after password change or deactivation. */
export async function revokeStaffTokens(userId: string): Promise<void> {
  try {
    await redis.set(`${REVOKE_PREFIX}${userId}`, String(Date.now()), 'EX', REVOKE_TTL_SEC);
  } catch {
    // Redis down — tokens expire naturally via JWT TTL
  }
}

async function isStaffTokenRevoked(userId: string, issuedAtSec: number): Promise<boolean> {
  try {
    const revokedAt = await redis.get(`${REVOKE_PREFIX}${userId}`);
    if (!revokedAt) return false;
    return issuedAtSec * 1000 < parseInt(revokedAt, 10);
  } catch {
    return false;
  }
}

type StaffJwtPayload = {
  sub?: string;
  salonId?: string;
  iat?: number;
  isAdmin?: boolean;
  isAgency?: boolean;
};

/** After jwtVerify — reject revoked or deactivated staff dashboard tokens. */
export async function assertStaffSessionActive(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const payload = request.user as StaffJwtPayload;
  if (payload.isAdmin || payload.isAgency || !payload.salonId || !payload.sub) {
    return true;
  }

  if (payload.iat !== undefined && (await isStaffTokenRevoked(payload.sub, payload.iat))) {
    reply.code(401).send({ error: 'token_revoked' });
    return false;
  }

  const user = await prisma.staffUser.findUnique({
    where: { id: payload.sub },
    select: { active: true },
  });
  if (!user?.active) {
    reply.code(401).send({ error: 'account_inactive' });
    return false;
  }
  return true;
}
