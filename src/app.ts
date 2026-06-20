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
import { redisPing } from './lib/redis.js';
import { prisma } from './lib/prisma.js';
import { handleTwilioWhatsAppWebhook } from './webhooks/twilio/whatsapp.js';
import { handleTwilioStatusWebhook } from './webhooks/twilio/status.js';
import { whatsappCloudMessaging, verifyWebhookRawBuffer } from './lib/integrations/messaging/whatsapp-cloud-impl.js';
import { handleInboundWhatsApp } from './services/bot.js';
import { recordWebhookEvent } from './lib/webhooks.js';
import { handlePayfastAppointmentWebhook } from './services/payments.js';
import { handlePayfastSubscriptionWebhook } from './services/subscription.js';
import { payfastAdapter, isPayfastConfigured } from './lib/integrations/payments/payfast.js';
import { handleFlowDataExchange } from './lib/whatsappFlows/dataExchange.js';
import { decryptFlowRequest, encryptFlowResponse } from './lib/whatsappFlows/crypto.js';
import { serve } from 'inngest/fastify';
import { inngest, inngestIsDev, sendOutboundMessage, sendOutboundMessageFailure, appointmentReminder, refreshMaterializedViews, executeScheduledCampaign, checkScheduledCampaigns, conversationInactivity, bookingRatingPrompt, winbackCampaign, birthdayCampaign, appointmentRating, googleReviewRequest, appointmentAftercare, reactivationCampaign } from './lib/inngest/index.js';
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
import { payCheckoutRoutes } from './routes/payCheckout.js';

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

  // CORS — always allow the production dashboard origin (salon owners on corporate WiFi
  // use same-origin proxy, but direct API access and dev still need CORS).
  const corsFromEnv = process.env.CORS_ORIGINS?.trim();
  const defaultOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    env.DASHBOARD_URL,
    'https://dashboard.marineflow.co.za',
  ].filter((v): v is string => Boolean(v));
  const corsOrigin: string | string[] | boolean =
    corsFromEnv === '*'
      ? true
      : corsFromEnv
        ? [...new Set([...corsFromEnv.split(',').map((s) => s.trim()).filter(Boolean), ...defaultOrigins])]
        : defaultOrigins;
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
    // Inngest status is informational only — a misconfiguration must not flip the
    // health probe to 503 (that would make Railway kill the container). In production
    // the signing key is required or /api/inngest (and thus all delayed jobs like the
    // booking-rating prompt) will silently never run.
    const inngest =
      env.NODE_ENV === 'production'
        ? env.INNGEST_SIGNING_KEY
          ? 'cloud'
          : 'unconfigured'
        : inngestIsDev
          ? 'dev'
          : 'cloud';
    // PayFast's ITN webhook is fired from PayFast's own servers to PUBLIC_BASE_URL —
    // if that still points at localhost in production, payment confirmations
    // (and the loyalty/rating/aftercare side effects gated on them) silently never fire.
    const payfast =
      env.NODE_ENV === 'production' && env.PUBLIC_BASE_URL.includes('localhost')
        ? 'public_url_misconfigured'
        : isPayfastConfigured()
          ? 'configured'
          : 'unconfigured';
    // Surface the origin PayFast/Twilio webhooks will be sent to, so the
    // configured domain can be confirmed at a glance. A base URL is not secret.
    let publicBaseUrl = env.PUBLIC_BASE_URL;
    try {
      publicBaseUrl = new URL(env.PUBLIC_BASE_URL).origin;
    } catch {
      /* keep raw value if unparseable */
    }
    return reply.code(ok ? 200 : 503).send({
      status: ok ? 'ok' : 'degraded',
      checks: { database: db, redis: cache, inngest, payfast },
      publicBaseUrl,
    });
  });

  app.get('/status', async (_req, reply) => {
    return reply.send({
      gitSha: process.env.GIT_SHA ?? 'dev',
      env: env.NODE_ENV,
    });
  });

  app.post('/webhooks/twilio/whatsapp', handleTwilioWhatsAppWebhook);
  app.post('/webhooks/twilio/status', handleTwilioStatusWebhook);

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

        try {
          await handleInboundWhatsApp({
            from: inbound.fromPhoneE164,
            body: inbound.body,
            messageSid: inbound.externalId,
            metaPhoneNumberId: inbound.metaPhoneNumberId,
            twilioTo: inbound.toAddress,
          });
        } catch (botErr: unknown) {
          logger.error({ err: botErr, externalId: inbound.externalId }, 'meta_bot_error');
        }
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

  // ── WhatsApp Flows data exchange endpoint ────────────────────────────────
  // Meta POSTs encrypted payloads here during flow screen transitions.
  // Requires FLOW_PRIVATE_KEY env var (RSA PEM) to decrypt.
  await app.register(async function flowEndpoint(f) {
    f.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer', bodyLimit: 512 * 1024 },
      (_req, body, done) => { done(null, body); },
    );

    f.post('/webhooks/whatsapp-flow', async (request, reply) => {
      const privateKey = process.env.FLOW_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (!privateKey) {
        logger.warn('flow_endpoint_no_private_key');
        return reply.code(421).send({ error: 'Flow endpoint not configured' });
      }

      const buf = request.body as Buffer;
      let body: ReturnType<typeof JSON.parse>;
      try {
        body = JSON.parse(buf.toString('utf8'));
      } catch {
        return reply.code(400).send({ error: 'invalid_json' });
      }

      // Health-check from Meta (no encryption)
      if (body && typeof body === 'object' && 'action' in body && body.action === 'ping') {
        return reply.send({ data: { status: 'active' } });
      }

      let aesKey: Buffer;
      let iv: Buffer;
      let decrypted: unknown;
      try {
        ({ aesKey, iv, decrypted } = decryptFlowRequest(body, privateKey));
      } catch (err) {
        logger.warn({ err }, 'flow_decrypt_failed');
        return reply.code(400).send({ error: 'decryption_failed' });
      }

      // Resolve salonId from the flow token (format: "<salonId>:<conversationId>")
      const flowReq = decrypted as { action: string; screen: string; data: Record<string, unknown>; flow_token: string };

      // Health-check ping arrives encrypted — respond with encrypted active status
      if (flowReq.action === 'ping') {
        const pingResp = encryptFlowResponse({ data: { status: 'active' } }, aesKey, iv);
        return reply.type('text/plain').send(pingResp);
      }

      const [salonId] = (flowReq.flow_token ?? '').split(':');
      if (!salonId) {
        return reply.code(400).send({ error: 'invalid_flow_token' });
      }

      let responseBody: unknown;
      try {
        responseBody = await handleFlowDataExchange(salonId, {
          version: '3.0',
          action: flowReq.action as 'INIT' | 'data_exchange' | 'BACK',
          screen: flowReq.screen,
          data: flowReq.data ?? {},
          flow_token: flowReq.flow_token,
        });
      } catch (err) {
        logger.error({ err, salonId, screen: flowReq.screen }, 'flow_data_exchange_error');
        return reply.code(500).send({ error: 'data_exchange_failed' });
      }

      const encrypted = encryptFlowResponse(responseBody, aesKey, iv);
      return reply.type('text/plain').send(encrypted);
    });
  });

  await app.register(payCheckoutRoutes);

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
      functions: [sendOutboundMessage, sendOutboundMessageFailure, appointmentReminder, refreshMaterializedViews, executeScheduledCampaign, checkScheduledCampaigns, conversationInactivity, bookingRatingPrompt, winbackCampaign, birthdayCampaign, appointmentRating, googleReviewRequest, appointmentAftercare, reactivationCampaign],
      // The boot-time self-resync (see selfRegisterInngest) hits this route on the
      // loopback interface, so the host inferred from request headers would be
      // 127.0.0.1 — a URL Inngest Cloud can't call back. Pin the public origin so
      // registration always points at the real domain, however the PUT arrives.
      // NB: the option is `serveOrigin` (full origin, e.g. https://host), NOT
      // `serveHost` — an unknown key is silently ignored and localhost leaks
      // through. Only set it when PUBLIC_BASE_URL is a real (non-localhost) origin,
      // since pinning localhost here would make Inngest reject every sync.
      ...(!inngestIsDev && !env.PUBLIC_BASE_URL.includes('localhost')
        ? { serveOrigin: new URL(env.PUBLIC_BASE_URL).origin, servePath: '/api/inngest' }
        : {}),
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
