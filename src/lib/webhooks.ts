import { prisma } from './prisma.js';

/** Persist inbound webhook for dedup (spec: webhook_events, 7-day window). */
export async function recordWebhookEvent(input: {
  provider: string;
  providerEventId: string;
  payload: unknown;
  verified: boolean;
  salonId?: string;
}): Promise<'new' | 'duplicate'> {
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: input.provider,
        providerEventId: input.providerEventId,
        payload: input.payload as object,
        verified: input.verified,
        salonId: input.salonId,
        processedAt: new Date(),
      },
    });
    return 'new';
  } catch (e: unknown) {
    const code =
      e && typeof e === 'object' && 'code' in e && typeof (e as { code: string }).code === 'string'
        ? (e as { code: string }).code
        : '';
    if (code === 'P2002') return 'duplicate';
    throw e;
  }
}
