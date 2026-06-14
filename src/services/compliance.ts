import { ConversationStep, Prisma } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { logger } from '../lib/logger.js';

function isMissingConsentRecordTable(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2021' &&
    String(err.meta?.table ?? err.message).includes('ConsentRecord')
  );
}

/** Normalise inbound text for exact POPIA keyword matching (trim, uppercase, Unicode NFKC). */
export function normalizePopiaCommandText(text: string): string {
  return text.trim().normalize('NFKC').toUpperCase();
}

export function isPopiaDeleteCommand(text: string): boolean {
  return normalizePopiaCommandText(text) === 'DELETE';
}

export function isPopiaMyDataCommand(text: string): boolean {
  return normalizePopiaCommandText(text) === 'MYDATA';
}

export function isPopiaComplianceCommand(text: string): boolean {
  const n = normalizePopiaCommandText(text);
  return n === 'DELETE' || n === 'MYDATA';
}

export function isDeletedCustomer(customer: { displayName?: string | null }): boolean {
  return customer.displayName === 'Deleted Customer';
}

/** Subtle one-line POPIA rights reminder (after first booking/payment). */
export function buildPopiaRightsHint(): string {
  return '_(POPIA)_ Reply *MYDATA* to see what we store · *DELETE* to remove your personal info anytime.';
}

export function computeLoyaltyStampTotal(loyaltyActivity: { delta: number }[]): number {
  return Math.max(0, loyaltyActivity.reduce((sum, entry) => sum + entry.delta, 0));
}

/** Whether to append the one-time POPIA rights hint on first payment confirmation. */
export function shouldAttachPopiaRightsHint(params: {
  priorSucceededPayments: number;
  popiaRightsNotified?: boolean;
}): boolean {
  return params.priorSucceededPayments === 0 && !params.popiaRightsNotified;
}

export type CustomerDataExport = NonNullable<Awaited<ReturnType<typeof exportCustomerData>>>;

/** Format POPIA right-of-access summary for WhatsApp. */
export function formatMyDataAccessSummary(data: CustomerDataExport): string {
  if (isDeletedCustomer(data.customer)) {
    return [
      '📋 *Your data summary*',
      '',
      'Your personal information has been removed from our records.',
      `Bookings on record: ${data.appointments.length} (retained for legal compliance only)`,
      '',
      'Reply *1* to book again — we\'ll collect fresh details.',
    ].join('\n');
  }

  const name =
    [data.customer.firstName, data.customer.lastName].filter(Boolean).join(' ').trim() ||
    data.customer.displayName ||
    'Not provided';
  const stampTotal = computeLoyaltyStampTotal(data.loyaltyActivity);

  return [
    '📋 *Your data summary*',
    '',
    `Name: ${name}`,
    `Email: ${data.customer.email ?? 'Not provided'}`,
    `Bookings on record: ${data.appointments.length}`,
    `Loyalty stamps: ${stampTotal}`,
    '',
    'Booking and payment records are kept for legal compliance.',
    'Reply *DELETE* anytime to remove your personal information.',
  ].join('\n');
}

/**
 * Full data export for a customer (POPIA right of access).
 * Returns all personal data and activity associated with a customer.
 */
export async function exportCustomerData(customerId: string) {
  const db = getTenantDb();

  const [customer, appointments, messages, loyaltyLedger, consents, tickets, payments] =
    await Promise.all([
      db.customer.findUnique({ where: { id: customerId } }),
      db.appointment.findMany({
        where: { customerId },
        include: { service: { select: { name: true } }, staff: { select: { name: true } } },
        orderBy: { start: 'desc' },
      }),
      db.message.findMany({
        where: { conversation: { customerId } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, direction: true, body: true, channel: true, createdAt: true },
      }),
      db.loyaltyLedger.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      }),
      safeConsentRecords(customerId),
      db.ticket.findMany({
        where: { customerId },
        include: { messages: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.payment.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

  if (!customer) return null;

  return {
    exportedAt: new Date().toISOString(),
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      displayName: customer.displayName,
      email: customer.email,
      dateOfBirth: customer.dateOfBirth,
      waId: customer.waId,
      locale: customer.locale,
      tags: customer.tags,
      notes: customer.notes,
      source: customer.source,
      marketingConsent: customer.marketingConsent,
      marketingConsentStatus: customer.marketingConsentStatus,
      marketingConsentAt: customer.marketingConsentAt,
      createdAt: customer.createdAt,
    },
    appointments: appointments.map((a) => ({
      id: a.id,
      date: a.start,
      status: a.status,
      service: a.service?.name,
      staff: a.staff?.name,
    })),
    messages: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      channel: m.channel,
      date: m.createdAt,
    })),
    loyaltyActivity: loyaltyLedger.map((l) => ({
      delta: l.delta,
      reason: l.reason,
      date: l.createdAt,
    })),
    consents,
    tickets: tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      messages: t.messages.length,
      createdAt: t.createdAt,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      status: p.status,
      provider: p.provider,
      createdAt: p.createdAt,
    })),
  };
}

/**
 * Anonymize/erase customer data (POPIA right to erasure).
 * Removes PII but retains anonymized records for business integrity.
 */
export async function eraseCustomerData(customerId: string) {
  const db = getTenantDb();

  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return null;

  // Anonymize the customer record
  await db.customer.update({
    where: { id: customerId },
    data: {
      firstName: '[ERASED]',
      lastName: '[ERASED]',
      displayName: '[ERASED]',
      email: null,
      dateOfBirth: null,
      preferredStaffId: null,
      lastWinBackAt: null,
      noShowCount: 0,
      bookingCount: 0,
      noShowRisk: 'LOW',
      waId: `erased_${customerId.slice(0, 8)}`,
      notes: null,
      tags: [],
      marketingConsent: false,
      marketingConsentStatus: 'DECLINED',
      deletedAt: new Date(),
    },
  });

  // Delete message bodies (keep structure for analytics)
  await db.message.updateMany({
    where: { conversation: { customerId } },
    data: { body: '[ERASED]' },
  });

  await recordConsent({
    salonId: customer.salonId,
    customerId,
    type: 'erasure_completed',
    granted: false,
    source: 'manual',
  });

  return { erased: true, customerId };
}

/**
 * POPIA right to erasure via WhatsApp DELETE command.
 * Anonymises PII, retains bookings/payments/audit trail, keeps waId for identity continuity.
 */
export async function deleteCustomerData(
  customerId: string,
  salonId: string,
): Promise<{ alreadyDeleted: boolean }> {
  const db = getTenantDb();

  const customer = await db.customer.findFirst({
    where: { id: customerId, salonId },
  });
  if (!customer) return { alreadyDeleted: false };

  if (isDeletedCustomer(customer)) {
    await db.conversation.updateMany({
      where: { customerId, salonId },
      data: { step: ConversationStep.GREETING, context: {} },
    });
    return { alreadyDeleted: true };
  }

  try {
    await db.consentRecord.deleteMany({ where: { customerId, salonId } });
  } catch (err) {
    if (!isMissingConsentRecordTable(err)) throw err;
    logger.warn({ customerId, salonId }, 'consent_record_delete_skipped_missing_table');
  }
  await db.pushToken.deleteMany({ where: { customerId, salonId } });

  await db.customer.update({
    where: { id: customerId },
    data: {
      firstName: null,
      lastName: null,
      email: null,
      displayName: 'Deleted Customer',
      notes: null,
      tags: [],
      preferredStaffId: null,
      dateOfBirth: null,
      lastWinBackAt: null,
      loyaltyStampsCached: null,
      marketingConsent: false,
      marketingConsentStatus: 'DECLINED',
      marketingConsentAt: null,
      deletedAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      salonId,
      action: 'customer_data_deletion',
      entity: 'Customer',
      entityId: customerId,
      payload: {
        requestedVia: 'whatsapp',
        deletedAt: new Date().toISOString(),
      },
    },
  });

  await db.conversation.updateMany({
    where: { customerId, salonId },
    data: { step: ConversationStep.GREETING, context: {} },
  });

  return { alreadyDeleted: false };
}

export async function notifyPopiaRightsOnce(
  conversationId: string,
  sendHint: () => Promise<void>,
): Promise<boolean> {
  const db = getTenantDb();
  const conv = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) return false;

  const context = (conv.context ?? {}) as Record<string, unknown>;
  if (context.popiaRightsNotified) return false;

  await sendHint();
  await db.conversation.update({
    where: { id: conversationId },
    data: { context: { ...context, popiaRightsNotified: true } as object },
  });
  return true;
}

async function safeConsentRecords(customerId: string) {
  const db = getTenantDb();
  try {
    return await db.consentRecord.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  } catch (err) {
    if (!isMissingConsentRecordTable(err)) throw err;
    logger.warn({ customerId }, 'consent_record_read_skipped_missing_table');
    return [];
  }
}

/**
 * Record a consent event (POPIA audit trail). Non-fatal if the table is missing —
 * customer.marketingConsentStatus is the source of truth for campaigns.
 */
export async function recordConsent(params: {
  salonId: string;
  customerId: string;
  type: string;
  granted: boolean;
  source?: string;
  ipAddress?: string;
}) {
  const db = getTenantDb();

  try {
    return await db.consentRecord.create({
      data: {
        salonId: params.salonId,
        customerId: params.customerId,
        type: params.type,
        granted: params.granted,
        grantedAt: params.granted ? new Date() : null,
        revokedAt: params.granted ? null : new Date(),
        source: params.source ?? 'whatsapp',
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    if (!isMissingConsentRecordTable(err)) throw err;
    logger.warn(
      { salonId: params.salonId, customerId: params.customerId, type: params.type },
      'consent_record_write_skipped_missing_table',
    );
    return null;
  }
}
