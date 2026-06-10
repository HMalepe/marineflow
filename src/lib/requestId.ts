import type { FastifyInstance } from 'fastify';

/**
 * Adds a unique request ID to every request for log correlation.
 * Uses X-Request-Id header if provided (load balancer), otherwise generates one.
 * Accepts any FastifyInstance regardless of logger type parameter.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerRequestId(app: Pick<FastifyInstance<any, any, any, any>, 'addHook'>) {
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });
}
