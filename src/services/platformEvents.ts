import type { PlatformEventType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export type EmitPlatformEventInput = {
  type: PlatformEventType;
  salonId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Fire-and-forget platform activity log. */
export function emitPlatformEvent(input: EmitPlatformEventInput): void {
  void prisma.platformEvent
    .create({
      data: {
        type: input.type,
        salonId: input.salonId ?? null,
        metadata: (input.metadata ?? {}) as object,
      },
    })
    .catch((err) => {
      logger.warn({ err, type: input.type }, 'platform_event_write_failed');
    });
}

export type PlatformEventDto = {
  id: string;
  type: PlatformEventType;
  salonId: string | null;
  tenantName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function listPlatformEvents(limit: number): Promise<PlatformEventDto[]> {
  const take = Math.min(Math.max(limit, 1), 100);
  const rows = await prisma.platformEvent.findMany({
    take,
    orderBy: { createdAt: 'desc' },
    include: {
      salon: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    salonId: row.salonId,
    tenantName: row.salon?.name ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  }));
}
