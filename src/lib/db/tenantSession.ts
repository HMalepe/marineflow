import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';

export type PrismaTx = Prisma.TransactionClient;

const tenantStore = new AsyncLocalStorage<PrismaTx>();

/** Prisma client for the active tenant transaction, or the global client (platform tables). */
export function getTenantDb(): PrismaTx {
  return tenantStore.getStore() ?? (prisma as unknown as PrismaTx);
}

function savepointId(label: string): string {
  const safe = label.replace(/\W/g, '_').slice(0, 24);
  return `mfs_${safe}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Run optional DB work inside a SAVEPOINT so a failure (missing table/column)
 * does not abort the outer bot transaction (PostgreSQL 25P02).
 */
export async function withDbSavepoint<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const db = getTenantDb();
  const sp = savepointId(label);
  await db.$executeRawUnsafe(`SAVEPOINT "${sp}"`);
  try {
    const result = await fn();
    await db.$executeRawUnsafe(`RELEASE SAVEPOINT "${sp}"`);
    return result;
  } catch (err) {
    await db.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${sp}"`);
    throw err;
  }
}

/** Like withDbSavepoint but returns fallback instead of throwing. */
export async function tryDbSavepoint<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await withDbSavepoint(label, fn);
  } catch (err) {
    logger.warn({ err, label }, 'db_savepoint_failed');
    return fallback;
  }
}

/**
 * Run work scoped to one salon (tenant). Sets Postgres session vars for RLS.
 * All tenant-scoped code in `fn` should use getTenantDb().
 *
 * Timeout is 60s because bot flows include outbound network calls (Twilio/Meta)
 * and optional AI assist inside the transaction. Once Inngest handles outbound
 * sends, this can be reduced.
 */
export async function withTenantContext<T>(
  salonId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!salonId || salonId.trim().length === 0) {
    throw new Error('withTenantContext requires a non-empty salonId');
  }
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${salonId}, true)`;
      return tenantStore.run(tx, fn);
    },
    { timeout: 60_000 },
  );
}

