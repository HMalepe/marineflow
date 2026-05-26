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
import { whatsappCloudMessaging } from './lib/integrations/messaging/whatsapp-cloud-impl.js';
import { handleInboundWhatsApp } from './services/bot.js';
import { recordWebhookEvent } from './lib/webhooks.js';
import { resolveTenantForInbound } from './lib/tenant.js';
import { handleStripeWebhook } from './services/payments.js';
import { serve } from 'inngest/fastify';
import { inngest, sendOutboundMessage, sendOutboundMessageFailure, appointmentReminder, refreshMaterializedViews, executeScheduledCampaign, checkScheduledCampaigns } from './lib/inngest/index.js';
import { authRoutes } from './routes/auth.js';
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
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3001'];
  await app.register(cors, {
    origin: allowedOrigins,
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

    // #region agent log
    fetch('http://127.0.0.1:7303/ingest/8de01daf-7e06-48b5-8401-fa1f790b3596',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e981d'},body:JSON.stringify({sessionId:'8e981d',location:'app.ts:webhook-entry',message:'Twilio webhook received',data:{from:params['From'],to:params['To'],body:params['Body'],sid:params['MessageSid'],hasSig:!!signature},timestamp:Date.now(),hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion

    if (!twilioMessaging.verifyWebhook(params, signature)) {
      // #region agent log
      fetch('http://127.0.0.1:7303/ingest/8de01daf-7e06-48b5-8401-fa1f790b3596',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e981d'},body:JSON.stringify({sessionId:'8e981d',location:'app.ts:sig-fail',message:'Signature verification FAILED',data:{signature},timestamp:Date.now(),hypothesisId:'H0'})}).catch(()=>{});
      // #endregion
      return reply.code(403).send({ error: 'invalid_signature' });
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
          // #region agent log
          fetch('http://127.0.0.1:7303/ingest/8de01daf-7e06-48b5-8401-fa1f790b3596',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e981d'},body:JSON.stringify({sessionId:'8e981d',location:'app.ts:dedupe-hit',message:'Redis dedupe blocked message',data:{dedupeKey,first},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
          // #endregion
          return reply.send('');
        }
      } catch {
        // Redis unavailable — skip deduplication, proceed with message
      }
      const tenant = await resolveTenantForInbound({ twilioTo: to });
      const recorded = await recordWebhookEvent({
        provider: 'twilio',
        providerEventId: messageSid,
        payload: params,
        verified: true,
        salonId: tenant?.id,
      });
      if (recorded === 'duplicate') {
        // #region agent log
        fetch('http://127.0.0.1:7303/ingest/8de01daf-7e06-48b5-8401-fa1f790b3596',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e981d'},body:JSON.stringify({sessionId:'8e981d',location:'app.ts:webhook-dupe',message:'recordWebhookEvent returned duplicate',data:{messageSid},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
        // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7303/ingest/8de01daf-7e06-48b5-8401-fa1f790b3596',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e981d'},body:JSON.stringify({sessionId:'8e981d',location:'app.ts:bot-success',message:'handleInboundWhatsApp completed OK',data:{from,body},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
    } catch (botErr: unknown) {
      // #region agent log
      fetch('http://127.0.0.1:7303/ingest/8de01daf-7e06-48b5-8401-fa1f790b3596',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e981d'},body:JSON.stringify({sessionId:'8e981d',location:'app.ts:bot-error',message:'handleInboundWhatsApp THREW',data:{error:String(botErr),stack:(botErr as Error)?.stack?.slice(0,500)},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
    }

    return reply.type('text/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    );
  });

  app.get('/webhooks/whatsapp', async (request, reply) => {
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

  app.post('/webhooks/whatsapp', async (request, reply) => {
    const raw = request.body as unknown;
    const signature =
      typeof request.headers['x-hub-signature-256'] === 'string'
        ? request.headers['x-hub-signature-256']
        : undefined;

    if (!signature || !whatsappCloudMessaging.verifyWebhook(raw, signature)) {
      return reply.code(401).send({ error: 'invalid_signature' });
    }

    const messages = whatsappCloudMessaging.parseInboundBatch(raw);
    if (messages.length === 0) {
      return reply.send({ received: true });
    }

    for (const inbound of messages) {
      const recorded = await recordWebhookEvent({
        provider: 'meta',
        providerEventId: inbound.externalId,
        payload: raw,
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

  await app.register(async function stripeRawBody(f) {
    f.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer', bodyLimit: 2 * 1024 * 1024 },
      (_req, body, done) => {
        done(null, body);
      },
    );

    f.post('/stripe', async (request, reply) => {
      const sig = request.headers['stripe-signature'];
      const buf = request.body as Buffer;
      try {
        await handleStripeWebhook(buf, typeof sig === 'string' ? sig : undefined);
      } catch (e) {
        logger.error(e);
        return reply.code(400).send({ error: 'stripe_webhook_error' });
      }
      return reply.send({ received: true });
    });
  }, { prefix: '/webhooks' });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(plannedRoutes, { prefix: '/api/planned' });
  await app.register(dashboardApiRoutes, { prefix: '/api' });
  await app.register(adminApiRoutes, { prefix: '/admin' });
  await app.register(agencyApiRoutes, { prefix: '/agency' });
  await app.register(sseRoutes, { prefix: '/api' });
  await app.register(mobileApiRoutes, { prefix: '/api' });
  await app.register(internalRoutes, { prefix: '/internal' });

  app.route({
    method: ['GET', 'POST', 'PUT'],
    url: '/api/inngest',
    handler: serve({
      client: inngest,
      functions: [sendOutboundMessage, sendOutboundMessageFailure, appointmentReminder, refreshMaterializedViews, executeScheduledCampaign, checkScheduledCampaigns],
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
