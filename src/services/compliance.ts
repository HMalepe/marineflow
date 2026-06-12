import { getTenantDb } from '../lib/db/tenantSession.js';

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
      db.consentRecord.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      }),
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

  // Record the erasure as a consent event
  await db.consentRecord.create({
    data: {
      salonId: customer.salonId,
      customerId,
      type: 'erasure_completed',
      granted: false,
      revokedAt: new Date(),
      source: 'manual',
    },
  });

  return { erased: true, customerId };
}

/**
 * Record a consent event.
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

  return db.consentRecord.create({
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
}
