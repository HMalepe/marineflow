import type { ConversationStep, TicketType } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';
import {
  DEFAULT_SUPPORT_TICKET_KEYWORDS,
  matchesSupportTicketKeywords,
  mergeSupportTicketKeywordsIntoMetadata,
  parseSupportTicketKeywordsFromMetadata,
} from '../lib/supportTicketKeywords.js';

const OPEN_STATUSES = ['OPEN', 'WAITING_CUSTOMER'] as const;

const SUPPORT_SUBJECT_PREFIXES = [
  'Support',
  'Upset customer',
  'Complaint',
  'Human handoff',
  'Negative sentiment',
  'Customer needs human',
] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function parseMenuCategory(context: unknown): string | undefined {
  if (!isRecord(context)) return undefined;
  const raw = context.menuCategory;
  return typeof raw === 'string' ? raw : undefined;
}

/** Load keywords from salon metadata; seed defaults into the database when missing. */
export async function loadSupportTicketKeywords(salonId: string): Promise<string[]> {
  const db = getTenantDb();
  const salon = await db.salon.findUnique({
    where: { id: salonId },
    select: { metadata: true },
  });
  const existing = parseSupportTicketKeywordsFromMetadata(salon?.metadata);
  if (existing.length > 0) return existing;

  const defaults = [...DEFAULT_SUPPORT_TICKET_KEYWORDS];
  await db.salon.update({
    where: { id: salonId },
    data: {
      metadata: mergeSupportTicketKeywordsIntoMetadata(salon?.metadata, defaults),
    },
  });
  return defaults;
}

export function isInSupportTicketFlow(step: ConversationStep, context: unknown): boolean {
  if (step === 'COMPLAINT' || step === 'OTHER_QUERY') return true;
  if (step === 'FAQ') return false;
  return parseMenuCategory(context) === 'support';
}

export function supportTicketSubject(input: {
  upset: boolean;
  step: ConversationStep;
  context: unknown;
}): string {
  if (input.upset) return 'Upset customer — needs attention';
  if (input.step === 'COMPLAINT') return 'Support — reported issue';
  if (input.step === 'OTHER_QUERY') return 'Support — speak to reception';
  if (parseMenuCategory(input.context) === 'support') return 'Support request';
  return 'Support message';
}

async function findOpenSupportTicket(salonId: string, customerId: string) {
  const db = getTenantDb();
  return db.ticket.findFirst({
    where: {
      salonId,
      customerId,
      type: 'GENERAL',
      status: { in: [...OPEN_STATUSES] },
      OR: SUPPORT_SUBJECT_PREFIXES.map((prefix) => ({
        subject: { startsWith: prefix },
      })),
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/** Append to an open support ticket or create a new one. */
export async function recordSupportTicketMessage(input: {
  salonId: string;
  customerId: string;
  text: string;
  subject: string;
  type?: TicketType;
}): Promise<void> {
  const db = getTenantDb();
  const type = input.type ?? 'GENERAL';
  const existing =
    type === 'GENERAL'
      ? await findOpenSupportTicket(input.salonId, input.customerId)
      : await db.ticket.findFirst({
          where: {
            salonId: input.salonId,
            customerId: input.customerId,
            type,
            status: { in: [...OPEN_STATUSES] },
          },
          orderBy: { updatedAt: 'desc' },
        });

  if (existing) {
    await db.ticket.update({
      where: { id: existing.id },
      data: {
        subject: existing.subject ?? input.subject,
        inboundCount: { increment: 1 },
        updatedAt: new Date(),
        messages: {
          create: { direction: 'in', body: input.text },
        },
      },
    });
    return;
  }

  await db.ticket.create({
    data: {
      salonId: input.salonId,
      customerId: input.customerId,
      type,
      status: 'OPEN',
      inboundCount: 0,
      subject: input.subject,
      messages: {
        create: { direction: 'in', body: input.text },
      },
    },
  });
}

/**
 * Record a support ticket when the customer is in the Support bot path or uses upset language.
 * Returns true when a ticket was created/updated.
 */
export async function tryRecordSupportTicket(input: {
  salonId: string;
  customerId: string;
  text: string;
  step: ConversationStep;
  context: unknown;
  bookingFlowSteps: readonly ConversationStep[];
}): Promise<boolean> {
  const keywords = await loadSupportTicketKeywords(input.salonId);
  const upset = matchesSupportTicketKeywords(input.text, keywords);
  const inSupportFlow = isInSupportTicketFlow(input.step, input.context);
  const inBooking = input.bookingFlowSteps.includes(input.step);

  if (!upset && (!inSupportFlow || inBooking)) return false;

  await recordSupportTicketMessage({
    salonId: input.salonId,
    customerId: input.customerId,
    text: input.text,
    subject: supportTicketSubject({
      upset,
      step: input.step,
      context: input.context,
    }),
  });
  return true;
}
