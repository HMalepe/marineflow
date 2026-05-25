import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

export type PrismaTx = Prisma.TransactionClient;

const tenantStore = new AsyncLocalStorage<PrismaTx>();

/** Prisma client for the active tenant transaction, or the global client (platform tables). */
export function getTenantDb(): PrismaTx {
  return tenantStore.getStore() ?? (prisma as unknown as PrismaTx);
}

/**
 * Run work scoped to one salon (tenant). Sets Postgres session vars for RLS.
 * All tenant-scoped code in `fn` should use getTenantDb().
 *
 * Timeout is 30s because bot flows include outbound network calls (Twilio/Meta)
 * inside the transaction. Once Inngest handles outbound sends (Week 2+),
 * this can be reduced to 10s.
 */
export async function withTenantContext<T>(
  salonId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${salonId}, true)`;
      return tenantStore.run(tx, fn);
    },
    { timeout: 30_000 },
  );
}

