import type { FastifyInstance } from 'fastify';

/**
 * Adds a unique request ID to every request for log correlation.
 * Uses X-Request-Id header if provided (load balancer), otherwise generates one.
 */
export function registerRequestId(app: Pick<FastifyInstance, 'addHook'>) {
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });
}
