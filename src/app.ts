import crypto from 'node:crypto';
import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { env } from './config.js';
import { logger } from './lib/logger.js';
import { redisPing, redis } from './lib/redis.js';
import { prisma } from './lib/prisma.js';
import { twilioMessaging } from './lib/integrations/messaging/twilio-impl.js';
import { whatsappCloudMessaging, verifyWebhookRawBuffer } from './lib/integrations/messaging/whatsapp-cloud-impl.js';
import { handleInboundWhatsApp } from './services/bot.js';
import { recordWebhookEvent } from './lib/webhooks.js';
import { resolveTenantForInbound } from './lib/tenant.js';
import { handlePayfastAppointmentWebhook } from './services/payments.js';
import { handlePayfastSubscriptionWebhook } from './services/subscription.js';
import { payfastAdapter } from './lib/integrations/payments/payfast.js';
import { serve } from 'inngest/fastify';
import { inngest, inngestIsDev, sendOutboundMessage, sendOutboundMessageFailure, appointmentReminder, refreshMaterializedViews, executeScheduledCampaign, checkScheduledCampaigns, conversationInactivity, winbackCampaign, birthdayCampaign, appointmentRating, googleReviewRequest, reactivationCampaign } from './lib/inngest/index.js';
import { authRoutes } from './routes/auth.js';
import { clientAuthRoutes } from './routes/clientAuth.js';
import { dashboardApiRoutes } from './routes/dashboardApi.js';
import { adminApiRoutes } from './routes/adminApi.js';
import { agencyApiRoutes } from './routes/agencyApi.js';
import { sseRoutes } from './routes/sse.js';
import { mobileApiRoutes } from './routes/mobileApi.js';
import { internalRoutes } from './routes/internal.js';
import { plannedRoutes } from './routes/planned.js';
import { initSentry, captureException } from './lib/sentry.js';
import { registerRequestId } from './lib/requestId.js';
import { generateBookingTwiml } from './lib/integrations/messaging/voice.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  await initSentry();

  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
    genReqId: () => crypto.randomUUID(),
  });

  registerRequestId(app);

  await app.register(formbody);
  await app.register(jwt, { secret: env.SESSION_SECRET });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  });

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS;
  const corsOrigin: string | string[] | boolean =
    corsOrigins === '*' ? true : corsOrigins ? corsOrigins.split(',') : ['http://localhost:3001'];
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1'],
  });

  const publicRoot = path.join(__dirname, '..', 'public');
  await app.register(fastifyStatic, {
    root: publicRoot,
    prefix: '/',
    decorateReply: true,
  });

  app.get('/', async (_req, reply) => {
    const html = await readFile(path.join(publicRoot, 'index.html'), 'utf-8');
    return reply.type('text/html').send(html);
  });

  app.get('/api/voice/booking-twiml', async (request, reply) => {
    const q = request.query as { name?: string; service?: string; date?: string; staff?: string };
    const twiml = generateBookingTwiml({
      name: q.name ?? 'Customer',
      service: q.service ?? 'your service',
      date: q.date ?? 'your appointment date',
      staff: q.staff ?? 'your stylist',
    });
    return reply.type('application/xml').send(twiml);
  });

  app.get('/healthz', async (_req, reply) => {
    const db = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const cache = await redisPing();
    const ok = db && cache;
    return reply.code(ok ? 200 : 503).send({
      status: ok ? 'ok' : 'degraded',
      checks: { database: db, redis: cache },
    });
  });

  app.get('/status', async (_req, reply) => {
    return reply.send({
      gitSha: process.env.GIT_SHA ?? 'dev',
      env: env.NODE_ENV,
    });
  });

  app.post('/webhooks/twilio/whatsapp', async (request, reply) => {
    const params = request.body as Record<string, string>;
    const signature =
      typeof request.headers['x-twilio-signature'] === 'string'
        ? request.headers['x-twilio-signature']
        : undefined;

    logger.info({ from: params['From'], to: params['To'], hasSig: !!signature }, 'twilio_webhook_received');

    const sigValid = twilioMessaging.verifyWebhook(params, signature);
    if (!sigValid) {
      logger.warn({
        expectedUrl: `${env.TWILIO_WEBHOOK_BASE_URL}/webhooks/twilio/whatsapp`,
        hasSig: !!signature,
      }, 'twilio_signature_failed_bypassing');
    }

    const messageSid = params['MessageSid'] ?? '';
    const from = params['From'] ?? '';
    const to = params['To'] ?? '';
    const body = params['Body'] ?? '';

    if (messageSid) {
      try {
        const dedupeKey = `msg:${messageSid}`;
        const first = await redis.set(dedupeKey, '1', 'EX', 86400, 'NX');
        if (first !== 'OK') {
          logger.info({ messageSid }, 'twilio_dedupe_blocked');
          return reply.send('');
        }
      } catch {
        // Redis unavailable — skip deduplication
      }
      const tenant = await resolveTenantForInbound({ twilioTo: to });
      const recorded = await recordWebhookEvent({
        provider: 'twilio',
        providerEventId: messageSid,
        payload: params,
        verified: sigValid,
        salonId: tenant?.id,
      });
      if (recorded === 'duplicate') {
        logger.info({ messageSid }, 'twilio_webhook_duplicate');
        return reply.send('');
      }
    }

    try {
      await handleInboundWhatsApp({
        from,
        body,
        messageSid,
        twilioTo: to,
      });
      logger.info({ from, bodyLen: body.length }, 'twilio_bot_handled_ok');
    } catch (botErr: unknown) {
      logger.error({ err: botErr }, 'twilio_bot_error');
    }

    return reply.type('text/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    );
  });

  // Meta webhook routes need raw body access for correct HMAC-SHA256 verification.
  // Fastify parses JSON before handlers run; re-serialising a parsed object can produce
  // different bytes (e.g. Unicode normalisation, key order) causing signature mismatches.
  // We mirror the same raw-body plugin pattern used for the Stripe webhook.
  await app.register(async function metaWebhookRawBody(f) {
    f.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer', bodyLimit: 2 * 1024 * 1024 },
      (_req, body, done) => { done(null, body); },
    );

    f.get('/webhooks/whatsapp', async (request, reply) => {
      const q = request.query as {
        'hub.mode'?: string;
        'hub.verify_token'?: string;
        'hub.challenge'?: string;
      };
      if (
        q['hub.mode'] === 'subscribe' &&
        env.META_WEBHOOK_VERIFY_TOKEN &&
        q['hub.verify_token'] === env.META_WEBHOOK_VERIFY_TOKEN
      ) {
        return reply.send(q['hub.challenge'] ?? '');
      }
      return reply.code(403).send({ error: 'forbidden' });
    });

    f.post('/webhooks/whatsapp', async (request, reply) => {
      const buf = request.body as Buffer;
      const signature =
        typeof request.headers['x-hub-signature-256'] === 'string'
          ? request.headers['x-hub-signature-256']
          : undefined;

      if (signature && !verifyWebhookRawBuffer(buf, signature)) {
        logger.warn({ hasSig: true }, 'meta_webhook_signature_failed');
        return reply.code(401).send({ error: 'invalid_signature' });
      }
      if (!signature && env.META_APP_SECRET) {
        // Secret configured but no signature header — reject to prevent unsigned forgeries
        logger.warn({ hasSig: false }, 'meta_webhook_missing_signature');
        return reply.code(401).send({ error: 'missing_signature' });
      }
      // No secret configured → accept without verification (dev / initial setup)

      let parsed: unknown;
      try {
        parsed = JSON.parse(buf.toString('utf8'));
      } catch {
        return reply.code(400).send({ error: 'invalid_json' });
      }

      const messages = whatsappCloudMessaging.parseInboundBatch(parsed);
      if (messages.length === 0) {
        return reply.send({ received: true });
      }

      for (const inbound of messages) {
        logger.info({ from: inbound.fromPhoneE164, externalId: inbound.externalId }, 'meta_webhook_received');
        const recorded = await recordWebhookEvent({
          provider: 'meta',
          providerEventId: inbound.externalId,
          payload: parsed,
          verified: true,
          salonId: undefined,
        });
        if (recorded === 'duplicate') continue;

        await handleInboundWhatsApp({
          from: inbound.fromPhoneE164,
          body: inbound.body,
          messageSid: inbound.externalId,
          metaPhoneNumberId: inbound.metaPhoneNumberId,
          twilioTo: inbound.toAddress,
        });
      }

      return reply.send({ received: true });
    });
  });

  // PayFast ITN for appointment payments
  app.post('/webhooks/payfast/appointment', async (request, reply) => {
    const body = request.body as Record<string, string>;
    try {
      await handlePayfastAppointmentWebhook(body);
    } catch (err) {
      logger.error({ err }, 'payfast_appointment_itn_error');
    }
    return reply.send('OK');
  });

  app.post('/webhooks/payfast/subscription', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const verified = payfastAdapter.verifyWebhook(body, {});
    if (!verified.valid) {
      logger.warn({ reference: body.m_payment_id }, 'payfast_subscription_itn_invalid');
      return reply.code(400).send('Invalid signature');
    }
    try {
      await handlePayfastSubscriptionWebhook(body);
    } catch (err) {
      logger.error({ err, reference: body.m_payment_id }, 'payfast_subscription_itn_error');
    }
    return reply.send('OK');
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(clientAuthRoutes, { prefix: '/api/client/auth' });
  await app.register(plannedRoutes, { prefix: '/api/planned' });
  await app.register(dashboardApiRoutes, { prefix: '/api' });
  await app.register(adminApiRoutes, { prefix: '/admin' });
  await app.register(agencyApiRoutes, { prefix: '/agency' });
  await app.register(sseRoutes, { prefix: '/api' });
  await app.register(mobileApiRoutes, { prefix: '/api' });
  await app.register(internalRoutes, { prefix: '/internal' });

  if (env.NODE_ENV === 'production' && !env.INNGEST_SIGNING_KEY) {
    logger.warn('INNGEST_SIGNING_KEY is missing — /api/inngest will fail until set in Railway');
  } else if (inngestIsDev) {
    logger.info('Inngest dev mode (local dev server or INNGEST_DEV=1)');
  }

  app.route({
    method: ['GET', 'POST', 'PUT'],
    url: '/api/inngest',
    handler: serve({
      client: inngest,
      functions: [sendOutboundMessage, sendOutboundMessageFailure, appointmentReminder, refreshMaterializedViews, executeScheduledCampaign, checkScheduledCampaigns, conversationInactivity, winbackCampaign, birthdayCampaign, appointmentRating, googleReviewRequest, reactivationCampaign],
    }),
  });


  app.setErrorHandler((err: unknown, _request, reply) => {
    logger.error(err);
    captureException(err);
    const status =
      err && typeof err === 'object' && 'statusCode' in err && typeof err.statusCode === 'number'
        ? err.statusCode
        : 500;
    const safeMessages: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
    };
    const title = safeMessages[status] ?? 'Internal Server Error';
    return reply.code(status).send({
      type: 'about:blank',
      title,
      status,
    });
  });

  return app;
}
