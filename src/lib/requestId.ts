/**
 * Adds a unique request ID to every request for log correlation.
 * Uses X-Request-Id header if provided (load balancer), otherwise generates one.
 */
export function registerRequestId(app: { addHook: Function }) {
  app.addHook('onSend', async (request: { id: string }, reply: { header: Function }) => {
    reply.header('X-Request-Id', request.id);
  });
}
