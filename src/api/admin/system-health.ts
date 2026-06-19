import { prisma } from '../../lib/prisma.js';
import { healthCheck as redisHealthCheck } from '../../lib/redis.js';

export type ServiceHealthStatus = 'green' | 'amber' | 'red';

export type AdminSystemHealthSummary = {
  postgres_latency_ms: number;
  redis_latency_ms: number;
  twilio_webhook_success_rate_24h: number;
  active_db_connections: number;
  postgres: {
    latencyMs: number;
    activeConnections: number;
    status: ServiceHealthStatus;
  };
  redis: {
    latencyMs: number;
    status: ServiceHealthStatus;
  };
  twilio: {
    webhookSuccessRate24h: number;
    webhookErrorRate24h: number;
    status: ServiceHealthStatus;
  };
};

function postgresStatus(latencyMs: number, ok: boolean): ServiceHealthStatus {
  if (!ok || latencyMs >= 1000) return 'red';
  if (latencyMs > 200) return 'amber';
  return 'green';
}

function redisStatus(latencyMs: number, ok: boolean): ServiceHealthStatus {
  if (!ok) return 'red';
  if (latencyMs > 50) return 'amber';
  return 'green';
}

function twilioStatus(successRate: number, sampleSize: number): ServiceHealthStatus {
  if (sampleSize === 0) return 'green';
  const errorRate = 1 - successRate;
  if (errorRate > 0.2) return 'red';
  if (errorRate > 0.05) return 'amber';
  return 'green';
}

async function checkPostgres(): Promise<{
  ok: boolean;
  latencyMs: number;
  activeConnections: number;
}> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - start);

    let activeConnections = 0;
    try {
      const rows = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;
      activeConnections = rows[0]?.count ?? 0;
    } catch {
      // pg_stat_activity may be restricted on managed Postgres — latency still valid
    }

    return { ok: true, latencyMs, activeConnections };
  } catch {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      activeConnections: 0,
    };
  }
}

async function getTwilioWebhookMetrics24h(): Promise<{
  successRate: number;
  errorRate: number;
  sampleSize: number;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [inboundTotal, inboundErrors] = await Promise.all([
    prisma.messageLog.count({
      where: { direction: 'INBOUND', createdAt: { gte: since } },
    }),
    prisma.messageLog.count({
      where: {
        direction: 'INBOUND',
        status: { in: ['FAILED', 'UNHANDLED'] },
        createdAt: { gte: since },
      },
    }),
  ]);

  if (inboundTotal === 0) {
    return { successRate: 1, errorRate: 0, sampleSize: 0 };
  }

  const errorRate = inboundErrors / inboundTotal;
  return {
    successRate: 1 - errorRate,
    errorRate,
    sampleSize: inboundTotal,
  };
}

/** Infrastructure health — Postgres, Redis, Twilio webhook success (SUPER_ADMIN). */
export async function getAdminSystemHealth(): Promise<AdminSystemHealthSummary> {
  const [postgres, redis, twilio] = await Promise.all([
    checkPostgres(),
    redisHealthCheck(),
    getTwilioWebhookMetrics24h(),
  ]);

  const postgresStatusValue = postgresStatus(postgres.latencyMs, postgres.ok);
  const redisStatusValue = redisStatus(redis.latencyMs, redis.ok);
  const twilioStatusValue = twilioStatus(twilio.successRate, twilio.sampleSize);

  return {
    postgres_latency_ms: postgres.latencyMs,
    redis_latency_ms: redis.latencyMs,
    twilio_webhook_success_rate_24h: twilio.successRate,
    active_db_connections: postgres.activeConnections,
    postgres: {
      latencyMs: postgres.latencyMs,
      activeConnections: postgres.activeConnections,
      status: postgresStatusValue,
    },
    redis: {
      latencyMs: redis.latencyMs,
      status: redisStatusValue,
    },
    twilio: {
      webhookSuccessRate24h: twilio.successRate,
      webhookErrorRate24h: twilio.errorRate,
      status: twilioStatusValue,
    },
  };
}
