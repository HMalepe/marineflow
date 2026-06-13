import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { requireAuth, requireRole } from './auth.js';
import { validateStrongPassword } from '../lib/salonPhoneLookup.js';
import { withUserTenant } from '../lib/db/withUserTenant.js';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { earnStampForCompletedVisit } from '../services/loyalty.js';
import { refundPaymentStaff } from '../services/payments.js';
import { fuzzySearchCustomers } from '../services/customerSearch.js';
import { sendWithFallback } from '../services/channelRouter.js';
import { MessageDirection, ConversationStep } from '@prisma/client';
import { emitMessageReceived } from '../lib/eventBus.js';
import {
  getPlans,
  getSalonSubscription,
  createPayfastSubscription,
  cancelSubscription,
  checkQuota,
} from '../services/subscription.js';
import { billingReturnUrl, resolveDashboardOrigin } from '../lib/billingUrls.js';
import {
  generatePresignedUpload,
  confirmUpload,
  listUploads,
  deleteUpload,
  uploadBuffer,
  CAMPAIGN_MEDIA_MIMES,
  UploadError,
} from '../services/uploads.js';
import { exportCustomerData, eraseCustomerData } from '../services/compliance.js';
import { generateWebhookSecret } from '../services/webhookDelivery.js';
import { embedFaqItem } from '../services/knowledge.js';
import type { FaqStatus } from '@prisma/client';
import {
  setMarketingConsent,
  parseMarketingConsentStatus,
} from '../services/marketingConsent.js';
import { recordCustomerNoShow, normalizeNoShowRisk } from '../services/noShowRisk.js';
import { clampRosterEnd, parseRosterDate } from '../lib/rosterRange.js';
import {
  mergeBotFlowIntoMetadata,
  parseBotFlowSettingsFromMetadata,
  validateBotFlowPayload,
  type CustomBotFlow,
} from '../lib/botFlowSettings.js';
import {
  loadWeeklyHoursSettings,
  saveWeeklyHoursSettings,
  seedStaffWorkingHoursFromBusiness,
} from '../services/businessHoursSettings.js';
import {
  businessRowsToScheduleDefaults,
  validateWeeklyHoursSettings,
  type WeeklyHoursSettings,
} from '../lib/businessHours.js';
import { DEFAULT_BUSINESS_HOURS } from '../lib/salonDefaults.js';
import {
  mergeAutomationsIntoMetadata,
  parseAutomationsFromMetadata,
  validateAutomationsPayload,
  type SalonAutomations,
} from '../lib/automationSettings.js';
import { getPublicReviewClaimInfo } from '../services/reviewIncentive.js';
import {
  clampInactivityDelay1,
  clampInactivityDelay2,
  sanitizeFollowUpMessage,
  validateFollowUpSettings,
} from '../lib/followUpMessages.js';
import { SEASONAL_CAMPAIGN_TEMPLATES } from '../lib/campaignTemplates.js';
import { maybeSendReferralPrompt } from '../services/referralProgram.js';

export type MarketingConsentStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';
import {
  cancelCampaign,
  countAudience,
  countOptedInCustomers,
  createCampaign,
  getCampaign,
  listCampaigns,
  listCustomerTags,
  queueCampaignSend,
  serializeCampaign,
  parseCampaignMediaType,
  validateCampaignMedia,
  updateCampaign,
  type AudienceFilter,
  campaignRequiresAudience,
  resolveCampaignScheduleAfterPatch,
} from '../services/campaigns.js';
import { claudeJson, isAnthropicConfigured } from '../lib/integrations/ai/claude.js';
import { inngest } from '../lib/inngest/client.js';

type FaqApiStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

function faqToApiStatus(status: FaqStatus): FaqApiStatus {
  if (status === 'APPROVED') return 'APPROVED';
  if (status === 'ARCHIVED') return 'REJECTED';
  return 'PENDING';
}

function faqFromApiStatus(status: FaqApiStatus): FaqStatus {
  if (status === 'APPROVED') return 'APPROVED';
  if (status === 'REJECTED') return 'ARCHIVED';
  return 'DRAFT';
}

function serializeFaq(item: {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  status: FaqStatus;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    sortOrder: item.sortOrder,
    status: faqToApiStatus(item.status),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function dashboardApiRoutes(app: FastifyInstance) {
  const UPLOAD_BODY_LIMIT = 17 * 1024 * 1024;

  app.get<{ Params: { token: string } }>(
    '/public/review-reward/:token',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request) => getPublicReviewClaimInfo(request.params.token),
  );

  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: UPLOAD_BODY_LIMIT },
    (_req, body, done) => {
      done(null, body);
    },
  );
  app.addHook('preHandler', async (request, reply) => {
    await requireAuth(request, reply);
  });

  app.patch('/me/name', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { name } = request.body as { name?: string };
      const trimmed = name?.trim();
      if (!trimmed || trimmed.length < 2 || trimmed.length > 80) {
        return reply.code(400).send({ error: 'invalid_name' });
      }
      const db = getTenantDb();
      const u = await db.staffUser.update({
        where: { id: user.sub },
        data: { name: trimmed },
        select: { id: true, email: true, name: true, role: true, salonId: true },
      });
      return { user: u };
    });
  });

  app.patch('/me/email', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { email } = request.body as { email?: string };
      const trimmed = email?.trim().toLowerCase();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return reply.code(400).send({ error: 'invalid_email' });
      }
      const db = getTenantDb();
      const u = await db.staffUser.update({
        where: { id: user.sub },
        data: { email: trimmed },
        select: { id: true, email: true, name: true, role: true, salonId: true },
      });
      return { user: u };
    });
  });

  app.post('/me/change-password', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { currentPassword, newPassword } = request.body as {
        currentPassword?: string;
        newPassword?: string;
      };
      if (!currentPassword || !newPassword) {
        return reply.code(400).send({ error: 'fields_required' });
      }
      const passwordError = validateStrongPassword(newPassword);
      if (passwordError) {
        return reply.code(400).send({ error: 'weak_password', message: passwordError });
      }
      const db = getTenantDb();
      const u = await db.staffUser.findUniqueOrThrow({
        where: { id: user.sub },
        select: { passwordHash: true },
      });
      const ok = await bcrypt.compare(currentPassword, u.passwordHash);
      if (!ok) {
        return reply.code(401).send({ error: 'wrong_current_password' });
      }
      const sameAsCurrent = await bcrypt.compare(newPassword, u.passwordHash);
      if (sameAsCurrent) {
        return reply.code(400).send({
          error: 'same_password',
          message: 'New password must be different from your current password',
        });
      }
      const hash = await bcrypt.hash(newPassword, 12);
      await db.staffUser.update({ where: { id: user.sub }, data: { passwordHash: hash } });
      await db.auditLog.create({
        data: {
          salonId: user.salonId,
          actorUserId: user.sub,
          action: 'PASSWORD_CHANGED',
          entity: 'StaffUser',
          entityId: user.sub,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        },
      });
      return { ok: true };
    });
  });

  app.get('/me', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const u = await db.staffUser.findUniqueOrThrow({
        where: { id: user.sub },
        select: { id: true, email: true, phone: true, name: true, role: true, salonId: true },
      });
      const salon = await db.salon.findUniqueOrThrow({
        where: { id: user.salonId },
        select: { name: true, tradingName: true },
      });
      const displayName = salon.tradingName?.trim() || salon.name;
      return {
        user: u,
        salon: { displayName, whatsappName: salon.name },
      };
    });
  });

  app.get('/settings', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const salon = await db.salon.findUniqueOrThrow({
        where: { id: user.salonId },
        select: {
          id: true,
          name: true,
          tradingName: true,
          logoUrl: true,
          timezone: true,
          openTime: true,
          closeTime: true,
          welcomeMessage: true,
          afterHoursMessage: true,
          status: true,
          botName: true,
          botAskMarketingConsent: true,
          botAllowStaffPick: true,
          botLoyaltyEnabled: true,
          botRequireDepositStep: true,
          botWinbackEnabled: true,
          botBirthdayEnabled: true,
          inactivityMessage1: true,
          inactivityMessage1DelayMin: true,
          inactivityMessage2: true,
          inactivityMessage2DelayMin: true,
          closingMessage: true,
          addressLine: true,
          phoneDisplay: true,
          contactEmail: true,
          mapsUrl: true,
          parkingNotes: true,
          googleReviewUrl: true,
          metadata: true,
          slug: true,
        },
      });
      const flow = parseBotFlowSettingsFromMetadata(salon.metadata);
      const automations = parseAutomationsFromMetadata(salon.metadata);
      const meta = typeof salon.metadata === 'object' && salon.metadata ? (salon.metadata as Record<string, unknown>) : {};
      return {
        salon: {
          ...salon,
          botActive: salon.status === 'ACTIVE',
          botFlowOrder: flow.order,
          botCustomFlows: flow.customFlows,
          automations,
          currentSpecial: typeof meta.currentSpecial === 'string' ? meta.currentSpecial : null,
        },
      };
    });
  });

  app.get('/settings/business-hours', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const hours = await loadWeeklyHoursSettings(user.salonId);
      return { hours };
    });
  });

  app.put<{ Body: WeeklyHoursSettings }>(
    '/settings/business-hours',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const body = request.body ?? ({} as WeeklyHoursSettings);
        const settings: WeeklyHoursSettings = {
          weekdayOpen: body.weekdayOpen ?? '09:00',
          weekdayClose: body.weekdayClose ?? '17:00',
          saturday: body.saturday ?? { closed: false, open: '09:00', close: '17:00' },
          sunday: body.sunday ?? { closed: true, open: '09:00', close: '17:00' },
          timezone: body.timezone ?? 'Africa/Johannesburg',
          holidayOverrides: body.holidayOverrides ?? {},
        };

        const validationError = validateWeeklyHoursSettings(settings);
        if (validationError) {
          reply.code(400);
          return { error: 'invalid_hours', message: validationError };
        }

        const hours = await saveWeeklyHoursSettings(user.salonId, settings, { syncRoster: true });
        await getTenantDb().auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'business_hours_update',
            entity: 'Salon',
            entityId: user.salonId,
          },
        });
        return { hours };
      });
    },
  );

  app.patch<{
    Body: {
      tradingName?: string | null;
      openTime?: string;
      closeTime?: string;
      timezone?: string;
      welcomeMessage?: string | null;
      afterHoursMessage?: string | null;
      logoUrl?: string | null;
      botActive?: boolean;
      status?: 'ACTIVE' | 'SUSPENDED';
      botName?: string;
      botAskMarketingConsent?: boolean;
      botAllowStaffPick?: boolean;
      botLoyaltyEnabled?: boolean;
      botRequireDepositStep?: boolean;
      botWinbackEnabled?: boolean;
      botBirthdayEnabled?: boolean;
      botFlowOrder?: string[];
      botCustomFlows?: CustomBotFlow[];
      automations?: Partial<SalonAutomations>;
      inactivityMessage1?: string | null;
      inactivityMessage1DelayMin?: number;
      inactivityMessage2?: string | null;
      inactivityMessage2DelayMin?: number;
      closingMessage?: string | null;
      addressLine?: string | null;
      phoneDisplay?: string | null;
      contactEmail?: string | null;
      mapsUrl?: string | null;
      parkingNotes?: string | null;
      googleReviewUrl?: string | null;
      currentSpecial?: string | null;
    };
  }>(
    '/settings',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const {
          tradingName,
          logoUrl,
          openTime,
          closeTime,
          timezone,
          welcomeMessage,
          afterHoursMessage,
          botActive,
          status,
          botName,
          botAskMarketingConsent,
          botAllowStaffPick,
          botLoyaltyEnabled,
          botRequireDepositStep,
          botWinbackEnabled,
          botBirthdayEnabled,
          botFlowOrder,
          botCustomFlows,
          automations,
          inactivityMessage1,
          inactivityMessage1DelayMin,
          inactivityMessage2,
          inactivityMessage2DelayMin,
          closingMessage,
          addressLine,
          phoneDisplay,
          contactEmail,
          mapsUrl,
          parkingNotes,
          googleReviewUrl,
          currentSpecial,
        } = request.body;

        if (logoUrl !== undefined && logoUrl !== null) {
          const maxBytes = 600_000; // ~600KB base64 → ~450KB image — enough for any logo
          if (logoUrl.length > maxBytes) {
            reply.code(400);
            return { error: 'logo_too_large' };
          }
          if (!logoUrl.startsWith('data:image/') && !/^https?:\/\//.test(logoUrl)) {
            reply.code(400);
            return { error: 'invalid_logo_url' };
          }
        }

        if (tradingName !== undefined && tradingName !== null && !tradingName.trim()) {
          reply.code(400);
          return { error: 'invalid_trading_name' };
        }

        const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (openTime !== undefined && !timeRe.test(openTime)) {
          reply.code(400);
          return { error: 'invalid_open_time' };
        }
        if (closeTime !== undefined && !timeRe.test(closeTime)) {
          reply.code(400);
          return { error: 'invalid_close_time' };
        }
        if (timezone !== undefined && !timezone.trim()) {
          reply.code(400);
          return { error: 'invalid_timezone' };
        }
        if (botName !== undefined) {
          const trimmed = botName.trim();
          if (!trimmed || trimmed.length < 2 || trimmed.length > 40) {
            reply.code(400);
            return { error: 'invalid_bot_name' };
          }
        }
        if (googleReviewUrl !== undefined && googleReviewUrl !== null) {
          const trimmedReviewUrl = googleReviewUrl.trim().replace(/[\r\n\t]/g, '');
          if (trimmedReviewUrl.length > 2048) {
            reply.code(400);
            return { error: 'invalid_google_review_url', message: 'Google Review URL must be 2048 characters or fewer' };
          }
          if (trimmedReviewUrl && !trimmedReviewUrl.startsWith('https://')) {
            reply.code(400);
            return { error: 'invalid_google_review_url', message: 'Google Review URL must start with https://' };
          }
        }

        const followUpTouched =
          inactivityMessage1 !== undefined ||
          inactivityMessage1DelayMin !== undefined ||
          inactivityMessage2 !== undefined ||
          inactivityMessage2DelayMin !== undefined ||
          closingMessage !== undefined;

        let resolvedDelay1: number | undefined;
        let resolvedDelay2: number | undefined;

        if (followUpTouched) {
          const existingFollowUp = await db.salon.findUnique({
            where: { id: user.salonId },
            select: {
              inactivityMessage1: true,
              inactivityMessage1DelayMin: true,
              inactivityMessage2: true,
              inactivityMessage2DelayMin: true,
              closingMessage: true,
            },
          });

          resolvedDelay1 =
            inactivityMessage1DelayMin !== undefined
              ? clampInactivityDelay1(inactivityMessage1DelayMin)
              : existingFollowUp?.inactivityMessage1DelayMin ?? 10;
          resolvedDelay2 =
            inactivityMessage2DelayMin !== undefined
              ? clampInactivityDelay2(inactivityMessage2DelayMin, resolvedDelay1)
              : existingFollowUp?.inactivityMessage2DelayMin ?? 30;

          const followUpValidation = validateFollowUpSettings({
            inactivityMessage1:
              inactivityMessage1 !== undefined
                ? inactivityMessage1
                : existingFollowUp?.inactivityMessage1,
            inactivityMessage1DelayMin: resolvedDelay1,
            inactivityMessage2:
              inactivityMessage2 !== undefined
                ? inactivityMessage2
                : existingFollowUp?.inactivityMessage2,
            inactivityMessage2DelayMin: resolvedDelay2,
            closingMessage:
              closingMessage !== undefined ? closingMessage : existingFollowUp?.closingMessage,
          });
          if (!followUpValidation.ok) {
            reply.code(400);
            return {
              error: 'invalid_follow_up_messages',
              message: followUpValidation.message,
              field: followUpValidation.field,
            };
          }
        }

        let nextStatus = status;
        if (botActive !== undefined) {
          nextStatus = botActive ? 'ACTIVE' : 'SUSPENDED';
        }

        let metadataPatch: ReturnType<typeof mergeBotFlowIntoMetadata> | undefined;
        const needsMetadata =
          botFlowOrder !== undefined || botCustomFlows !== undefined || automations !== undefined || currentSpecial !== undefined;
        if (needsMetadata) {
          const existing = await db.salon.findUniqueOrThrow({
            where: { id: user.salonId },
            select: { metadata: true },
          });
          let meta: unknown = existing.metadata;

          if (botFlowOrder !== undefined || botCustomFlows !== undefined) {
            const validated = validateBotFlowPayload(botFlowOrder, botCustomFlows);
            if ('error' in validated) {
              reply.code(400);
              return { error: 'invalid_bot_flow', message: validated.error };
            }
            meta = mergeBotFlowIntoMetadata(meta, validated.order, validated.customFlows);
          }

          if (automations !== undefined) {
            const current = parseAutomationsFromMetadata(meta);
            const validatedAuto = validateAutomationsPayload(automations, current);
            if ('error' in validatedAuto) {
              reply.code(400);
              return { error: 'invalid_automations', message: validatedAuto.error };
            }
            meta = mergeAutomationsIntoMetadata(meta, validatedAuto);
          }

          if (currentSpecial !== undefined) {
            const specialTrimmed = currentSpecial?.trim() ?? '';
            if (specialTrimmed.length > 160) {
              reply.code(400);
              return { error: 'special_too_long', message: 'Current special must be 160 characters or fewer.' };
            }
            meta = {
              ...(typeof meta === 'object' && meta !== null ? meta : {}),
              currentSpecial: specialTrimmed || null,
            };
          }

          metadataPatch = meta as ReturnType<typeof mergeBotFlowIntoMetadata>;
        }

        const updated = await db.salon.update({
          where: { id: user.salonId },
          data: {
            ...(metadataPatch !== undefined && { metadata: metadataPatch }),
            ...(tradingName !== undefined && {
              tradingName: tradingName?.trim() || null,
            }),
            ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
            ...(openTime !== undefined && { openTime }),
            ...(closeTime !== undefined && { closeTime }),
            ...(timezone !== undefined && { timezone: timezone.trim() }),
            ...(welcomeMessage !== undefined && { welcomeMessage: welcomeMessage?.trim() || null }),
            ...(afterHoursMessage !== undefined && {
              afterHoursMessage: afterHoursMessage?.trim() || null,
            }),
            ...(botName !== undefined && { botName: botName.trim() }),
            ...(botAskMarketingConsent !== undefined && { botAskMarketingConsent }),
            ...(botAllowStaffPick !== undefined && { botAllowStaffPick }),
            ...(botLoyaltyEnabled !== undefined && { botLoyaltyEnabled }),
            ...(botRequireDepositStep !== undefined && { botRequireDepositStep }),
            ...(botWinbackEnabled !== undefined && { botWinbackEnabled }),
            ...(botBirthdayEnabled !== undefined && { botBirthdayEnabled }),
            ...(inactivityMessage1 !== undefined && {
              inactivityMessage1: inactivityMessage1
                ? sanitizeFollowUpMessage(inactivityMessage1) || null
                : null,
            }),
            ...(inactivityMessage1DelayMin !== undefined && {
              inactivityMessage1DelayMin: resolvedDelay1 ?? clampInactivityDelay1(inactivityMessage1DelayMin),
            }),
            ...(inactivityMessage2 !== undefined && {
              inactivityMessage2: inactivityMessage2
                ? sanitizeFollowUpMessage(inactivityMessage2) || null
                : null,
            }),
            ...(inactivityMessage2DelayMin !== undefined && {
              inactivityMessage2DelayMin: resolvedDelay2 ?? clampInactivityDelay2(inactivityMessage2DelayMin, resolvedDelay1 ?? 10),
            }),
            ...(closingMessage !== undefined && {
              closingMessage: closingMessage ? sanitizeFollowUpMessage(closingMessage) || null : null,
            }),
            ...(nextStatus !== undefined && {
              status: nextStatus,
              statusChangedAt: new Date(),
            }),
            ...(addressLine !== undefined && { addressLine: addressLine?.trim() || null }),
            ...(phoneDisplay !== undefined && { phoneDisplay: phoneDisplay?.trim() || null }),
            ...(contactEmail !== undefined && { contactEmail: contactEmail?.trim() || null }),
            ...(mapsUrl !== undefined && { mapsUrl: mapsUrl?.trim() || null }),
            ...(parkingNotes !== undefined && { parkingNotes: parkingNotes?.trim() || null }),
            ...(googleReviewUrl !== undefined && {
              googleReviewUrl: googleReviewUrl?.trim().replace(/[\r\n\t]/g, '') || null,
            }),
          },
          select: {
            id: true,
            name: true,
            tradingName: true,
            logoUrl: true,
            timezone: true,
            openTime: true,
            closeTime: true,
            welcomeMessage: true,
            afterHoursMessage: true,
            status: true,
            addressLine: true,
            phoneDisplay: true,
            contactEmail: true,
            mapsUrl: true,
            parkingNotes: true,
            botName: true,
            botAskMarketingConsent: true,
            botAllowStaffPick: true,
            botLoyaltyEnabled: true,
            botRequireDepositStep: true,
            botWinbackEnabled: true,
            botBirthdayEnabled: true,
            inactivityMessage1: true,
            inactivityMessage1DelayMin: true,
            inactivityMessage2: true,
            inactivityMessage2DelayMin: true,
            closingMessage: true,
            googleReviewUrl: true,
            metadata: true,
          },
        });

        const flow = parseBotFlowSettingsFromMetadata(updated.metadata);
        const autoSettings = parseAutomationsFromMetadata(updated.metadata);
        const updatedMeta = typeof updated.metadata === 'object' && updated.metadata ? (updated.metadata as Record<string, unknown>) : {};
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'settings_update',
            entity: 'Salon',
            entityId: user.salonId,
          },
        });

        return {
          salon: {
            ...updated,
            botActive: updated.status === 'ACTIVE',
            botFlowOrder: flow.order,
            botCustomFlows: flow.customFlows,
            automations: autoSettings,
            currentSpecial: typeof updatedMeta.currentSpecial === 'string' ? updatedMeta.currentSpecial : null,
          },
        };
      });
    },
  );

  app.get('/settings/automations', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const salon = await getTenantDb().salon.findUniqueOrThrow({
        where: { id: user.salonId },
        select: { metadata: true },
      });
      return { automations: parseAutomationsFromMetadata(salon.metadata) };
    });
  });

  app.get('/campaigns/templates', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      return { templates: SEASONAL_CAMPAIGN_TEMPLATES };
    });
  });

  app.get('/appointments/today', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const rows = await db.appointment.findMany({
        where: {
          start: { gte: start, lt: end },
          status: { not: 'CANCELLED' },
        },
        include: {
          service: { select: { name: true, depositCents: true, fullPay: true } },
          staff: { select: { id: true, name: true, displayName: true, avatarUrl: true, deletedAt: true } },
          customer: {
            select: {
              displayName: true,
              waId: true,
              firstName: true,
              lastName: true,
              noShowRisk: true,
              noShowCount: true,
              bookingCount: true,
            },
          },
          payments: {
            where: { status: 'SUCCEEDED' },
            select: { id: true, amountCents: true, status: true },
            take: 1,
          },
        },
        orderBy: { start: 'asc' },
      });
      return { appointments: rows };
    });
  });

  app.get('/appointments', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as { from?: string; to?: string };
      const fromParsed = q.from ? new Date(q.from) : null;
      const toParsed = q.to ? new Date(q.to) : null;
      const from = fromParsed && !isNaN(fromParsed.getTime()) ? fromParsed : new Date(Date.now() - 7 * 86400000);
      const to = toParsed && !isNaN(toParsed.getTime()) ? toParsed : new Date(Date.now() + 30 * 86400000);

      const rows = await db.appointment.findMany({
        where: {
          start: { gte: from, lte: to },
        },
        include: {
          service: true,
          staff: true,
          branch: { select: { id: true, name: true } },
          customer: {
            select: {
              displayName: true,
              waId: true,
              firstName: true,
              lastName: true,
              noShowRisk: true,
              noShowCount: true,
              bookingCount: true,
            },
          },
        },
        orderBy: { start: 'asc' },
        take: 500,
      });
      return { appointments: rows };
    });
  });

  app.post<{ Params: { id: string } }>(
    '/appointments/:id/complete',
    { preHandler: requireRole('OWNER', 'MANAGER', 'STYLIST') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const appt = await db.appointment.findFirst({
          where: { id: request.params.id },
          include: { service: true, customer: { select: { waId: true } } },
        });
        if (!appt) {
          reply.code(404);
          return { error: 'not_found' };
        }
        if (appt.status === 'CANCELLED' || appt.status === 'COMPLETED' || appt.status === 'RESCHEDULED' || appt.status === 'NO_SHOW') {
          reply.code(409);
          return { error: 'invalid_status', message: `Cannot complete appointment with status ${appt.status}` };
        }

        await db.appointment.update({
          where: { id: appt.id },
          data: { status: 'COMPLETED' },
        });

        await earnStampForCompletedVisit({
          salonId: appt.salonId,
          customerId: appt.customerId,
          appointmentId: appt.id,
          service: appt.service,
        });

        await db.analyticsEvent.create({
          data: {
            salonId: appt.salonId,
            customerId: appt.customerId,
            appointmentId: appt.id,
            staffId: appt.staffId,
            type: 'appointment_completed_dashboard',
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'appointment_complete',
            entity: 'Appointment',
            entityId: appt.id,
          },
        });

        // Fire post-appointment rating event (best-effort — don't fail the complete action)
        await inngest.send({
          name: 'whatsapp/appointment.completed',
          data: {
            appointmentId: appt.id,
            salonId: appt.salonId,
            customerId: appt.customerId,
            customerWaId: appt.customer.waId,
          },
        }).catch(() => {});

        const completedCount = await db.appointment.count({
          where: { salonId: appt.salonId, customerId: appt.customerId, status: 'COMPLETED' },
        });
        void maybeSendReferralPrompt({
          salonId: appt.salonId,
          customerId: appt.customerId,
          completedVisits: completedCount,
        }).catch(() => {});

        return { ok: true };
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/appointments/:id/no-show',
    { preHandler: requireRole('OWNER', 'MANAGER', 'STYLIST') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const appt = await db.appointment.findFirst({
          where: { id: request.params.id },
          include: { payments: { where: { status: 'SUCCEEDED' }, select: { id: true } } },
        });
        if (!appt) {
          reply.code(404);
          return { error: 'not_found' };
        }
        if (appt.status === 'NO_SHOW') {
          reply.code(409);
          return { error: 'already_no_show', message: 'Appointment is already marked as a no-show.' };
        }
        if (appt.status === 'CANCELLED' || appt.status === 'COMPLETED' || appt.status === 'RESCHEDULED') {
          reply.code(409);
          return { error: 'invalid_status', message: `Cannot mark ${appt.status} appointment as no-show.` };
        }

        const customer = await db.customer.findFirst({
          where: { id: appt.customerId, deletedAt: null },
          select: { id: true, waId: true, marketingConsentStatus: true },
        });
        if (!customer) {
          reply.code(409);
          return { error: 'customer_unavailable', message: 'Customer record is not available.' };
        }

        // Forfeit deposit if one was paid
        const depositWasPaid = appt.status === 'CONFIRMED_PAID' || appt.payments.length > 0;
        await db.appointment.update({
          where: { id: appt.id },
          data: {
            status: 'NO_SHOW',
            noShowMarkedAt: new Date(),
            ...(depositWasPaid ? { depositForfeited: true } : {}),
          },
        });

        const noShowRisk = await recordCustomerNoShow(appt.customerId, db);

        await db.analyticsEvent.create({
          data: {
            salonId: appt.salonId,
            customerId: appt.customerId,
            appointmentId: appt.id,
            staffId: appt.staffId,
            type: 'no_show',
            payload: { source: 'dashboard', noShowRisk, depositForfeited: depositWasPaid },
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'appointment_no_show',
            entity: 'Appointment',
            entityId: appt.id,
          },
        });

        // Schedule a "we missed you" follow-up message 30 min later (best-effort)
        if (customer.waId && !customer.waId.startsWith('erased_') && customer.marketingConsentStatus === 'ACCEPTED') {
          void inngest.send({
            name: 'appointment/no_show.followup',
            data: {
              appointmentId: appt.id,
              salonId: appt.salonId,
              customerId: appt.customerId,
              customerWaId: customer.waId,
            },
            ts: Date.now() + 30 * 60 * 1000,
          }).catch(() => {});
        }

        return { ok: true, noShowRisk, depositForfeited: depositWasPaid };
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/appointments/:id/waive-penalty',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const appt = await db.appointment.findFirst({
          where: { id: request.params.id },
          include: {
            customer: { select: { id: true, waId: true, firstName: true, displayName: true } },
            salon: { select: { whatsappPhoneId: true, tradingName: true, name: true } },
          },
        });
        if (!appt) {
          reply.code(404);
          return { error: 'not_found' };
        }
        await db.appointment.update({
          where: { id: appt.id },
          data: {
            penaltyWaivedAt: new Date(),
            penaltyWaivedBy: user.sub,
            cancellationPenaltyApplied: false,
          },
        });
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'penalty_waived',
            entity: 'Appointment',
            entityId: appt.id,
          },
        });

        // Item 13: track penalty waiver in analytics for reporting
        await db.analyticsEvent.create({
          data: {
            salonId: user.salonId,
            customerId: appt.customerId,
            appointmentId: appt.id,
            type: 'penalty_waived',
            payload: { waivedBy: user.sub },
          },
        });

        // Notify the customer on WhatsApp — best-effort, never fails the request
        const { waId, firstName, displayName } = appt.customer;
        if (waId && !waId.startsWith('erased_')) {
          const salonName = appt.salon.tradingName ?? appt.salon.name;
          const firstName_ = displayName ?? firstName ?? 'there';
          void sendWithFallback({
            salonId: user.salonId,
            to: waId,
            body: `Hi ${firstName_} 😊 Good news — ${salonName} has waived your cancellation fee. We hope to see you again soon!`,
          }).catch(() => {});
        }

        return { ok: true };
      });
    },
  );

  app.get('/analytics/stylist-leaderboard', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const salon = await db.salon.findUniqueOrThrow({
        where: { id: user.salonId },
        select: { metadata: true },
      });
      const automations = parseAutomationsFromMetadata(salon.metadata);

      const safeQuery = async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
        try {
          return await db.$queryRawUnsafe<T[]>(sql, ...args);
        } catch {
          return [];
        }
      };

      const [performance, ratings, rebooking] = await Promise.all([
        safeQuery<{
          staffId: string;
          staffName: string;
          completed: number;
          revenue_cents: number;
          no_shows: number;
        }>(
          `SELECT sp."staffId", s.name as "staffName",
                  sp.completed::int, sp.revenue_cents::int, sp.no_shows::int
           FROM mv_staff_performance sp
           JOIN "Staff" s ON s.id = sp."staffId"
           WHERE sp."salonId" = $1
             AND sp.month = DATE_TRUNC('month', NOW())
           ORDER BY sp.revenue_cents DESC`,
          user.salonId,
        ),
        safeQuery<{ staffId: string; avg_rating: number; rating_count: number }>(
          `SELECT a."staffId",
                  ROUND(AVG(a."csatScore")::numeric, 2)::float as avg_rating,
                  COUNT(*)::int as rating_count
           FROM "Appointment" a
           WHERE a."salonId" = $1 AND a."csatScore" IS NOT NULL
             AND a."start" >= NOW() - INTERVAL '90 days'
           GROUP BY a."staffId"`,
          user.salonId,
        ),
        safeQuery<{ staffId: string; rebooking_rate: number }>(
          `SELECT a."staffId",
                  ROUND(
                    100.0 * COUNT(DISTINCT CASE WHEN c."bookingCount" > 1 THEN a."customerId" END)
                    / NULLIF(COUNT(DISTINCT a."customerId"), 0),
                    1
                  )::float as rebooking_rate
           FROM "Appointment" a
           JOIN "Customer" c ON c.id = a."customerId"
           WHERE a."salonId" = $1 AND a.status = 'COMPLETED'
             AND a."start" >= NOW() - INTERVAL '90 days'
           GROUP BY a."staffId"`,
          user.salonId,
        ),
      ]);

      const ratingMap = new Map(ratings.map((r) => [r.staffId, r]));
      const rebookMap = new Map(rebooking.map((r) => [r.staffId, r]));

      const leaderboard = performance.map((p, index) => {
        const rating = ratingMap.get(p.staffId);
        const rebook = rebookMap.get(p.staffId);
        const incentiveCents = automations.stylistPerformance.incentiveEnabled
          ? Math.round(
              p.revenue_cents * (automations.stylistPerformance.incentivePercentPerCut / 100),
            )
          : 0;
        return {
          rank: index + 1,
          staffId: p.staffId,
          staffName: p.staffName,
          completed: p.completed,
          revenueCents: p.revenue_cents,
          noShows: p.no_shows,
          avgRating: rating?.avg_rating ?? null,
          ratingCount: rating?.rating_count ?? 0,
          rebookingRate: rebook?.rebooking_rate ?? null,
          incentiveCents,
          stars: rating?.avg_rating ? Math.round(rating.avg_rating) : 0,
        };
      });

      return {
        enabled: automations.stylistPerformance.enabled,
        incentiveEnabled: automations.stylistPerformance.incentiveEnabled,
        incentivePercentPerCut: automations.stylistPerformance.incentivePercentPerCut,
        leaderboard,
      };
    });
  });

  app.get('/membership/plans', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const plans = await getTenantDb().membershipPlan.findMany({
        where: { salonId: user.salonId },
        orderBy: { sortOrder: 'asc' },
      });
      return { plans };
    });
  });

  app.post<{ Body: { name: string; description?: string; priceCents: number; visitsPerMonth?: number; savingsCents?: number } }>(
    '/membership/plans',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { name, description, priceCents, visitsPerMonth, savingsCents } = request.body ?? {};
        if (!name?.trim() || !Number.isFinite(priceCents) || priceCents <= 0) {
          reply.code(400);
          return { error: 'invalid_plan' };
        }
        const plan = await getTenantDb().membershipPlan.create({
          data: {
            salonId: user.salonId,
            name: name.trim(),
            description: description?.trim() || null,
            priceCents,
            visitsPerMonth: visitsPerMonth ?? 4,
            savingsCents: savingsCents ?? 0,
          },
        });
        return { plan };
      });
    },
  );

  app.get<{ Params: { serviceId: string } }>('/services/:serviceId/addons', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const addons = await getTenantDb().serviceAddon.findMany({
        where: { salonId: user.salonId, serviceId: request.params.serviceId },
        include: { addonService: { select: { id: true, name: true, priceCents: true, durationMin: true } } },
        orderBy: { sortOrder: 'asc' },
      });
      return { addons };
    });
  });

  app.post<{ Params: { serviceId: string }; Body: { addonServiceId: string; pitchMessage?: string; sortOrder?: number } }>(
    '/services/:serviceId/addons',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { addonServiceId, pitchMessage, sortOrder } = request.body ?? {};
        if (!addonServiceId) {
          reply.code(400);
          return { error: 'addon_service_required' };
        }
        const addon = await getTenantDb().serviceAddon.create({
          data: {
            salonId: user.salonId,
            serviceId: request.params.serviceId,
            addonServiceId,
            pitchMessage: pitchMessage?.trim() || null,
            sortOrder: sortOrder ?? 0,
          },
          include: { addonService: { select: { id: true, name: true, priceCents: true } } },
        });
        return { addon };
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/service-addons/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        await getTenantDb().serviceAddon.deleteMany({
          where: { id: request.params.id, salonId: user.salonId },
        });
        return { ok: true };
      });
    },
  );

  app.post<{ Params: { id: string }; Body: { csat?: number } }>(
    '/appointments/:id/csat',
    async (request, reply) => {
      return withUserTenant(request, reply, async () => {
        const db = getTenantDb();
        const score = request.body?.csat;
        if (typeof score !== 'number' || score < 1 || score > 5) {
          reply.code(400);
          return { error: 'invalid_csat' };
        }
        const appt = await db.appointment.findFirst({
          where: { id: request.params.id },
        });
        if (!appt) {
          reply.code(404);
          return { error: 'not_found' };
        }

        await db.analyticsEvent.create({
          data: {
            salonId: appt.salonId,
            customerId: appt.customerId,
            appointmentId: appt.id,
            type: 'csat',
            payload: { score },
          },
        });
        return { ok: true };
      });
    },
  );

  app.get('/tickets', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const tickets = await db.ticket.findMany({
        where: { salonId: user.salonId },
        include: { customer: true, messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
      return { tickets };
    });
  });

  app.post<{ Params: { id: string }; Body: { body: string } }>(
    '/tickets/:id/reply',
    { preHandler: requireRole('OWNER', 'MANAGER', 'STYLIST') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const ticket = await db.ticket.findFirst({
          where: { id: request.params.id, salonId: user.salonId },
          include: { customer: true },
        });
        if (!ticket) {
          reply.code(404);
          return { error: 'not_found' };
        }
        const body = request.body.body?.trim();
        if (!body) {
          reply.code(400);
          return { error: 'body_required' };
        }
        // Save message first — WhatsApp send is best-effort
        const message = await db.ticketMessage.create({ data: { ticketId: ticket.id, direction: 'out', body } });
        // Bump ticket updatedAt so it floats to top of the sorted list
        await db.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
        try {
          await sendWithFallback({ salonId: user.salonId, to: ticket.customer.waId, body });
        } catch {
          // message already persisted; WhatsApp failure is non-fatal
        }
        // Create a Message in the customer's active conversation if one exists
        const conversation = await db.conversation.findFirst({
          where: { customerId: ticket.customerId, salonId: user.salonId },
          orderBy: { updatedAt: 'desc' },
        });
        if (conversation) {
          await db.message.create({
            data: {
              conversationId: conversation.id,
              customerId: ticket.customerId,
              direction: 'OUTBOUND',
              body,
            },
          });
        }
        return { ok: true, message: { id: message.id, body: message.body, createdAt: message.createdAt, direction: message.direction } };
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/tickets/:id/resolve',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const ticket = await db.ticket.findFirst({
          where: { id: request.params.id, salonId: user.salonId },
          include: { customer: true },
        });
        if (!ticket) {
          reply.code(404);
          return { error: 'not_found' };
        }
        // Atomic update — guards against concurrent resolve requests both sending WhatsApp
        const updated = await db.ticket.updateMany({
          where: { id: ticket.id, status: { not: 'RESOLVED' } },
          data: { status: 'RESOLVED' },
        });
        if (updated.count === 0) {
          return { ok: true }; // already resolved (race or double-click)
        }
        try {
          await sendWithFallback({
            salonId: user.salonId,
            to: ticket.customer.waId,
            body: 'Your query has been resolved. Feel free to message us anytime! 😊',
          });
        } catch {
          // best-effort — ticket already marked resolved
        }
        return { ok: true };
      });
    },
  );

  app.patch<{ Params: { id: string }; Body: { status?: string; assigneeStaffUserId?: string | null } }>(
    '/tickets/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async () => {
        const db = getTenantDb();
        const t = await db.ticket.findFirst({
          where: { id: request.params.id },
        });
        if (!t) {
          reply.code(404);
          return { error: 'not_found' };
        }
        const validStatuses = ['OPEN', 'WAITING_CUSTOMER', 'RESOLVED'] as const;
        type ValidStatus = typeof validStatuses[number];
        const statusInput = request.body.status;
        if (statusInput && !validStatuses.includes(statusInput as ValidStatus)) {
          reply.code(400);
          return { error: 'invalid_status', valid: validStatuses };
        }
        const updated = await db.ticket.update({
          where: { id: t.id },
          data: {
            status: statusInput as ValidStatus | undefined,
            assigneeStaffUserId: request.body.assigneeStaffUserId,
          },
        });
        return { ticket: updated };
      });
    },
  );

  app.get('/faq', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const items = await db.faqItem.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      return { items };
    });
  });

  app.post<{ Body: { question: string; answer: string; keywords?: string[] } }>(
    '/faq',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { question, answer } = request.body;
        if (!question?.trim() || !answer?.trim()) {
          reply.code(400);
          return { error: 'invalid' };
        }
        const item = await db.faqItem.create({
          data: {
            salonId: user.salonId,
            question: question.trim(),
            answer: answer.trim(),
            keywords: request.body.keywords ?? [],
          },
        });
        return { item };
      });
    },
  );

  app.get('/reports/summary', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const since = new Date(Date.now() - 30 * 86400000);
      const [appts, revenue] = await Promise.all([
        db.appointment.groupBy({
          by: ['status'],
          where: { createdAt: { gte: since } },
          _count: true,
        }),
        db.payment.aggregate({
          where: {
            status: 'SUCCEEDED',
            createdAt: { gte: since },
          },
          _sum: { amountCents: true },
        }),
      ]);
      return {
        appointmentsByStatus: appts,
        revenueCents30d: revenue._sum.amountCents ?? 0,
      };
    });
  });

  app.get('/export/appointments.csv', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as { from?: string; to?: string };
      const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400000);
      const to = q.to ? new Date(q.to) : new Date();

      const rows = await db.appointment.findMany({
        where: { start: { gte: from, lte: to } },
        include: { service: true, staff: true, customer: true },
        orderBy: { start: 'asc' },
        take: 5000,
      });

      const header = 'id,start,end,status,service,staff,customerWa\n';
      const lines = rows.map((r) =>
        [
          r.id,
          r.start.toISOString(),
          r.end.toISOString(),
          r.status,
          csvEscape(r.service.name),
          csvEscape(r.staff.name),
          csvEscape(r.customer.waId),
        ].join(','),
      );
      const csv = header + lines.join('\n');
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="appointments.csv"')
        .send(csv);
    });
  });

  app.get('/export/payments.csv', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as { from?: string; to?: string };
      const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400000);
      const to = q.to ? new Date(q.to) : new Date();

      const rows = await db.payment.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { customer: true },
        orderBy: { createdAt: 'asc' },
        take: 5000,
      });

      const header = 'id,createdAt,status,amountCents,currency,customerWa,stripePaymentIntentId\n';
      const lines = rows.map((r) =>
        [
          r.id,
          r.createdAt.toISOString(),
          r.status,
          r.amountCents,
          r.currency,
          r.customer.waId,
          r.stripePaymentIntentId ?? '',
        ].join(','),
      );
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="payments.csv"')
        .send(header + lines.join('\n'));
    });
  });

  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/payments/:id/refund',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const reason = request.body?.reason?.trim();
        if (!reason) {
          reply.code(400);
          return { error: 'reason_required' };
        }
        try {
          await refundPaymentStaff({
            paymentId: request.params.id,
            actorUserId: user.sub,
            reason,
          });
        } catch {
          reply.code(400);
          return { error: 'refund_failed' };
        }
        return { ok: true };
      });
    },
  );

  app.get('/payments', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as {
        provider?: string;
        status?: string;
        from?: string;
        to?: string;
        limit?: string;
        offset?: string;
      };
      const take = Math.min(Number(q.limit) || 50, 200);
      const skip = Number(q.offset) || 0;

      const where: Record<string, unknown> = {};
      if (q.provider) where.provider = q.provider;
      if (q.status) where.status = q.status;
      if (q.from || q.to) {
        where.createdAt = {
          ...(q.from ? { gte: new Date(q.from) } : {}),
          ...(q.to ? { lte: new Date(q.to) } : {}),
        };
      }

      const [payments, total] = await Promise.all([
        db.payment.findMany({
          where,
          include: { customer: { select: { id: true, waId: true, displayName: true } } },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        db.payment.count({ where }),
      ]);

      return { payments, total, take, skip };
    });
  });

  app.get('/audit', { preHandler: requireRole('OWNER') }, async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const logs = await db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return { logs };
    });
  });

  app.get('/staff', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const now = new Date();
      const staff = await db.staff.findMany({
        where: { deletedAt: null },
        include: {
          services: { include: { service: true } },
          workingHours: true,
          timeOff: {
            where: { end: { gte: now } },
            orderBy: { start: 'asc' },
          },
          _count: { select: { appointments: true } },
        },
        orderBy: { sortOrder: 'asc' },
      });
      return {
        staff: staff.map((s) => ({
          ...s,
          timeOff: s.timeOff.map((t) => ({
            id: t.id,
            start: t.start.toISOString().slice(0, 10),
            end: t.end.toISOString().slice(0, 10),
            reason: t.reason ?? null,
          })),
        })),
      };
    });
  });

  app.post<{
    Body: {
      name: string;
      displayName?: string | null;
      bio?: string | null;
      specialties?: string[];
      isBookable?: boolean;
      avatarUrl?: string | null;
    };
  }>('/staff', { preHandler: requireRole('OWNER', 'MANAGER') }, async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const { name, displayName, bio, specialties, isBookable, avatarUrl } = request.body;
      if (!name?.trim()) {
        reply.code(400);
        return { error: 'missing_name', message: 'Name is required.' };
      }
      const maxOrder = await db.staff.aggregate({
        where: { salonId: user.salonId, deletedAt: null },
        _max: { sortOrder: true },
      });
      const staff = await db.staff.create({
        data: {
          salonId: user.salonId,
          name: name.trim(),
          displayName: displayName?.trim() || null,
          bio: bio?.trim() || null,
          specialties: specialties ?? [],
          isBookable: isBookable ?? true,
          avatarUrl: avatarUrl ?? null,
          sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        },
        include: { workingHours: true },
      });
      await db.auditLog.create({
        data: {
          salonId: user.salonId,
          actorUserId: user.sub,
          action: 'staff_create',
          entity: 'Staff',
          entityId: staff.id,
        },
      });
      await seedStaffWorkingHoursFromBusiness(user.salonId, staff.id);
      const withHours = await db.staff.findUniqueOrThrow({
        where: { id: staff.id },
        include: { workingHours: true },
      });
      return { staff: withHours };
    });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      displayName?: string | null;
      bio?: string | null;
      specialties?: string[];
      isBookable?: boolean;
      avatarUrl?: string | null;
      active?: boolean;
    };
  }>('/staff/:id', { preHandler: requireRole('OWNER', 'MANAGER') }, async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const existing = await db.staff.findFirst({
        where: { id: request.params.id, salonId: user.salonId, deletedAt: null },
      });
      if (!existing) {
        reply.code(404);
        return { error: 'not_found' };
      }
      const body = request.body;
      const staff = await db.staff.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.displayName !== undefined ? { displayName: body.displayName?.trim() || null } : {}),
          ...(body.bio !== undefined ? { bio: body.bio?.trim() || null } : {}),
          ...(body.specialties !== undefined ? { specialties: body.specialties } : {}),
          ...(body.isBookable !== undefined ? { isBookable: body.isBookable } : {}),
          ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
        include: { workingHours: true },
      });
      await db.auditLog.create({
        data: {
          salonId: user.salonId,
          actorUserId: user.sub,
          action: 'staff_update',
          entity: 'Staff',
          entityId: staff.id,
        },
      });
      return { staff };
    });
  });

  app.delete<{ Params: { id: string } }>(
    '/staff/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.staff.findFirst({
          where: { id: request.params.id, salonId: user.salonId, deletedAt: null },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }
        await db.staff.update({
          where: { id: existing.id },
          data: { deletedAt: new Date(), active: false, isBookable: false },
        });
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'staff_delete',
            entity: 'Staff',
            entityId: existing.id,
          },
        });
        return { ok: true };
      });
    },
  );

  app.put<{
    Params: { id: string };
    Body: { hours: { weekday: number; startTime: string; endTime: string }[] };
  }>(
    '/staff/:id/working-hours',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { id } = request.params;
        const staff = await db.staff.findFirst({
          where: { id, salonId: user.salonId, deletedAt: null },
        });
        if (!staff) {
          reply.code(404);
          return { error: 'not_found', message: 'Staff member not found.' };
        }
        const hours = request.body.hours ?? [];
        const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
        for (const h of hours) {
          if (h.weekday < 0 || h.weekday > 6) {
            reply.code(400);
            return { error: 'invalid_weekday' };
          }
          if (!TIME_RE.test(h.startTime) || !TIME_RE.test(h.endTime)) {
            reply.code(400);
            return { error: 'invalid_time', message: 'Use HH:MM format.' };
          }
          if (h.startTime >= h.endTime) {
            reply.code(400);
            return { error: 'invalid_range', message: 'End time must be after start time.' };
          }
        }
        await db.workingHour.deleteMany({ where: { staffId: id } });
        if (hours.length > 0) {
          await db.workingHour.createMany({
            data: hours.map((h) => ({
              salonId: user.salonId,
              staffId: id,
              weekday: h.weekday,
              startTime: h.startTime,
              endTime: h.endTime,
            })),
          });
        }
        const updated = await db.workingHour.findMany({
          where: { staffId: id },
          orderBy: { weekday: 'asc' },
        });
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'staff_schedule_update',
            entity: 'Staff',
            entityId: id,
            payload: { days: hours.length },
          },
        });
        return { hours: updated };
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/staff/:id/time-off',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const staff = await db.staff.findFirst({
          where: { id: request.params.id, salonId: user.salonId, deletedAt: null },
        });
        if (!staff) {
          reply.code(404);
          return { error: 'not_found' };
        }
        const timeOff = await db.timeOff.findMany({
          where: { staffId: staff.id },
          orderBy: { start: 'asc' },
        });
        return {
          timeOff: timeOff.map((t) => ({
            id: t.id,
            start: t.start.toISOString().slice(0, 10),
            end: t.end.toISOString().slice(0, 10),
            reason: t.reason ?? null,
          })),
        };
      });
    },
  );

  // ─── Roster ──────────────────────────────────────────────────────────────

  app.get('/roster', { preHandler: requireRole('OWNER', 'MANAGER') }, async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as { from?: string; to?: string };

      const now = new Date();
      const from = parseRosterDate(q.from, now);
      const to = parseRosterDate(q.to, new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000));
      const clampedTo = clampRosterEnd(from, to);

      const staff = await db.staff.findMany({
        where: { deletedAt: null },
        include: {
          workingHours: true,
          timeOff: {
            where: { start: { lte: clampedTo }, end: { gte: from } },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      const businessRows = await db.businessHour.findMany({
        orderBy: { dayOfWeek: 'asc' },
      });
      const salonScheduleDefaults = businessRowsToScheduleDefaults(
        businessRows.length > 0
          ? businessRows.map((h) => ({
              dayOfWeek: h.dayOfWeek,
              openMin: h.openMin,
              closeMin: h.closeMin,
            }))
          : DEFAULT_BUSINESS_HOURS.map((h) => ({ ...h })),
      );

      return {
        salonScheduleDefaults,
        staff: staff.map((s) => ({
          id: s.id,
          name: s.name,
          displayName: s.displayName,
          avatarUrl: s.avatarUrl,
          active: s.active,
          isBookable: s.isBookable,
          workingHours: s.workingHours.map((wh) => ({
            id: wh.id,
            weekday: wh.weekday,
            startTime: wh.startTime,
            endTime: wh.endTime,
          })),
          // Return YYYY-MM-DD using UTC date parts — dates stored as midnight UTC in DB
          timeOff: s.timeOff.map((t) => ({
            id: t.id,
            start: t.start.toISOString().slice(0, 10),
            end:   t.end.toISOString().slice(0, 10),
            reason: t.reason ?? null,
          })),
        })),
      };
    });
  });

  app.post<{ Params: { id: string }; Body: { start: string; end: string; reason?: string } }>(
    '/staff/:id/time-off',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { id } = request.params;
        const { start, end, reason } = request.body;

        if (!start || !end) {
          reply.code(400);
          return { error: 'missing_fields', message: 'start and end are required.' };
        }

        const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
        if (!ISO_RE.test(start) || !ISO_RE.test(end)) {
          reply.code(400);
          return { error: 'invalid_dates', message: 'Use YYYY-MM-DD format.' };
        }

        const startDate = new Date(`${start}T00:00:00.000Z`);
        const endDate   = new Date(`${end}T00:00:00.000Z`);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          reply.code(400);
          return { error: 'invalid_dates', message: 'Invalid date value.' };
        }
        if (startDate > endDate) {
          reply.code(400);
          return { error: 'invalid_range', message: 'Start date must be on or before end date.' };
        }
        const diffDays = (endDate.getTime() - startDate.getTime()) / 86_400_000;
        if (diffDays > 180) {
          reply.code(400);
          return { error: 'range_too_large', message: 'Time-off range cannot exceed 180 days.' };
        }

        // Confirm staff belongs to this salon
        const staff = await db.staff.findFirst({
          where: { id, salonId: user.salonId, deletedAt: null },
        });
        if (!staff) {
          reply.code(404);
          return { error: 'not_found', message: 'Staff member not found.' };
        }

        const timeOff = await db.timeOff.create({
          data: { staffId: id, start: startDate, end: endDate, reason: reason?.trim() || null },
        });

        return {
          timeOff: {
            id:     timeOff.id,
            start:  timeOff.start.toISOString().slice(0, 10),
            end:    timeOff.end.toISOString().slice(0, 10),
            reason: timeOff.reason ?? null,
          },
        };
      });
    },
  );

  app.delete<{ Params: { id: string; timeOffId: string } }>(
    '/staff/:id/time-off/:timeOffId',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { id, timeOffId } = request.params;

        // Join on salonId so one tenant can't delete another's records
        const existing = await db.timeOff.findFirst({
          where: { id: timeOffId, staffId: id, staff: { salonId: user.salonId } },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found', message: 'Time-off record not found.' };
        }

        await db.timeOff.delete({ where: { id: timeOffId } });
        return { ok: true };
      });
    },
  );

  app.get('/working-hours', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as { staffId?: string };
      const where = q.staffId ? { staffId: q.staffId } : {};
      const hours = await db.workingHour.findMany({
        where,
        orderBy: [{ staffId: 'asc' }, { weekday: 'asc' }],
      });
      return { hours };
    });
  });

  app.get('/customers', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const q = request.query as {
        search?: string;
        tag?: string;
        limit?: string;
        offset?: string;
      };
      const take = Math.min(Number(q.limit) || 50, 200);
      const skip = Number(q.offset) || 0;

      const where: Record<string, unknown> = { deletedAt: null };
      if (q.tag) {
        where.tags = { has: q.tag };
      }
      if (q.search) {
        const term = q.search.trim();
        where.OR = [
          { displayName: { contains: term, mode: 'insensitive' } },
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { waId: { contains: term } },
          { email: { contains: term, mode: 'insensitive' } },
        ];
      }

      const [customers, total] = await Promise.all([
        db.customer.findMany({
          where,
          orderBy: { lastInteractionAt: { sort: 'desc', nulls: 'last' } },
          take,
          skip,
          include: { preferredStaff: { select: { id: true, name: true } } },
        }),
        db.customer.count({ where }),
      ]);

      return { customers, total, take, skip };
    });
  });

  app.get('/customers/search', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const q = request.query as { q?: string; limit?: string; threshold?: string };
      const query = q.q?.trim() ?? '';
      if (!query) return { results: [] };
      const results = await fuzzySearchCustomers(user.salonId, query, {
        limit: Math.min(Number(q.limit) || 20, 50),
        threshold: Number(q.threshold) || 0.3,
      });
      return { results };
    });
  });

  app.get<{ Params: { id: string } }>('/customers/:id', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const customer = await db.customer.findFirst({
        where: { id: request.params.id, deletedAt: null },
        include: {
          preferredStaff: { select: { id: true, name: true } },
        },
      });
      if (!customer) {
        reply.code(404);
        return { error: 'not_found' };
      }

      const [appointments, messages, loyaltySum, clvAgg] = await Promise.all([
        db.appointment.findMany({
          where: { customerId: customer.id },
          take: 20,
          orderBy: { start: 'desc' },
          include: { service: true, staff: true },
        }),
        db.message.findMany({
          where: { conversation: { customerId: customer.id } },
          take: 30,
          orderBy: { createdAt: 'desc' },
        }),
        db.loyaltyLedger.aggregate({
          where: { customerId: customer.id },
          _sum: { delta: true },
        }),
        // Item 28: CLV = total paid across all invoices
        db.payment.aggregate({
          where: { customerId: customer.id, status: 'SUCCEEDED' },
          _sum: { amountCents: true },
        }),
      ]);

      return {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        displayName: customer.displayName,
        email: customer.email,
        waId: customer.waId,
        marketingConsent: customer.marketingConsent,
        marketingConsentStatus: customer.marketingConsentStatus,
        marketingConsentAt: customer.marketingConsentAt?.toISOString() ?? null,
        noShowCount: customer.noShowCount,
        bookingCount: customer.bookingCount,
        noShowRisk: normalizeNoShowRisk(customer.noShowRisk),
        createdAt: customer.createdAt,
        loyaltyStamps: loyaltySum._sum.delta ?? 0,
        lifetimeValueCents: clvAgg._sum?.amountCents ?? 0,
        tags: customer.tags,
        dateOfBirth: customer.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        appointments: appointments.map((a) => ({
          id: a.id,
          start: a.start,
          status: a.status,
          serviceName: a.service?.name ?? 'Unknown',
          staffName: a.staff?.name ?? 'Unknown',
        })),
        messages: messages.reverse().map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          createdAt: m.createdAt,
        })),
      };
    });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      tags?: string[];
      notes?: string;
      marketingConsent?: boolean;
      marketingConsentStatus?: MarketingConsentStatus;
      preferredStaffId?: string | null;
      dateOfBirth?: string | null;
    };
  }>(
    '/customers/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.customer.findFirst({
          where: { id: request.params.id, deletedAt: null },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        const data: Record<string, unknown> = {};
        if (request.body.tags !== undefined) data.tags = request.body.tags;
        if (request.body.notes !== undefined) data.notes = request.body.notes;
        if (request.body.dateOfBirth !== undefined) {
          data.dateOfBirth = request.body.dateOfBirth ? new Date(request.body.dateOfBirth) : null;
        }
        if (request.body.preferredStaffId !== undefined) {
          // Must reference a non-deleted staff member of THIS salon — otherwise
          // a bad/cross-tenant id would 500 on the FK or leak a foreign reference.
          if (request.body.preferredStaffId !== null) {
            const staffExists = await db.staff.findFirst({
              where: { id: request.body.preferredStaffId, salonId: user.salonId, deletedAt: null },
              select: { id: true },
            });
            if (!staffExists) {
              reply.code(400);
              return {
                error: 'invalid_preferred_staff',
                message: 'preferredStaffId must reference an existing staff member of this salon.',
              };
            }
          }
          data.preferredStaffId = request.body.preferredStaffId;
        }

        if (request.body.marketingConsentStatus !== undefined) {
          const status = parseMarketingConsentStatus(request.body.marketingConsentStatus);
          if (!status) {
            reply.code(400);
            return {
              error: 'invalid_consent_status',
              message: 'Marketing consent status must be PENDING, ACCEPTED, or DECLINED.',
            };
          }
          await setMarketingConsent({
            customerId: existing.id,
            salonId: user.salonId,
            status,
            source: 'dashboard',
          });
        } else if (request.body.marketingConsent !== undefined) {
          await setMarketingConsent({
            customerId: existing.id,
            salonId: user.salonId,
            status: request.body.marketingConsent ? 'ACCEPTED' : 'DECLINED',
            source: 'dashboard',
          });
        }

        const patchData = { ...data };

        if (Object.keys(patchData).length > 0) {
          await db.customer.update({ where: { id: existing.id }, data: patchData });
        }

        const finalCustomer = await db.customer.findUniqueOrThrow({ where: { id: existing.id } });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'customer_update',
            entity: 'Customer',
            entityId: existing.id,
            payload: {
              ...patchData,
              ...(request.body.marketingConsentStatus !== undefined ||
              request.body.marketingConsent !== undefined
                ? { marketingConsentStatus: finalCustomer.marketingConsentStatus }
                : {}),
            } as unknown as Record<string, string | number | boolean | null>,
          },
        });

        return { customer: finalCustomer };
      });
    },
  );

  // ── Customer merge ─────────────────────────────────────────

  app.post<{
    Params: { id: string };
    Body: { secondaryId: string };
  }>(
    '/customers/:id/merge',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { id } = request.params;
        const { secondaryId } = request.body ?? {};

        if (!secondaryId || typeof secondaryId !== 'string') {
          reply.code(400);
          return { error: 'bad_request', message: 'secondaryId is required.' };
        }
        if (id === secondaryId) {
          reply.code(400);
          return { error: 'same_customer', message: 'Cannot merge a customer with itself.' };
        }

        const db = getTenantDb();
        const [primary, secondary] = await Promise.all([
          db.customer.findFirst({ where: { id, salonId: user.salonId, deletedAt: null } }),
          db.customer.findFirst({ where: { id: secondaryId, salonId: user.salonId, deletedAt: null } }),
        ]);

        if (!primary || !secondary) {
          reply.code(404);
          return { error: 'not_found', message: 'One or both customers not found.' };
        }

        const mergedWaId = (() => {
          const raw = primary.waId ?? secondary.waId ?? null;
          if (!raw) return null;
          return raw.startsWith('+') ? raw : `+${raw}`;
        })();

        await db.conversation.updateMany({ where: { customerId: secondaryId }, data: { customerId: id } });
        await db.appointment.updateMany({ where: { customerId: secondaryId }, data: { customerId: id } });
        await db.loyaltyLedger.updateMany({ where: { customerId: secondaryId }, data: { customerId: id } });
        await db.analyticsEvent.updateMany({ where: { customerId: secondaryId }, data: { customerId: id } });

        await db.customer.update({
          where: { id },
          data: {
            firstName: primary.firstName || secondary.firstName || null,
            lastName: primary.lastName || secondary.lastName || null,
            displayName: primary.displayName || secondary.displayName || null,
            email: primary.email || secondary.email || null,
            waId: mergedWaId ?? undefined,
            noShowCount: primary.noShowCount + secondary.noShowCount,
            bookingCount: primary.bookingCount + secondary.bookingCount,
          },
        });

        await db.customer.update({ where: { id: secondaryId }, data: { deletedAt: new Date() } });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'customer_merge',
            entity: 'Customer',
            entityId: id,
            payload: { secondaryId } as unknown as Record<string, string>,
          },
        });

        return { ok: true, primaryId: id };
      });
    },
  );

  // ── Branch CRUD ────────────────────────────────────────────

  app.get('/branches', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const branches = await db.branch.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { staff: true, appointments: true } } },
      });
      return { branches };
    });
  });

  app.post<{ Body: { name: string; address?: string; city?: string; province?: string; postalCode?: string; phone?: string; email?: string; timezone?: string; slug?: string } }>(
    '/branches',
    { preHandler: requireRole('OWNER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { name, address, city, province, postalCode, phone, email, timezone, slug } = request.body;
        if (!name || name.trim().length === 0) {
          reply.code(400);
          return { error: 'name_required' };
        }
        const branch = await db.branch.create({
          data: {
            salonId: user.salonId,
            name: name.trim(),
            slug: slug?.trim() || name.trim().toLowerCase().replace(/\s+/g, '-'),
            address, city, province, postalCode, phone, email, timezone,
          },
        });
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'branch_create',
            entity: 'Branch',
            entityId: branch.id,
          },
        });
        return { branch };
      });
    },
  );

  app.patch<{ Params: { id: string }; Body: { name?: string; address?: string; city?: string; province?: string; postalCode?: string; phone?: string; email?: string; timezone?: string; isActive?: boolean; sortOrder?: number } }>(
    '/branches/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.branch.findFirst({ where: { id: request.params.id } });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }
        const { name, address, city, province, postalCode, phone, email, timezone, isActive, sortOrder } = request.body;
        const updated = await db.branch.update({
          where: { id: existing.id },
          data: {
            ...(name !== undefined && { name }),
            ...(address !== undefined && { address }),
            ...(city !== undefined && { city }),
            ...(province !== undefined && { province }),
            ...(postalCode !== undefined && { postalCode }),
            ...(phone !== undefined && { phone }),
            ...(email !== undefined && { email }),
            ...(timezone !== undefined && { timezone }),
            ...(isActive !== undefined && { isActive }),
            ...(sortOrder !== undefined && { sortOrder }),
          },
        });
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'branch_update',
            entity: 'Branch',
            entityId: existing.id,
          },
        });
        return { branch: updated };
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/branches/:id',
    { preHandler: requireRole('OWNER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.branch.findFirst({ where: { id: request.params.id } });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }
        const staffCount = await db.staff.count({ where: { branchId: existing.id, deletedAt: null } });
        if (staffCount > 0) {
          reply.code(409);
          return { error: 'branch_has_staff', message: 'Reassign staff before deleting branch' };
        }
        await db.branch.delete({ where: { id: existing.id } });
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'branch_delete',
            entity: 'Branch',
            entityId: existing.id,
          },
        });
        return { ok: true };
      });
    },
  );

  // ── Service CRUD ────────────────────────────────────────────

  app.get('/services', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const services = await db.service.findMany({
        where: { deletedAt: null },
        include: { category: { select: { id: true, name: true } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return { services };
    });
  });

  app.post<{
    Body: {
      name: string;
      description?: string;
      priceCents: number;
      durationMin: number;
      bufferMin?: number;
      active?: boolean;
    };
  }>(
    '/services',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { name, description, priceCents, durationMin, bufferMin, active } = request.body;
        if (!name?.trim()) {
          reply.code(400);
          return { error: 'name_required' };
        }
        if (!Number.isFinite(priceCents) || priceCents < 0) {
          reply.code(400);
          return { error: 'invalid_price' };
        }
        if (!Number.isFinite(durationMin) || durationMin < 1) {
          reply.code(400);
          return { error: 'invalid_duration' };
        }

        const service = await db.service.create({
          data: {
            salonId: user.salonId,
            name: name.trim(),
            description: description?.trim() || null,
            priceCents: Math.round(priceCents),
            durationMin: Math.round(durationMin),
            bufferMin: Math.round(bufferMin ?? 0),
            active: active ?? true,
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'service_create',
            entity: 'Service',
            entityId: service.id,
          },
        });

        return { service };
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string | null;
      priceCents?: number;
      durationMin?: number;
      bufferMin?: number;
      active?: boolean;
    };
  }>(
    '/services/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.service.findFirst({
          where: { id: request.params.id, deletedAt: null },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        const { name, description, priceCents, durationMin, bufferMin, active } = request.body;
        if (name !== undefined && !name.trim()) {
          reply.code(400);
          return { error: 'name_required' };
        }
        if (priceCents !== undefined && (!Number.isFinite(priceCents) || priceCents < 0)) {
          reply.code(400);
          return { error: 'invalid_price' };
        }
        if (durationMin !== undefined && (!Number.isFinite(durationMin) || durationMin < 1)) {
          reply.code(400);
          return { error: 'invalid_duration' };
        }

        const updated = await db.service.update({
          where: { id: existing.id },
          data: {
            ...(name !== undefined && { name: name.trim() }),
            ...(description !== undefined && { description: description?.trim() || null }),
            ...(priceCents !== undefined && { priceCents: Math.round(priceCents) }),
            ...(durationMin !== undefined && { durationMin: Math.round(durationMin) }),
            ...(bufferMin !== undefined && { bufferMin: Math.round(bufferMin) }),
            ...(active !== undefined && { active }),
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'service_update',
            entity: 'Service',
            entityId: existing.id,
          },
        });

        return { service: updated };
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/services/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.service.findFirst({
          where: { id: request.params.id, deletedAt: null },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        const apptCount = await db.appointment.count({
          where: { serviceId: existing.id, status: { notIn: ['CANCELLED'] } },
        });
        if (apptCount > 0) {
          await db.service.update({
            where: { id: existing.id },
            data: { active: false },
          });
          await db.auditLog.create({
            data: {
              salonId: user.salonId,
              actorUserId: user.sub,
              action: 'service_deactivate',
              entity: 'Service',
              entityId: existing.id,
              payload: { reason: 'has_appointments' },
            },
          });
          return { ok: true, deactivated: true };
        }

        await db.service.update({
          where: { id: existing.id },
          data: { deletedAt: new Date(), active: false },
        });
        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'service_delete',
            entity: 'Service',
            entityId: existing.id,
          },
        });
        return { ok: true };
      });
    },
  );

  // ── Service sort order (Item 56) ────────────────────────────
  app.patch<{ Params: { id: string }; Body: { sortOrder: number } }>(
    '/services/:id/sort-order',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { sortOrder } = request.body;
        if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder) || sortOrder < 0) {
          reply.code(400);
          return { error: 'sortOrder must be a non-negative integer' };
        }
        const svc = await db.service.findFirst({ where: { id: request.params.id, salonId: user.salonId, deletedAt: null } });
        if (!svc) { reply.code(404); return { error: 'not_found' }; }
        await db.service.update({ where: { id: svc.id }, data: { sortOrder } });
        return { ok: true };
      });
    },
  );

  // ── FAQ CRUD ────────────────────────────────────────────────

  app.get('/faqs', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const items = await db.faqItem.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      return { faqs: items.map(serializeFaq) };
    });
  });

  app.post<{
    Body: { question: string; answer: string; sortOrder?: number };
  }>(
    '/faqs',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { question, answer, sortOrder } = request.body;
        if (!question?.trim() || !answer?.trim()) {
          reply.code(400);
          return { error: 'question_and_answer_required' };
        }

        let order = sortOrder;
        if (order === undefined || !Number.isFinite(order)) {
          const max = await db.faqItem.aggregate({ _max: { sortOrder: true } });
          order = (max._max.sortOrder ?? -1) + 1;
        }

        const item = await db.faqItem.create({
          data: {
            salonId: user.salonId,
            question: question.trim(),
            answer: answer.trim(),
            sortOrder: Math.round(order),
            status: 'DRAFT',
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'faq_create',
            entity: 'FaqItem',
            entityId: item.id,
          },
        });

        return { faq: serializeFaq(item) };
      });
    },
  );

  // ─── FAQ Smart Approve (must be before /faqs/:id to avoid param capture) ─
  app.post(
    '/faqs/smart-approve',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const pending = await db.faqItem.findMany({
          where: { salonId: user.salonId, status: faqFromApiStatus('PENDING') },
          select: { id: true, question: true, answer: true },
        });

        if (pending.length === 0) {
          return { results: [], message: 'No pending FAQs to review' };
        }

        // ── Phase 1: free regex check ──────────────────────────────────
        const PLACEHOLDER_RE = /\[(?!e\.g\.\s*\d|\d)[^\]]{2,}\]/i;
        const GENERIC_PHRASES = ['e.g.', '[e.g.', 'route name', 'route number', 'your business'];

        type Decision = { id: string; question: string; decision: 'approve' | 'needs_edit'; reason: string };
        const results: Decision[] = [];
        const needsAi: typeof pending = [];

        for (const faq of pending) {
          const combined = `${faq.question} ${faq.answer}`;
          const hasPlaceholder = PLACEHOLDER_RE.test(combined);
          const hasGeneric = GENERIC_PHRASES.some((p) => combined.toLowerCase().includes(p.toLowerCase()));

          if (hasPlaceholder || hasGeneric) {
            results.push({
              id: faq.id,
              question: faq.question,
              decision: 'needs_edit',
              reason: 'Contains unfilled placeholder text',
            });
          } else if (faq.answer.trim().length < 15) {
            results.push({
              id: faq.id,
              question: faq.question,
              decision: 'needs_edit',
              reason: 'Answer is too short',
            });
          } else {
            needsAi.push(faq);
          }
        }

        // ── Phase 2: one batched Haiku call for borderline FAQs ────────
        if (needsAi.length > 0 && isAnthropicConfigured()) {
          const numbered = needsAi
            .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer.slice(0, 300)}`)
            .join('\n\n');

          const aiResult = await claudeJson<{ results: Array<{ index: number; decision: 'approve' | 'needs_edit'; reason: string }> }>({
            system:
              'You review WhatsApp chatbot FAQ entries for a small business. ' +
              'Decide if each FAQ is complete and ready to use (approve) or needs editing (needs_edit). ' +
              'Flag needs_edit if: answer is vague/generic, clearly unfinished, or looks like a template not filled in. ' +
              'Approve if: the answer gives real, useful information a customer could act on. ' +
              'Be lenient — if it looks like genuine business content, approve it. ' +
              'Respond ONLY with JSON: {"results":[{"index":1,"decision":"approve","reason":"..."},...]}',
            user: `Review these ${needsAi.length} FAQ(s):\n\n${numbered}`,
            maxTokens: 600,
            model: 'claude-haiku-4-5-20251001',
          });

          if (aiResult?.results) {
            for (const r of aiResult.results) {
              const faq = needsAi[r.index - 1];
              if (faq) {
                results.push({ id: faq.id, question: faq.question, decision: r.decision, reason: r.reason });
              }
            }
          } else {
            for (const faq of needsAi) {
              results.push({ id: faq.id, question: faq.question, decision: 'approve', reason: 'Passed basic checks' });
            }
          }
        } else {
          for (const faq of needsAi) {
            results.push({ id: faq.id, question: faq.question, decision: 'approve', reason: 'Passed basic checks' });
          }
        }

        // ── Phase 3: apply approvals ──────────────────────────────────
        const { apply } = request.query as { apply?: string };
        if (apply === '1') {
          const toApprove = results.filter((r) => r.decision === 'approve').map((r) => r.id);
          if (toApprove.length > 0) {
            await db.faqItem.updateMany({
              where: { id: { in: toApprove }, salonId: user.salonId },
              data: { status: 'APPROVED' },
            });
          }
        }

        const approveCount = results.filter((r) => r.decision === 'approve').length;
        const needsEditCount = results.filter((r) => r.decision === 'needs_edit').length;
        return {
          results,
          summary: { total: results.length, approve: approveCount, needsEdit: needsEditCount },
          applied: apply === '1',
        };
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      question?: string;
      answer?: string;
      sortOrder?: number;
      status?: FaqApiStatus;
    };
  }>(
    '/faqs/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.faqItem.findFirst({
          where: { id: request.params.id },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        const { question, answer, sortOrder, status } = request.body;
        if (question !== undefined && !question.trim()) {
          reply.code(400);
          return { error: 'question_required' };
        }
        if (answer !== undefined && !answer.trim()) {
          reply.code(400);
          return { error: 'answer_required' };
        }
        if (status !== undefined && !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
          reply.code(400);
          return { error: 'invalid_status' };
        }

        const dbStatus = status !== undefined ? faqFromApiStatus(status) : undefined;
        const updated = await db.faqItem.update({
          where: { id: existing.id },
          data: {
            ...(question !== undefined && { question: question.trim() }),
            ...(answer !== undefined && { answer: answer.trim() }),
            ...(sortOrder !== undefined && { sortOrder: Math.round(sortOrder) }),
            ...(dbStatus !== undefined && {
              status: dbStatus,
              approvedAt: dbStatus === 'APPROVED' ? new Date() : null,
              approvedBy: dbStatus === 'APPROVED' ? user.sub : null,
            }),
          },
        });

        if (dbStatus === 'APPROVED') {
          try {
            await embedFaqItem(updated.id, user.salonId);
          } catch {
            // Embedding is best-effort; FAQ still saved
          }
        } else if (dbStatus === 'ARCHIVED' || dbStatus === 'DRAFT') {
          await db.faqEmbedding.deleteMany({ where: { faqItemId: updated.id } });
        } else if (
          dbStatus === undefined &&
          (question !== undefined || answer !== undefined) &&
          existing.status === 'APPROVED'
        ) {
          try {
            await embedFaqItem(updated.id, user.salonId);
          } catch {
            // best-effort re-embed after content edit
          }
        }

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'faq_update',
            entity: 'FaqItem',
            entityId: existing.id,
            payload: status ? { status } : undefined,
          },
        });

        return { faq: serializeFaq(updated) };
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/faqs/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const existing = await db.faqItem.findFirst({
          where: { id: request.params.id },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        await db.faqItem.delete({ where: { id: existing.id } });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'faq_delete',
            entity: 'FaqItem',
            entityId: existing.id,
          },
        });

        return { ok: true };
      });
    },
  );

  // ─── Analytics Overview ──────────────────────────────────────────────
  app.get('/analytics/overview', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const salonId = user.salonId;

      // Each query is wrapped individually — if a materialized view doesn't exist yet
      // (e.g. migration pending) we return an empty array rather than 500-ing the page.
      const safeQuery = async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
        try {
          return await db.$queryRawUnsafe<T[]>(sql, ...args);
        } catch {
          return [];
        }
      };

      const [dailyBookings, revenue, retention, staffPerformance, staffRatings, recentRatings] = await Promise.all([
        safeQuery<{ booking_date: string; total_bookings: number; completed: number; cancelled: number; no_shows: number }>(
          `SELECT booking_date::text, total_bookings::int, completed::int, cancelled::int, no_shows::int
           FROM mv_daily_bookings WHERE "salonId" = $1 ORDER BY booking_date DESC LIMIT 90`,
          salonId,
        ),
        safeQuery<{ month: string; total_revenue_cents: number; unique_customers: number; invoice_count: number }>(
          `SELECT month::text, total_revenue_cents::int, unique_customers::int, invoice_count::int
           FROM mv_revenue_summary WHERE "salonId" = $1 ORDER BY month DESC LIMIT 12`,
          salonId,
        ),
        safeQuery<{ month: string; unique_customers: number; returning_customers: number }>(
          `SELECT month::text, unique_customers::int, returning_customers::int
           FROM mv_customer_retention WHERE "salonId" = $1 ORDER BY month DESC LIMIT 12`,
          salonId,
        ),
        safeQuery<{ staffId: string; staffName: string; total_appointments: number; completed: number; no_shows: number; revenue_cents: number }>(
          `SELECT sp."staffId", s.name as "staffName",
                  sp.total_appointments::int, sp.completed::int, sp.no_shows::int, sp.revenue_cents::int
           FROM mv_staff_performance sp
           LEFT JOIN "Staff" s ON s.id = sp."staffId"
           WHERE sp."salonId" = $1
             AND sp.month = DATE_TRUNC('month', CURRENT_DATE)
           ORDER BY sp.revenue_cents DESC`,
          salonId,
        ),
        safeQuery<{ staffId: string; staffName: string; avg_rating: number; rating_count: number }>(
          `SELECT a."staffId", s.name as "staffName",
                  ROUND(AVG(a."csatScore")::numeric, 1)::float as avg_rating,
                  COUNT(a."csatScore")::int as rating_count
           FROM "Appointment" a
           LEFT JOIN "Staff" s ON s.id = a."staffId"
           WHERE a."salonId" = $1
             AND a."csatScore" IS NOT NULL
             AND a.start >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '3 months'
           GROUP BY a."staffId", s.name
           ORDER BY avg_rating DESC`,
          salonId,
        ),
        safeQuery<{ appointmentId: string; csatScore: number; start: string; firstName: string | null; lastName: string | null; waId: string; staffName: string | null; serviceName: string | null }>(
          `SELECT a.id as "appointmentId", a."csatScore", a.start::text,
                  c."firstName", c."lastName", c."waId",
                  s.name as "staffName", svc.name as "serviceName"
           FROM "Appointment" a
           LEFT JOIN "Customer" c ON c.id = a."customerId"
           LEFT JOIN "Staff" s ON s.id = a."staffId"
           LEFT JOIN "Service" svc ON svc.id = a."serviceId"
           WHERE a."salonId" = $1 AND a."csatScore" IS NOT NULL
           ORDER BY a.start DESC
           LIMIT 20`,
          salonId,
        ),
      ]);

      return {
        dailyBookings: dailyBookings.reverse(),
        revenue: revenue.reverse(),
        retention: retention.reverse(),
        staffPerformance,
        staffRatings,
        recentRatings,
      };
    });
  });


  // ─── Monthly Report Card (Items 14 & 15) ─────────────────────────────
  app.get('/analytics/monthly-report', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const salonId = user.salonId;
      const q = request.query as { month?: string };

      // Accept YYYY-MM param; default to current month
      let monthStart: Date;
      if (q.month && /^\d{4}-\d{2}$/.test(q.month)) {
        monthStart = new Date(`${q.month}-01T00:00:00.000Z`);
      } else {
        const now = new Date();
        monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      }
      const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));

      const safeQuery = async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
        try { return await db.$queryRawUnsafe<T[]>(sql, ...args); } catch { return []; }
      };

      const [bookingRows, revenueRows, topServiceRows, noShowRows, newCustomerRows, dayRows] = await Promise.all([
        // total & completed bookings
        safeQuery<{ total: number; completed: number }>(
          `SELECT COUNT(*)::int as total,
                  COUNT(*) FILTER (WHERE status = 'COMPLETED')::int as completed
           FROM "Appointment"
           WHERE "salonId" = $1 AND start >= $2 AND start < $3`,
          salonId, monthStart, monthEnd,
        ),
        // revenue from invoices
        safeQuery<{ revenue_cents: number }>(
          `SELECT COALESCE(SUM(i."totalCents"), 0)::int as revenue_cents
           FROM "Invoice" i
           WHERE i."salonId" = $1 AND i."createdAt" >= $2 AND i."createdAt" < $3 AND i."status" = 'PAID'`,
          salonId, monthStart, monthEnd,
        ),
        // top service by booking count
        safeQuery<{ service_name: string; cnt: number }>(
          `SELECT svc.name as service_name, COUNT(*)::int as cnt
           FROM "Appointment" a
           JOIN "Service" svc ON svc.id = a."serviceId"
           WHERE a."salonId" = $1 AND a.start >= $2 AND a.start < $3
             AND a.status NOT IN ('CANCELLED','RESCHEDULED')
           GROUP BY svc.name ORDER BY cnt DESC LIMIT 1`,
          salonId, monthStart, monthEnd,
        ),
        // no-show count
        safeQuery<{ no_shows: number }>(
          `SELECT COUNT(*) FILTER (WHERE status = 'NO_SHOW')::int as no_shows
           FROM "Appointment"
           WHERE "salonId" = $1 AND start >= $2 AND start < $3`,
          salonId, monthStart, monthEnd,
        ),
        // new vs returning customers
        safeQuery<{ customer_id: string; is_first: boolean }>(
          `SELECT a."customerId" as customer_id,
                  (MIN(a2.start) >= $2) as is_first
           FROM "Appointment" a
           JOIN "Appointment" a2 ON a2."customerId" = a."customerId" AND a2."salonId" = $1
           WHERE a."salonId" = $1 AND a.start >= $2 AND a.start < $3
             AND a.status NOT IN ('CANCELLED','RESCHEDULED')
           GROUP BY a."customerId"`,
          salonId, monthStart, monthEnd,
        ),
        // best day of week
        safeQuery<{ dow: string; cnt: number }>(
          `SELECT TO_CHAR(start AT TIME ZONE 'UTC', 'Day') as dow, COUNT(*)::int as cnt
           FROM "Appointment"
           WHERE "salonId" = $1 AND start >= $2 AND start < $3
             AND status NOT IN ('CANCELLED','RESCHEDULED')
           GROUP BY dow ORDER BY cnt DESC LIMIT 1`,
          salonId, monthStart, monthEnd,
        ),
      ]);

      const totalBookings = bookingRows[0]?.total ?? 0;
      const completedBookings = bookingRows[0]?.completed ?? 0;
      const revenueCents = revenueRows[0]?.revenue_cents ?? 0;
      const topService = topServiceRows[0]?.service_name ?? null;
      const noShows = noShowRows[0]?.no_shows ?? 0;
      const noShowPct = totalBookings > 0 ? Math.round((noShows / totalBookings) * 100) : 0;
      const newCount = newCustomerRows.filter((r) => r.is_first).length;
      const totalUnique = newCustomerRows.length;
      const newCustomerPct = totalUnique > 0 ? Math.round((newCount / totalUnique) * 100) : 0;
      const bestDay = dayRows[0]?.dow?.trim() ?? null;

      return {
        month: monthStart.toISOString().slice(0, 7),
        totalBookings,
        completedBookings,
        revenueCents,
        topService,
        noShowPct,
        newCustomerPct,
        returningCustomerPct: 100 - newCustomerPct,
        bestDay,
      };
    });
  });

  app.post('/analytics/monthly-report/send', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const salonId = user.salonId;

      // Find owner phone to send the report to
      const owner = await db.staffUser.findFirst({
        where: { salonId, role: 'OWNER', active: true },
        select: { phone: true, name: true },
        orderBy: { createdAt: 'asc' },
      });
      const phone = owner?.phone?.trim();
      if (!phone) {
        reply.code(422);
        return { error: 'no_owner_phone', message: 'No owner phone number configured. Please add your phone number in Account settings.' };
      }

      // Build this month's report
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const monthLabel = monthStart.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });

      const safeQuery = async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
        try { return await db.$queryRawUnsafe<T[]>(sql, ...args); } catch { return []; }
      };

      const [bookingRows, revenueRows, topServiceRows, noShowRows] = await Promise.all([
        safeQuery<{ total: number }>(`SELECT COUNT(*)::int as total FROM "Appointment" WHERE "salonId" = $1 AND start >= $2 AND start < $3`, salonId, monthStart, monthEnd),
        safeQuery<{ revenue_cents: number }>(`SELECT COALESCE(SUM(i."totalCents"), 0)::int as revenue_cents FROM "Invoice" i WHERE i."salonId" = $1 AND i."createdAt" >= $2 AND i."createdAt" < $3 AND i."status" = 'PAID'`, salonId, monthStart, monthEnd),
        safeQuery<{ service_name: string; cnt: number }>(`SELECT svc.name as service_name, COUNT(*)::int as cnt FROM "Appointment" a JOIN "Service" svc ON svc.id = a."serviceId" WHERE a."salonId" = $1 AND a.start >= $2 AND a.start < $3 AND a.status NOT IN ('CANCELLED','RESCHEDULED') GROUP BY svc.name ORDER BY cnt DESC LIMIT 1`, salonId, monthStart, monthEnd),
        safeQuery<{ no_shows: number }>(`SELECT COUNT(*) FILTER (WHERE status = 'NO_SHOW')::int as no_shows FROM "Appointment" WHERE "salonId" = $1 AND start >= $2 AND start < $3`, salonId, monthStart, monthEnd),
      ]);

      const total = bookingRows[0]?.total ?? 0;
      const revenue = revenueRows[0]?.revenue_cents ?? 0;
      const topService = topServiceRows[0]?.service_name;
      const noShows = noShowRows[0]?.no_shows ?? 0;

      const salon = await db.salon.findUniqueOrThrow({ where: { id: salonId }, select: { name: true, tradingName: true } });
      const salonName = salon.tradingName ?? salon.name;

      const body = [
        `📊 *${salonName} — ${monthLabel} Report*`,
        '',
        `📅 Bookings: ${total}`,
        `💰 Revenue: R${(revenue / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
        `🏆 Top service: ${topService ?? '—'}`,
        `❌ No-shows: ${noShows}${total > 0 ? ` (${Math.round((noShows / total) * 100)}%)` : ''}`,
        '',
        'Sent from your MarineFlow dashboard.',
      ].join('\n');

      await sendWithFallback({ salonId, to: phone, body });

      return { ok: true };
    });
  });

  // ─── Loyalty KPIs (Item 25) ───────────────────────────────────────────
  app.get('/analytics/loyalty', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const salonId = user.salonId;
      const safeQuery = async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
        try { return await db.$queryRawUnsafe<T[]>(sql, ...args); } catch { return []; }
      };

      const prog = await db.loyaltyProgram.findFirst({ where: { salonId }, select: { id: true, stampsPerReward: true } });
      if (!prog) return { stampsEarned: 0, stampsRedeemed: 0, activeCustomers: 0, redemptionRate: 0, stampsPerReward: 10 };

      const [earnRows, redeemRows, activeRows] = await Promise.all([
        safeQuery<{ total: number }>(
          `SELECT COALESCE(SUM(delta),0)::int as total FROM "LoyaltyLedger" WHERE "programId" = $1 AND delta > 0`,
          prog.id,
        ),
        safeQuery<{ total: number }>(
          `SELECT COALESCE(SUM(ABS(delta)),0)::int as total FROM "LoyaltyLedger" WHERE "programId" = $1 AND delta < 0`,
          prog.id,
        ),
        safeQuery<{ cnt: number }>(
          `SELECT COUNT(DISTINCT "customerId")::int as cnt FROM "LoyaltyLedger" WHERE "programId" = $1 AND delta > 0`,
          prog.id,
        ),
      ]);

      const stampsEarned = earnRows[0]?.total ?? 0;
      const stampsRedeemed = redeemRows[0]?.total ?? 0;
      const activeCustomers = activeRows[0]?.cnt ?? 0;
      const redemptionRate = stampsEarned > 0 ? Math.round((stampsRedeemed / stampsEarned) * 100) : 0;

      return { stampsEarned, stampsRedeemed, activeCustomers, redemptionRate, stampsPerReward: prog.stampsPerReward };
    });
  });

  // ─── Loyalty program settings (Item 36, 39) ──────────────────────────
  app.get('/loyalty/program', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const prog = await db.loyaltyProgram.findFirst({ where: { salonId: user.salonId } });
      if (!prog) return { stampsPerReward: 10, rewardDescription: '' };
      return {
        stampsPerReward: prog.stampsPerReward,
        rewardDescription: prog.rewardDescription ?? '',
      };
    });
  });

  app.patch<{ Body: { stampsPerReward?: number; rewardDescription?: string } }>(
    '/loyalty/program',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { stampsPerReward, rewardDescription } = request.body ?? {};

        if (stampsPerReward !== undefined) {
          if (!Number.isInteger(stampsPerReward) || stampsPerReward < 1 || stampsPerReward > 100) {
            reply.code(400);
            return { error: 'Stamps per reward must be between 1 and 100' };
          }
        }
        if (rewardDescription !== undefined && rewardDescription.length > 200) {
          reply.code(400);
          return { error: 'Reward description must be 200 characters or fewer' };
        }

        const db = getTenantDb();
        let prog = await db.loyaltyProgram.findFirst({ where: { salonId: user.salonId } });
        if (!prog) {
          reply.code(404);
          return { error: 'No loyalty programme found — enable loyalty in bot settings first' };
        }

        prog = await db.loyaltyProgram.update({
          where: { id: prog.id },
          data: {
            ...(stampsPerReward !== undefined ? { stampsPerReward } : {}),
            ...(rewardDescription !== undefined ? { rewardDescription: rewardDescription.trim() } : {}),
          },
        });

        return {
          stampsPerReward: prog.stampsPerReward,
          rewardDescription: prog.rewardDescription ?? '',
        };
      });
    },
  );

  // ─── No-show by staff/service (Item 27) ───────────────────────────────
  app.get('/analytics/no-show-patterns', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const salonId = user.salonId;
      const safeQuery = async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
        try { return await db.$queryRawUnsafe<T[]>(sql, ...args); } catch { return []; }
      };

      const [byStaff, byService] = await Promise.all([
        safeQuery<{ staffName: string; total: number; no_shows: number; rate: number }>(
          `SELECT s.name as "staffName",
                  COUNT(*)::int as total,
                  COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::int as no_shows,
                  ROUND(COUNT(*) FILTER (WHERE a.status = 'NO_SHOW') * 100.0 / NULLIF(COUNT(*),0), 1)::float as rate
           FROM "Appointment" a
           LEFT JOIN "Staff" s ON s.id = a."staffId"
           WHERE a."salonId" = $1
             AND a.start >= NOW() - INTERVAL '90 days'
           GROUP BY s.name
           HAVING COUNT(*) >= 3
           ORDER BY rate DESC NULLS LAST
           LIMIT 10`,
          salonId,
        ),
        safeQuery<{ serviceName: string; total: number; no_shows: number; rate: number }>(
          `SELECT svc.name as "serviceName",
                  COUNT(*)::int as total,
                  COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::int as no_shows,
                  ROUND(COUNT(*) FILTER (WHERE a.status = 'NO_SHOW') * 100.0 / NULLIF(COUNT(*),0), 1)::float as rate
           FROM "Appointment" a
           LEFT JOIN "Service" svc ON svc.id = a."serviceId"
           WHERE a."salonId" = $1
             AND a.start >= NOW() - INTERVAL '90 days'
           GROUP BY svc.name
           HAVING COUNT(*) >= 3
           ORDER BY rate DESC NULLS LAST
           LIMIT 10`,
          salonId,
        ),
      ]);

      return { byStaff, byService };
    });
  });

  // ─── Conversation abandonment funnel (Item 29) ────────────────────────
  app.get('/analytics/funnel', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const salonId = user.salonId;
      const safeQuery = async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
        try { return await db.$queryRawUnsafe<T[]>(sql, ...args); } catch { return []; }
      };

      const [serviceRow, slotRow, bookingRow, completedRow] = await Promise.all([
        safeQuery<{ cnt: number }>(
          `SELECT COUNT(DISTINCT "customerId")::int as cnt FROM "AnalyticsEvent" WHERE "salonId" = $1 AND type = 'funnel_pick_service' AND "createdAt" >= NOW() - INTERVAL '30 days'`,
          salonId,
        ),
        safeQuery<{ cnt: number }>(
          `SELECT COUNT(DISTINCT "customerId")::int as cnt FROM "AnalyticsEvent" WHERE "salonId" = $1 AND type = 'funnel_pick_slot' AND "createdAt" >= NOW() - INTERVAL '30 days'`,
          salonId,
        ),
        safeQuery<{ cnt: number }>(
          `SELECT COUNT(DISTINCT "customerId")::int as cnt FROM "AnalyticsEvent" WHERE "salonId" = $1 AND type = 'booking_complete' AND "createdAt" >= NOW() - INTERVAL '30 days'`,
          salonId,
        ),
        safeQuery<{ cnt: number }>(
          `SELECT COUNT(DISTINCT "customerId")::int as cnt FROM "AnalyticsEvent" WHERE "salonId" = $1 AND type = 'appointment_completed_dashboard' AND "createdAt" >= NOW() - INTERVAL '30 days'`,
          salonId,
        ),
      ]);

      return {
        period: '30 days',
        steps: [
          { label: 'Started browsing', count: serviceRow[0]?.cnt ?? 0 },
          { label: 'Reached slot picker', count: slotRow[0]?.cnt ?? 0 },
          { label: 'Booking confirmed', count: bookingRow[0]?.cnt ?? 0 },
          { label: 'Visit completed', count: completedRow[0]?.cnt ?? 0 },
        ],
      };
    });
  });

  // ─── Campaign opt-outs (Item 30) ─────────────────────────────────────
  app.get('/analytics/opt-outs', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const safeQuery = async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
        try { return await db.$queryRawUnsafe<T[]>(sql, ...args); } catch { return []; }
      };
      const rows = await safeQuery<{ month: string; cnt: number }>(
        `SELECT TO_CHAR("createdAt", 'YYYY-MM') as month, COUNT(*)::int as cnt
         FROM "AnalyticsEvent"
         WHERE "salonId" = $1 AND type = 'marketing_opt_out'
         GROUP BY month ORDER BY month DESC LIMIT 12`,
        user.salonId,
      );
      const total = await db.customer.count({
        where: { salonId: user.salonId, marketingConsentStatus: 'DECLINED', deletedAt: null },
      });
      return { byMonth: rows, totalOptedOut: total };
    });
  });

  // ─── Staff Revenue Analytics (Item 52) ────────────────────────────────
  app.get('/analytics/staff-revenue', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const safeQuery = async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
        try { return await db.$queryRawUnsafe<T[]>(sql, ...args); } catch { return []; }
      };
      const rows = await safeQuery<{
        staffId: string;
        staffName: string;
        bookings: number;
        completed: number;
        revenueCents: number;
        noShows: number;
      }>(
        `SELECT
          su.id AS "staffId",
          COALESCE(su."displayName", su.name) AS "staffName",
          COUNT(a.id)::int AS bookings,
          COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED')::int AS completed,
          COALESCE(SUM(s."priceCents") FILTER (WHERE a.status = 'COMPLETED'), 0)::int AS "revenueCents",
          COUNT(a.id) FILTER (WHERE a.status = 'NO_SHOW')::int AS "noShows"
         FROM "StaffUser" su
         LEFT JOIN "Appointment" a ON a."staffId" = su.id
           AND a."salonId" = $1
           AND a."start" >= NOW() - INTERVAL '30 days'
         LEFT JOIN "Service" s ON s.id = a."serviceId"
         WHERE su."salonId" = $1 AND su.active = true
         GROUP BY su.id, su."displayName", su.name
         ORDER BY "revenueCents" DESC`,
        user.salonId,
      );
      return { staff: rows };
    });
  });

  // ─── Waitlist (Item 22) ───────────────────────────────────────────────
  app.get('/waitlist', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const entries = await db.waitlistEntry.findMany({
        where: {
          salonId: user.salonId,
          notified: false,
          expiresAt: { gte: new Date() },
        },
        include: {
          customer: { select: { displayName: true, waId: true, firstName: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      const serviceIds = [...new Set(entries.map((e) => e.serviceId))];
      const staffIds = [...new Set(entries.map((e) => e.staffId).filter(Boolean) as string[])];

      const [services, staff] = await Promise.all([
        db.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } }),
        staffIds.length ? db.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true, displayName: true } }) : Promise.resolve([]),
      ]);

      const svcMap = new Map(services.map((s) => [s.id, s.name]));
      const staffMap = new Map(staff.map((s) => [s.id, s.displayName ?? s.name]));

      return {
        entries: entries.map((e) => ({
          id: e.id,
          customerId: e.customerId,
          customerName: e.customer.displayName ?? e.customer.firstName ?? e.customer.waId,
          serviceName: svcMap.get(e.serviceId) ?? e.serviceId,
          staffName: e.staffId ? (staffMap.get(e.staffId) ?? null) : null,
          preferredDate: e.preferredDate,
          expiresAt: e.expiresAt?.toISOString() ?? null,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    });
  });

  // ─── Subscription & Billing ──────────────────────────────────────────
  app.get('/subscription/plans', async () => {
    return { plans: await getPlans() };
  });

  app.get('/subscription', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const sub = await getSalonSubscription(user.salonId);
      return { subscription: sub };
    });
  });

  app.post(
    '/subscription/checkout',
    { preHandler: requireRole('OWNER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { planTier, billingCycle } = request.body as {
          planTier: string;
          billingCycle: 'monthly' | 'annual';
        };

        if (!planTier || !['monthly', 'annual'].includes(billingCycle)) {
          reply.code(400);
          return { error: 'invalid_input' };
        }

        const dashboardOrigin = resolveDashboardOrigin(request.headers.origin);

        const result = await createPayfastSubscription({
          salonId: user.salonId,
          planTier,
          billingCycle,
          returnUrl: billingReturnUrl(dashboardOrigin, 'success'),
          cancelUrl: billingReturnUrl(dashboardOrigin, 'cancelled'),
          notifyUrl: `${process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000'}/webhooks/payfast/subscription`,
        });

        if (!result.ok) {
          const status = result.error === 'payfast_not_configured' ? 503 : 400;
          reply.code(status);
          return { error: result.error };
        }

        return {
          url: result.url,
          formData: result.formData,
          summary: result.summary,
        };
      });
    },
  );

  app.post(
    '/subscription/cancel',
    { preHandler: requireRole('OWNER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const result = await cancelSubscription(user.salonId);
        if (!result.ok) {
          reply.code(400);
          return { error: result.error };
        }
        return { ok: true, alreadyScheduled: 'alreadyScheduled' in result ? result.alreadyScheduled : false };
      });
    },
  );

  app.get('/subscription/quota/:resource', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const { resource } = request.params as { resource: string };
      const salon = await db.salon.findUniqueOrThrow({ where: { id: user.salonId } });

      let currentCount = 0;
      if (resource === 'staff') {
        currentCount = await db.staff.count({ where: { deletedAt: null } });
      } else if (resource === 'branches') {
        currentCount = await db.branch.count();
      } else if (resource === 'services') {
        currentCount = await db.service.count({ where: { deletedAt: null } });
      } else {
        reply.code(400);
        return { error: 'invalid_resource' };
      }

      const result = checkQuota(salon.tier, resource as 'staff' | 'branches' | 'services', currentCount);
      return { resource, currentCount, ...result };
    });
  });

  // ─── File Uploads ────────────────────────────────────────────────────
  app.post('/uploads/presign', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { filename, mimeType, purpose } = request.body as {
        filename: string;
        mimeType: string;
        purpose?: string;
      };

      if (!filename || !mimeType) {
        reply.code(400);
        return { error: 'filename and mimeType required' };
      }

      const purposeValue = purpose ?? 'general';
      if (purposeValue === 'campaign') {
        if (!CAMPAIGN_MEDIA_MIMES.includes(mimeType as (typeof CAMPAIGN_MEDIA_MIMES)[number])) {
          reply.code(400);
          return {
            error: 'invalid_campaign_media',
            message: 'Newsletter media must be JPEG, PNG, WebP, GIF, or MP4 video.',
          };
        }
      }

      const result = await generatePresignedUpload(
        user.salonId,
        filename,
        mimeType,
        purposeValue,
      );

      return result;
    });
  });

  app.post('/uploads/confirm', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { fileKey, filename, mimeType, sizeBytes, purpose } = request.body as {
        fileKey: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
        purpose?: string;
      };

      if (!fileKey || !filename || !mimeType || !sizeBytes) {
        reply.code(400);
        return { error: 'missing_fields' };
      }

      const file = await confirmUpload(
        user.salonId,
        fileKey,
        filename,
        mimeType,
        sizeBytes,
        purpose ?? 'general',
        user.sub,
      );

      return { file };
    });
  });

  app.post('/uploads/file', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const filename = decodeURIComponent(String(request.headers['x-filename'] ?? 'upload.bin'));
      const mimeType = String(request.headers['x-mime-type'] ?? 'application/octet-stream');
      const purpose = String(request.headers['x-purpose'] ?? 'general');
      const buffer = request.body as Buffer;

      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        reply.code(400);
        return { error: 'empty_body', message: 'No file data received.' };
      }

      try {
        const result = await uploadBuffer(
          user.salonId,
          filename,
          mimeType,
          purpose,
          buffer,
          user.sub,
        );
        return { publicUrl: result.publicUrl, fileKey: result.fileKey, file: result.file };
      } catch (err) {
        if (err instanceof UploadError) {
          reply.code(400);
          return { error: 'upload_failed', message: err.message };
        }
        throw err;
      }
    });
  });

  app.get('/uploads', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const { purpose } = request.query as { purpose?: string };
      const files = await listUploads(purpose);
      return { files };
    });
  });

  app.delete('/uploads/:id', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const { id } = request.params as { id: string };
      const file = await deleteUpload(id);
      if (!file) {
        reply.code(404);
        return { error: 'not_found' };
      }
      return { ok: true };
    });
  });

  // ─── POPIA/GDPR Compliance ───────────────────────────────────────────
  app.get(
    '/customers/:id/export',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async () => {
        const { id } = request.params as { id: string };
        const data = await exportCustomerData(id);
        if (!data) {
          reply.code(404);
          return { error: 'customer_not_found' };
        }
        return data;
      });
    },
  );

  app.delete(
    '/customers/:id/erase',
    { preHandler: requireRole('OWNER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async () => {
        const { id } = request.params as { id: string };
        const result = await eraseCustomerData(id);
        if (!result) {
          reply.code(404);
          return { error: 'customer_not_found' };
        }
        return result;
      });
    },
  );

  // ─── Bulk customer CSV export (Item 49) ──────────────────────────────
  app.get(
    '/customers/export-csv',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const customers = await db.customer.findMany({
          where: { salonId: user.salonId, deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            waId: true,
            marketingConsentStatus: true,
            bookingCount: true,
            noShowCount: true,
            loyaltyStampsCached: true,
            createdAt: true,
            lastInteractionAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        const escape = (v: unknown): string => {
          const s = v == null ? '' : String(v);
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        };

        const headers = ['ID', 'First name', 'Last name', 'Display name', 'Email', 'WhatsApp', 'Marketing consent', 'Bookings', 'No-shows', 'Loyalty stamps', 'Joined', 'Last interaction'];
        const rows = customers.map((c) => [
          c.id,
          c.firstName,
          c.lastName,
          c.displayName,
          c.email,
          c.waId,
          c.marketingConsentStatus,
          c.bookingCount,
          c.noShowCount,
          c.loyaltyStampsCached,
          c.createdAt.toISOString().slice(0, 10),
          c.lastInteractionAt?.toISOString().slice(0, 10) ?? '',
        ]);

        const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="customers.csv"');
        return reply.send(csv);
      });
    },
  );

  // ─── Service categories CRUD (Item 47) ───────────────────────────────
  app.get('/service-categories', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const categories = await db.serviceCategory.findMany({
        where: { salonId: user.salonId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return { categories };
    });
  });

  app.post<{ Body: { name: string } }>(
    '/service-categories',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { name } = request.body ?? {};
        if (!name?.trim()) { reply.code(400); return { error: 'name_required' }; }
        const db = getTenantDb();
        const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const existing = await db.serviceCategory.findFirst({ where: { salonId: user.salonId, slug } });
        const finalSlug = existing ? `${slug}-${Date.now()}` : slug;
        const cat = await db.serviceCategory.create({
          data: { salonId: user.salonId, name: name.trim(), slug: finalSlug },
        });
        return { category: cat };
      });
    },
  );

  app.patch<{ Params: { id: string }; Body: { name?: string; sortOrder?: number } }>(
    '/service-categories/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const cat = await db.serviceCategory.findFirst({ where: { id: request.params.id, salonId: user.salonId } });
        if (!cat) { reply.code(404); return { error: 'not_found' }; }
        const { name, sortOrder } = request.body ?? {};
        const updated = await db.serviceCategory.update({
          where: { id: cat.id },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(sortOrder !== undefined ? { sortOrder } : {}),
          },
        });
        return { category: updated };
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/service-categories/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const cat = await db.serviceCategory.findFirst({ where: { id: request.params.id, salonId: user.salonId } });
        if (!cat) { reply.code(404); return { error: 'not_found' }; }
        // Unlink services from this category before deleting
        await db.service.updateMany({ where: { categoryId: cat.id }, data: { categoryId: null } });
        await db.serviceCategory.delete({ where: { id: cat.id } });
        return { ok: true };
      });
    },
  );

  // ─── Staff service price override (Item 41) ───────────────────────────
  app.patch<{
    Params: { staffId: string; serviceId: string };
    Body: { priceCentsOverride: number | null };
  }>(
    '/staff/:staffId/services/:serviceId/price',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const { staffId, serviceId } = request.params;
        const { priceCentsOverride } = request.body ?? {};

        const link = await db.staffService.findFirst({ where: { staffId, serviceId } });
        if (!link) { reply.code(404); return { error: 'staff_service_not_found' }; }

        // Verify staff belongs to this salon
        const staff = await db.staff.findFirst({ where: { id: staffId, salonId: user.salonId } });
        if (!staff) { reply.code(403); return { error: 'forbidden' }; }

        if (priceCentsOverride !== null && priceCentsOverride !== undefined) {
          if (!Number.isFinite(priceCentsOverride) || priceCentsOverride < 0) {
            reply.code(400);
            return { error: 'invalid_price' };
          }
        }

        const updated = await db.staffService.update({
          where: { staffId_serviceId: { staffId, serviceId } },
          data: { priceCentsOverride: priceCentsOverride ?? null },
        });
        return { priceCentsOverride: updated.priceCentsOverride };
      });
    },
  );

  // ─── Appointment bulk complete (Item 50) ─────────────────────────────
  app.post<{ Body: { ids: string[] } }>(
    '/appointments/bulk-complete',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { ids } = request.body ?? {};
        if (!Array.isArray(ids) || ids.length === 0) {
          reply.code(400);
          return { error: 'ids_required' };
        }
        if (ids.length > 50) {
          reply.code(400);
          return { error: 'max_50_appointments_per_bulk' };
        }

        const db = getTenantDb();
        const now = new Date();
        const result = await db.appointment.updateMany({
          where: {
            id: { in: ids },
            salonId: user.salonId,
            status: { in: ['CONFIRMED', 'CONFIRMED_PAID'] },
            start: { lte: now },
          },
          data: { status: 'COMPLETED' },
        });

        return { completed: result.count, skipped: ids.length - result.count };
      });
    },
  );

  // ─── Hold timeout — auto-release HELD appointments (Item 46) ─────────
  // This endpoint is called by a cron job (or can be triggered manually)
  app.post(
    '/appointments/release-stale-holds',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const automations = parseAutomationsFromMetadata(
          (await db.salon.findUniqueOrThrow({ where: { id: user.salonId }, select: { metadata: true } })).metadata,
        );
        const timeoutMin = automations.booking.holdTimeoutMin;
        if (timeoutMin <= 0) return { released: 0 };

        const cutoff = new Date(Date.now() - timeoutMin * 60_000);
        const result = await db.appointment.updateMany({
          where: {
            salonId: user.salonId,
            status: 'HELD',
            createdAt: { lte: cutoff },
          },
          data: { status: 'CANCELLED' },
        });
        return { released: result.count };
      });
    },
  );

  // ─── Webhook Subscriptions ───────────────────────────────────────────
  app.get('/webhooks', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const subs = await db.webhookSubscription.findMany({
        where: { salonId: user.salonId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { deliveries: true } } },
      });
      return { webhooks: subs };
    });
  });

  app.post(
    '/webhooks',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { url, events, description } = request.body as {
          url: string;
          events: string[];
          description?: string;
        };

        if (!url || !events?.length) {
          reply.code(400);
          return { error: 'url and events required' };
        }

        try {
          new URL(url);
        } catch {
          reply.code(400);
          return { error: 'invalid_url' };
        }

        const db = getTenantDb();
        const sub = await db.webhookSubscription.create({
          data: {
            salonId: user.salonId,
            url,
            events,
            secret: generateWebhookSecret(),
            description,
          },
        });

        return { webhook: sub };
      });
    },
  );

  app.delete(
    '/webhooks/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { id } = request.params as { id: string };
        const db = getTenantDb();
        // Guard: only delete subscriptions belonging to this salon
        await db.webhookSubscription.deleteMany({ where: { id, salonId: user.salonId } });
        return { ok: true };
      });
    },
  );

  app.get('/webhooks/:id/deliveries', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { id } = request.params as { id: string };
      const db = getTenantDb();
      // Verify subscription belongs to this salon before returning deliveries
      const sub = await db.webhookSubscription.findFirst({ where: { id, salonId: user.salonId } });
      if (!sub) { reply.code(404); return { error: 'not_found' }; }
      const deliveries = await db.webhookDelivery.findMany({
        where: { subscriptionId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return { deliveries };
    });
  });

  // ─── Conversation / Human-Handoff Management ────────────────────────────
  // These routes let staff reply to customers directly, take over a conversation
  // from the bot, or release it back to the bot.

  /** List all conversations, HANDOFF ones first so staff see what needs attention. */
  app.get('/conversations', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const q = request.query as { step?: string; limit?: string; offset?: string };
      const take = Math.min(Number(q.limit) || 50, 200);
      const skip = Number(q.offset) || 0;

      const where: Record<string, unknown> = { salonId: user.salonId };
      if (q.step) where.step = q.step;

      const convs = await db.conversation.findMany({
        where,
        orderBy: [
          // Surface HANDOFF convos first so staff see escalations immediately
          { step: 'asc' },
          { lastMessageAt: 'desc' },
        ],
        take,
        skip,
        include: {
          customer: { select: { id: true, waId: true, displayName: true, firstName: true, lastName: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      return {
        conversations: convs.map((c) => ({
          id: c.id,
          step: c.step,
          lastMessageAt: c.lastMessageAt,
          isHandoff: c.step === 'HANDOFF' || c.step === 'CLOSED',
          customer: c.customer,
          lastMessage: c.messages[0] ?? null,
        })),
        total: convs.length,
        take,
        skip,
      };
    });
  });

  /** Full message thread for a conversation (dashboard chat view). */
  app.get<{ Params: { id: string } }>('/conversations/:id/messages', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const db = getTenantDb();
      const conv = await db.conversation.findFirst({
        where: { id: request.params.id },
        include: {
          customer: {
            select: { id: true, waId: true, displayName: true, firstName: true, lastName: true },
          },
        },
      });
      if (!conv) {
        reply.code(404);
        return { error: 'conversation_not_found' };
      }

      const messages = await db.message.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });

      return {
        conversationId: conv.id,
        step: conv.step,
        customer: conv.customer,
        messages: messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          createdAt: m.createdAt,
        })),
      };
    });
  });

  /**
   * Staff sends a WhatsApp message directly to the customer.
   * Keeps the conversation in HANDOFF — the bot will remain silent.
   */
  app.post<{ Params: { id: string }; Body: { body: string } }>(
    '/conversations/:id/reply',
    { preHandler: requireRole('OWNER', 'MANAGER', 'STYLIST') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const body = request.body?.body?.trim();
        if (!body) {
          reply.code(400);
          return { error: 'body_required' };
        }

        const conv = await db.conversation.findFirst({
          where: { id: request.params.id },
          include: { customer: true },
        });
        if (!conv) {
          reply.code(404);
          return { error: 'conversation_not_found' };
        }

        // Send via WhatsApp (same channel router the bot uses)
        let providerSid: string | null = null;
        try {
          const { result } = await sendWithFallback({
            salonId: user.salonId,
            to: conv.customer.waId,
            body,
          });
          providerSid = result.providerMessageId ?? null;
        } catch {
          reply.code(502);
          return { error: 'message_send_failed' };
        }

        // Record as an outbound message from staff
        const message = await db.message.create({
          data: {
            conversationId: conv.id,
            customerId: conv.customerId,
            direction: MessageDirection.OUTBOUND,
            body,
            providerSid,
          },
        });

        await db.conversation.update({
          where: { id: conv.id },
          data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'staff_whatsapp_reply',
            entity: 'Conversation',
            entityId: conv.id,
            payload: { bodyLen: body.length },
          },
        });

        // Let other dashboard tabs see the outbound message in real-time
        emitMessageReceived(user.salonId, conv.customerId, body).catch(() => {});

        return { ok: true, messageId: message.id };
      });
    },
  );

  /**
   * Take over a conversation — moves it to HANDOFF so the bot goes silent.
   * Call this before replying manually so the bot doesn't race you.
   */
  app.post<{ Params: { id: string } }>(
    '/conversations/:id/handoff',
    { preHandler: requireRole('OWNER', 'MANAGER', 'STYLIST') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const conv = await db.conversation.findFirst({ where: { id: request.params.id } });
        if (!conv) {
          reply.code(404);
          return { error: 'conversation_not_found' };
        }

        const existingCtx = (conv.context ?? {}) as Record<string, unknown>;
        await db.conversation.update({
          where: { id: conv.id },
          data: {
            step: ConversationStep.HANDOFF,
            context: { ...existingCtx, handoffByStaff: true } as object,
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'conversation_handoff',
            entity: 'Conversation',
            entityId: conv.id,
          },
        });

        return { ok: true, step: 'HANDOFF' };
      });
    },
  );

  /**
   * Release a conversation back to the bot — resets step to MENU and clears
   * the error counter so the bot greets the customer cleanly next time they text.
   */
  const releaseConversationHandler = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    return withUserTenant(request, reply, async (user) => {
      const db = getTenantDb();
      const conv = await db.conversation.findFirst({ where: { id: request.params.id } });
      if (!conv) {
        reply.code(404);
        return { error: 'conversation_not_found' };
      }

      const currentCtx = (conv.context ?? {}) as Record<string, unknown>;
      const cleanCtx = { ...currentCtx };
      delete cleanCtx.errorCount;
      delete cleanCtx.handoffByStaff;

      await db.conversation.update({
        where: { id: conv.id },
        data: {
          step: ConversationStep.MENU,
          context: cleanCtx as object,
        },
      });

      await db.auditLog.create({
        data: {
          salonId: user.salonId,
          actorUserId: user.sub,
          action: 'conversation_release',
          entity: 'Conversation',
          entityId: conv.id,
        },
      });

      return { ok: true, step: 'MENU' };
    });
  };

  app.post<{ Params: { id: string } }>(
    '/conversations/:id/release',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    releaseConversationHandler,
  );

  app.post<{ Params: { id: string } }>(
    '/conversations/:id/handoff/release',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    releaseConversationHandler,
  );

  /**
   * Staff marks a human-handled query as resolved.
   * Bot sends a thank-you + 1-10 satisfaction rating request to the customer,
   * then moves the conversation to HANDOFF_RATING step.
   */
  app.post<{ Params: { id: string } }>(
    '/conversations/:id/query-complete',
    { preHandler: requireRole('OWNER', 'MANAGER', 'STYLIST') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const db = getTenantDb();
        const conv = await db.conversation.findFirst({
          where: { id: request.params.id, salonId: user.salonId },
          include: { customer: true, salon: true },
        });
        if (!conv) {
          reply.code(404);
          return { error: 'conversation_not_found' };
        }

        const salonName = conv.salon.tradingName?.trim() || conv.salon.name;
        const ratingMsg =
          `Thanks for chatting with us at ${salonName}! 🙏\n\n` +
          `On a scale of 1–10, how satisfied were you with the help you received today?\n` +
          `(1 = Very unsatisfied, 10 = Completely satisfied)`;

        // Send the message via WhatsApp
        let providerSid: string | null = null;
        try {
          const { result } = await sendWithFallback({
            salonId: conv.salonId,
            to: conv.customer.waId,
            body: ratingMsg,
          });
          providerSid = result.providerMessageId ?? null;
        } catch {
          // Continue even if send fails — still update the step
        }

        // Record the outbound message
        await db.message.create({
          data: {
            conversationId: conv.id,
            customerId: conv.customerId,
            direction: MessageDirection.OUTBOUND,
            body: ratingMsg,
            providerSid,
          },
        });

        // Clear handoff context, move to HANDOFF_RATING
        const currentCtx = (conv.context ?? {}) as Record<string, unknown>;
        const nextCtx = { ...currentCtx };
        delete nextCtx.handoffByStaff;
        delete nextCtx.errorCount;

        await db.conversation.update({
          where: { id: conv.id },
          data: {
            step: ConversationStep.HANDOFF_RATING,
            context: nextCtx as object,
          },
        });

        await db.auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: 'conversation_query_complete',
            entity: 'Conversation',
            entityId: conv.id,
          },
        });

        return { ok: true, step: 'HANDOFF_RATING' };
      });
    },
  );

  app.get('/campaigns', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const items = await listCampaigns();
      return { campaigns: items.map(serializeCampaign) };
    });
  });

  app.get('/campaigns/meta', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const [tags, optedInCount] = await Promise.all([
        listCustomerTags(user.salonId),
        countOptedInCustomers(user.salonId),
      ]);
      return { tags, optedInCount };
    });
  });

  app.post<{ Body: { audienceFilter?: AudienceFilter } }>(
    '/campaigns/audience-preview',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const filter = (request.body?.audienceFilter ?? { type: 'all' }) as AudienceFilter;
        const count = await countAudience(user.salonId, filter);
        return { count };
      });
    },
  );

  app.get<{ Params: { id: string } }>('/campaigns/:id', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const item = await getCampaign(request.params.id);
      if (!item) {
        reply.code(404);
        return { error: 'not_found' };
      }
      return { campaign: serializeCampaign(item) };
    });
  });

  app.post<{
    Body: {
      name: string;
      message?: string;
      mediaUrl?: string | null;
      mediaType?: string | null;
      audienceFilter?: AudienceFilter;
      scheduledAt?: string | null;
      sendNow?: boolean;
    };
  }>(
    '/campaigns',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const { name, message, mediaUrl, mediaType, audienceFilter, scheduledAt, sendNow } =
          request.body ?? {};
        if (!name?.trim()) {
          reply.code(400);
          return { error: 'name_required', message: 'Add a campaign name.' };
        }

        const trimmedMessage = message?.trim() ?? '';
        const parsedMediaType = mediaUrl ? parseCampaignMediaType(mediaType) : null;
        const mediaError = validateCampaignMedia(mediaUrl ?? null, parsedMediaType);
        if (mediaError) {
          reply.code(400);
          return { error: 'invalid_media', message: mediaError };
        }
        if (!trimmedMessage && !mediaUrl) {
          reply.code(400);
          return {
            error: 'content_required',
            message: 'Add a message, photo, or video for your newsletter.',
          };
        }
        if (trimmedMessage.length > 1024) {
          reply.code(400);
          return { error: 'message_too_long', message: 'Caption must be 1,024 characters or fewer.' };
        }

        let scheduleDate: Date | null = null;
        if (scheduledAt) {
          scheduleDate = new Date(scheduledAt);
          if (Number.isNaN(scheduleDate.getTime())) {
            reply.code(400);
            return { error: 'invalid_schedule', message: 'That date and time is not valid.' };
          }
          if (scheduleDate.getTime() <= Date.now()) {
            reply.code(400);
            return { error: 'schedule_must_be_future', message: 'Schedule time must be in the future.' };
          }
        }

        if (sendNow && scheduleDate) {
          reply.code(400);
          return { error: 'send_now_or_schedule' };
        }

        const audience = audienceFilter ?? { type: 'all' as const };
        const recipientCount = await countAudience(user.salonId, audience);
        if (campaignRequiresAudience({ sendNow: !!sendNow, scheduledAt: scheduleDate }) && recipientCount === 0) {
          reply.code(400);
          return { error: 'empty_audience', message: 'No customers match this audience with marketing consent.' };
        }

        const item = await createCampaign({
          salonId: user.salonId,
          name: name.trim(),
          message: trimmedMessage,
          mediaUrl: mediaUrl ?? null,
          mediaType: parsedMediaType,
          audienceFilter: audience,
          scheduledAt: sendNow ? null : scheduleDate,
          createdBy: user.sub,
        });

        await getTenantDb().auditLog.create({
          data: {
            salonId: user.salonId,
            actorUserId: user.sub,
            action: sendNow ? 'campaign_send_now' : scheduleDate ? 'campaign_schedule' : 'campaign_create',
            entity: 'Campaign',
            entityId: item.id,
          },
        });

        if (sendNow) {
          await queueCampaignSend(item.id, user.salonId);
        }

        return { campaign: serializeCampaign(item) };
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      message?: string;
      mediaUrl?: string | null;
      mediaType?: string | null;
      clearMedia?: boolean;
      audienceFilter?: AudienceFilter;
      scheduledAt?: string | null;
    };
  }>(
    '/campaigns/:id',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const existing = await getCampaign(request.params.id);
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        const { name, message, mediaUrl, mediaType, clearMedia, audienceFilter, scheduledAt } =
          request.body ?? {};
        if (name !== undefined && !name.trim()) {
          reply.code(400);
          return { error: 'name_required', message: 'Add a campaign name.' };
        }

        const nextMessage = message !== undefined ? message.trim() : existing.templateName;
        let nextMediaUrl = existing.mediaUrl;
        let nextMediaType = parseCampaignMediaType(existing.mediaType);

        if (clearMedia) {
          nextMediaUrl = null;
          nextMediaType = null;
        } else if (mediaUrl !== undefined) {
          nextMediaUrl = mediaUrl;
          nextMediaType = mediaUrl ? parseCampaignMediaType(mediaType) : null;
        } else if (mediaType !== undefined && nextMediaUrl) {
          nextMediaType = parseCampaignMediaType(mediaType);
        }

        if (nextMediaUrl && !nextMediaType) {
          reply.code(400);
          return { error: 'invalid_media', message: 'Choose image or video for the attachment.' };
        }
        const mediaError = validateCampaignMedia(nextMediaUrl, nextMediaType);
        if (mediaError) {
          reply.code(400);
          return { error: 'invalid_media', message: mediaError };
        }
        if (!nextMessage && !nextMediaUrl) {
          reply.code(400);
          return {
            error: 'content_required',
            message: 'Add a message, photo, or video for your newsletter.',
          };
        }
        if (nextMessage.length > 1024) {
          reply.code(400);
          return { error: 'message_too_long', message: 'Caption must be 1,024 characters or fewer.' };
        }

        let scheduleDate: Date | null | undefined;
        if (scheduledAt !== undefined) {
          if (scheduledAt === null) {
            scheduleDate = null;
          } else {
            scheduleDate = new Date(scheduledAt);
            if (Number.isNaN(scheduleDate.getTime())) {
              reply.code(400);
              return { error: 'invalid_schedule', message: 'That date and time is not valid.' };
            }
            if (scheduleDate.getTime() <= Date.now()) {
              reply.code(400);
              return { error: 'schedule_must_be_future', message: 'Schedule time must be in the future.' };
            }
          }
        }

        const nextSchedule = resolveCampaignScheduleAfterPatch(existing.scheduledAt, scheduleDate);
        const nextFilter = (audienceFilter ??
          (existing.audienceFilter as AudienceFilter) ??
          { type: 'all' }) as AudienceFilter;

        if (campaignRequiresAudience({ scheduledAt: nextSchedule })) {
          const count = await countAudience(user.salonId, nextFilter);
          if (count === 0) {
            reply.code(400);
            return {
              error: 'empty_audience',
              message: 'No customers match this audience with marketing consent.',
            };
          }
        }

        try {
          const updated = await updateCampaign(request.params.id, {
            name: name?.trim(),
            message: message !== undefined ? nextMessage : undefined,
            mediaUrl: clearMedia || mediaUrl !== undefined ? nextMediaUrl : undefined,
            mediaType: clearMedia || mediaUrl !== undefined || mediaType !== undefined ? nextMediaType : undefined,
            audienceFilter,
            scheduledAt: scheduleDate,
          });

          await getTenantDb().auditLog.create({
            data: {
              salonId: user.salonId,
              actorUserId: user.sub,
              action: 'campaign_update',
              entity: 'Campaign',
              entityId: updated.id,
            },
          });

          return { campaign: serializeCampaign(updated) };
        } catch (err) {
          if (err instanceof Error && err.message === 'campaign_not_editable') {
            reply.code(409);
            return { error: 'campaign_not_editable', message: 'Only draft or scheduled campaigns can be edited.' };
          }
          throw err;
        }
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/campaigns/:id/send',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const existing = await getCampaign(request.params.id);
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        try {
          const filter = (existing.audienceFilter ?? { type: 'all' }) as AudienceFilter;
          const recipientCount = await countAudience(user.salonId, filter);
          if (recipientCount === 0) {
            reply.code(400);
            return {
              error: 'empty_audience',
              message: 'No customers match this audience with marketing consent.',
            };
          }

          const contentError = validateCampaignMedia(existing.mediaUrl, parseCampaignMediaType(existing.mediaType));
          if (contentError) {
            reply.code(400);
            return { error: 'invalid_media', message: contentError };
          }
          if (!existing.templateName?.trim() && !existing.mediaUrl) {
            reply.code(400);
            return {
              error: 'content_required',
              message: 'Add a message, photo, or video before sending.',
            };
          }

          await queueCampaignSend(request.params.id, user.salonId);
          await getTenantDb().auditLog.create({
            data: {
              salonId: user.salonId,
              actorUserId: user.sub,
              action: 'campaign_send_now',
              entity: 'Campaign',
              entityId: existing.id,
            },
          });
          return { ok: true, message: 'Campaign queued for sending.' };
        } catch (err) {
          if (err instanceof Error && err.message === 'campaign_not_sendable') {
            reply.code(409);
            return { error: 'campaign_not_sendable', message: 'This campaign has already been sent or cancelled.' };
          }
          throw err;
        }
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/campaigns/:id/cancel',
    { preHandler: requireRole('OWNER', 'MANAGER') },
    async (request, reply) => {
      return withUserTenant(request, reply, async (user) => {
        const existing = await getCampaign(request.params.id);
        if (!existing) {
          reply.code(404);
          return { error: 'not_found' };
        }

        try {
          const updated = await cancelCampaign(request.params.id);
          await getTenantDb().auditLog.create({
            data: {
              salonId: user.salonId,
              actorUserId: user.sub,
              action: 'campaign_cancel',
              entity: 'Campaign',
              entityId: updated.id,
            },
          });
          return { campaign: serializeCampaign(updated) };
        } catch (err) {
          if (err instanceof Error && err.message === 'campaign_not_cancellable') {
            reply.code(409);
            return { error: 'campaign_not_cancellable', message: 'Only draft or scheduled campaigns can be cancelled.' };
          }
          throw err;
        }
      });
    },
  );
}

function csvEscape(s: string): string {
  let safe = s;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
