import type { FastifyInstance } from 'fastify';
import { requireAuth } from './auth.js';
import { subscribeSalon } from '../lib/eventBus.js';

export async function sseRoutes(app: FastifyInstance) {
  app.get('/events/stream', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user as { salonId?: string };
    const salonId = user.salonId;

    if (!salonId) {
      return reply.code(403).send({ error: 'salon_required' });
    }

    // Hijack the response so Fastify doesn't auto-close it
    reply.hijack();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    reply.raw.write(': connected\n\n');

    const heartbeat = setInterval(() => {
      if (!reply.raw.destroyed) {
        reply.raw.write(': heartbeat\n\n');
      }
    }, 30_000);

    const unsubscribe = await subscribeSalon(salonId, (event) => {
      if (!reply.raw.destroyed) {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
      }
    });

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
