import type { WhatsappTemplate, WhatsappTemplateCategory, WhatsappTemplateStatus } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { logger } from '../lib/logger.js';
import {
  createWhatsappCardContent,
  deleteWhatsappCardContent,
  fetchWhatsappTemplateApproval,
  submitWhatsappTemplateApproval,
  validateWhatsappCardTemplate,
  type WhatsappCardAction,
} from '../lib/integrations/messaging/whatsappTemplateContent.js';

export class WhatsappTemplateBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhatsappTemplateBusinessError';
  }
}

export interface WhatsappTemplateApiShape {
  id: string;
  name: string;
  category: WhatsappTemplateCategory;
  language: string;
  headerText: string | null;
  mediaUrl: string | null;
  body: string;
  footer: string | null;
  buttons: WhatsappCardAction[];
  status: WhatsappTemplateStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeWhatsappTemplate(t: WhatsappTemplate): WhatsappTemplateApiShape {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    language: t.language,
    headerText: t.headerText,
    mediaUrl: t.mediaUrl,
    body: t.body,
    footer: t.footer,
    buttons: Array.isArray(t.buttons) ? (t.buttons as unknown as WhatsappCardAction[]) : [],
    status: t.status,
    rejectionReason: t.rejectionReason,
    submittedAt: t.submittedAt?.toISOString() ?? null,
    approvedAt: t.approvedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export interface CreateWhatsappTemplateParams {
  salonId: string;
  name: string;
  category: WhatsappTemplateCategory;
  language?: string;
  headerText?: string | null;
  mediaUrl?: string | null;
  body: string;
  footer?: string | null;
  buttons?: WhatsappCardAction[];
  createdBy?: string;
}

/**
 * Create a draft template and register it with Twilio's Content API as a
 * whatsapp/card resource. Drafts are not yet usable for sending — they must
 * be submitted and approved first (see submitWhatsappTemplateForReview).
 */
export async function createWhatsappTemplate(
  params: CreateWhatsappTemplateParams,
): Promise<WhatsappTemplate> {
  const card = {
    body: params.body,
    footer: params.footer,
    headerText: params.headerText,
    mediaUrl: params.mediaUrl,
    actions: params.buttons,
  };
  const errors = validateWhatsappCardTemplate(card);
  if (errors.length) throw new WhatsappTemplateBusinessError(errors[0]!);

  const db = getTenantDb();
  const existing = await db.whatsappTemplate.findUnique({
    where: { salonId_name: { salonId: params.salonId, name: params.name } },
  });
  if (existing) throw new WhatsappTemplateBusinessError('A template with this name already exists.');

  const language = params.language ?? 'en';
  const contentSid = await createWhatsappCardContent({
    friendlyName: `mf_${params.salonId}_${params.name}`.slice(0, 64),
    language,
    card,
  });

  return db.whatsappTemplate.create({
    data: {
      salonId: params.salonId,
      name: params.name,
      category: params.category,
      language,
      headerText: params.headerText ?? undefined,
      mediaUrl: params.mediaUrl ?? undefined,
      body: params.body,
      footer: params.footer ?? undefined,
      buttons: (params.buttons ?? []) as object,
      contentSid,
      createdBy: params.createdBy,
    },
  });
}

export async function listWhatsappTemplates(): Promise<WhatsappTemplate[]> {
  const db = getTenantDb();
  return db.whatsappTemplate.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getWhatsappTemplate(id: string): Promise<WhatsappTemplate | null> {
  const db = getTenantDb();
  return db.whatsappTemplate.findFirst({ where: { id } });
}

/** Submit a draft (or previously rejected) template for Meta's WhatsApp review. */
export async function submitWhatsappTemplateForReview(id: string): Promise<WhatsappTemplate> {
  const db = getTenantDb();
  const template = await db.whatsappTemplate.findUniqueOrThrow({ where: { id } });

  if (template.status !== 'DRAFT' && template.status !== 'REJECTED') {
    throw new WhatsappTemplateBusinessError('Only draft or rejected templates can be submitted.');
  }
  if (!template.contentSid) {
    throw new WhatsappTemplateBusinessError('Template is missing its Twilio content resource.');
  }

  await submitWhatsappTemplateApproval({
    contentSid: template.contentSid,
    name: template.name,
    category: template.category,
  });

  return db.whatsappTemplate.update({
    where: { id },
    data: { status: 'PENDING', submittedAt: new Date(), rejectionReason: null },
  });
}

function mapTwilioStatus(status: string): WhatsappTemplateStatus | null {
  switch (status.toLowerCase()) {
    case 'approved':
      return 'APPROVED';
    case 'rejected':
      return 'REJECTED';
    case 'pending':
    case 'received':
      return 'PENDING';
    default:
      return null;
  }
}

/** Poll Twilio for the latest approval decision and persist it. */
export async function refreshWhatsappTemplateStatus(id: string): Promise<WhatsappTemplate> {
  const db = getTenantDb();
  const template = await db.whatsappTemplate.findUniqueOrThrow({ where: { id } });

  if (!template.contentSid || template.status === 'DRAFT') return template;

  try {
    const approval = await fetchWhatsappTemplateApproval(template.contentSid);
    const mapped = mapTwilioStatus(approval.status);
    if (!mapped || mapped === template.status) return template;

    return db.whatsappTemplate.update({
      where: { id },
      data: {
        status: mapped,
        rejectionReason: mapped === 'REJECTED' ? approval.rejectionReason : null,
        approvedAt: mapped === 'APPROVED' ? new Date() : template.approvedAt,
      },
    });
  } catch (err) {
    logger.warn({ err, templateId: id }, 'whatsapp_template_status_refresh_failed');
    return template;
  }
}

export async function deleteWhatsappTemplate(id: string): Promise<void> {
  const db = getTenantDb();
  const template = await db.whatsappTemplate.findUniqueOrThrow({ where: { id } });

  if (template.status === 'PENDING' || template.status === 'APPROVED') {
    throw new WhatsappTemplateBusinessError(
      'Pending or approved templates cannot be deleted — they may be in use by active campaigns.',
    );
  }

  if (template.contentSid) {
    await deleteWhatsappCardContent(template.contentSid);
  }
  await db.whatsappTemplate.delete({ where: { id } });
}
