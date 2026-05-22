import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  PLANNED_ENDPOINTS,
  catalogSummary,
  type PlannedEndpoint,
} from '../roadmap/plannedCatalog.js';
import { WEEK_ONE_TASKS } from '../roadmap/weeks/week01.js';

function placeholderBody(route: PlannedEndpoint, request: FastifyRequest) {
  return {
    placeholder: true,
    week: route.week,
    phase: route.phase,
    method: route.method,
    path: `/api/planned/${route.path}`,
    summary: route.summary,
    message:
      'Stub response — wire Prisma/services here when this week ships. See src/roadmap/plannedCatalog.ts.',
    received: {
      query: request.query,
      params: request.params as Record<string, string>,
    },
  };
}

function registerOne(app: FastifyInstance, route: PlannedEndpoint) {
  const path = `/${route.path}`;
  const handler = (request: FastifyRequest, reply: FastifyReply) =>
    reply.code(200).send(placeholderBody(route, request));

  switch (route.method) {
    case 'GET':
      app.get(path, handler);
      break;
    case 'POST':
      app.post(path, handler);
      break;
    case 'PUT':
      app.put(path, handler);
      break;
    case 'PATCH':
      app.patch(path, handler);
      break;
    case 'DELETE':
      app.delete(path, handler);
      break;
    default:
      break;
  }
}

export async function plannedRoutes(app: FastifyInstance) {
  app.get('/catalog', async () => ({
    placeholder: false,
    description: 'All routes under /api/planned/* are scaffolding until implemented.',
    endpoints: PLANNED_ENDPOINTS.map((e) => ({
      week: e.week,
      phase: e.phase,
      method: e.method,
      path: `/api/planned/${e.path}`,
      summary: e.summary,
    })),
    summary: catalogSummary(),
  }));

  app.get('/summary', async () => ({
    placeholder: false,
    weeks: 24,
    totalEndpoints: PLANNED_ENDPOINTS.length,
    summary: catalogSummary(),
  }));

  /** Week 1 runbook — same checklist as Cursor todos / foundation sprint. */
  app.get('/checklists/week-1', async () => ({
    placeholder: false,
    week: 1,
    title: 'Foundation & sandbox validation',
    description:
      'Operational checklist (env, DB, tunnel, Twilio). Complete in order where possible.',
    tasks: WEEK_ONE_TASKS,
    api: {
      catalog: '/api/planned/catalog',
      summary: '/api/planned/summary',
    },
  }));

  for (const route of PLANNED_ENDPOINTS) {
    registerOne(app, route);
  }
}
