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

const SAVEPOINT_LABEL = /^[a-z][a-z0-9_]{0,31}$/;

export function assertSavepointLabel(label: string): void {
  if (!SAVEPOINT_LABEL.test(label)) {
    throw new Error(`Invalid savepoint label: ${label}`);
  }
}

function savepointId(label: string): string {
  assertSavepointLabel(label);
  return `mfs_${label}_${Math.random().toString(36).slice(2, 9)}`;
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
 * Outbound WhatsApp sends are deferred until after commit (see botRequestContext).
 * AI assist may still run inside the transaction; keep a moderate timeout.
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
    { timeout: 30_000 },
  );
}

