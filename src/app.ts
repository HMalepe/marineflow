import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './config.js';
import { logger } from './lib/logger.js';
import { redisPing } from './lib/redis.js';
import { prisma } from './lib/prisma.js';
import { validateTwilioRequest } from './lib/twilioValidate.js';
import { handleInboundWhatsApp } from './services/bot.js';
import { redis } from './lib/redis.js';
import { handleStripeWebhook } from './services/payments.js';
import { authRoutes } from './routes/auth.js';
import { dashboardApiRoutes } from './routes/dashboardApi.js';
import { internalRoutes } from './routes/internal.js';
import { plannedRoutes } from './routes/planned.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
  });

  await app.register(formbody);
  await app.register(jwt, {
    secret: env.SESSION_SECRET,
  });

  const publicRoot = path.join(__dirname, '..', 'public');
  await app.register(fastifyStatic, {
    root: publicRoot,
    prefix: '/',
    decorateReply: true,
  });

  app.get('/', async (_req, reply) => {
    const html = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf-8');
    return reply.type('text/html').send(html);
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

    const url = `${env.TWILIO_WEBHOOK_BASE_URL.replace(/\/$/, '')}/webhooks/twilio/whatsapp`;
    if (!validateTwilioRequest(signature, url, params)) {
      return reply.code(403).send({ error: 'invalid_signature' });
    }

    const messageSid = params['MessageSid'] ?? '';
    const from = params['From'] ?? '';
    const body = params['Body'] ?? '';

    if (messageSid) {
      const dedupeKey = `msg:${messageSid}`;
      const first = await redis.set(dedupeKey, '1', 'EX', 86400, 'NX');
      if (first !== 'OK') {
        return reply.send('');
      }
    }

    await handleInboundWhatsApp({
      from,
      body,
      messageSid,
    });

    return reply.type('text/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    );
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
  await app.register(internalRoutes, { prefix: '/internal' });

  app.setErrorHandler((err: unknown, _request, reply) => {
    logger.error(err);
    const status =
      err && typeof err === 'object' && 'statusCode' in err && typeof err.statusCode === 'number'
        ? err.statusCode
        : 500;
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return reply.code(status).send({
      type: 'about:blank',
      title: message,
      status,
    });
  });

  return app;
}
