import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../config.js';

export async function internalRoutes(app: FastifyInstance) {
  app.post<{
    Body: {
      customerWaId: string;
      serviceId: string;
      staffId: string;
      startIso: string;
    };
  }>('/appointments', async (request, reply) => {
    const key = request.headers['x-internal-key'];
    if (key !== env.INTERNAL_API_KEY) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const { customerWaId, serviceId, staffId, startIso } = request.body ?? {};
    if (!customerWaId || !serviceId || !staffId || !startIso) {
      return reply.code(400).send({ error: 'missing_fields' });
    }

    const salon = await prisma.salon.findFirst({ where: { slug: env.DEFAULT_SALON_SLUG } });
    if (!salon) return reply.code(500).send({ error: 'no_salon' });

    const customer = await prisma.customer.upsert({
      where: { salonId_waId: { salonId: salon.id, waId: customerWaId } },
      create: { salonId: salon.id, waId: customerWaId },
      update: {},
    });

    const service = await prisma.service.findFirst({
      where: { id: serviceId, salonId: salon.id },
    });
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, salonId: salon.id },
    });
    if (!service || !staff) return reply.code(400).send({ error: 'invalid_refs' });

    const start = new Date(startIso);
    const end = new Date(
      start.getTime() + (service.durationMin + service.bufferMin + staff.breakMin) * 60_000,
    );

    const appt = await prisma.appointment.create({
      data: {
        salonId: salon.id,
        customerId: customer.id,
        serviceId: service.id,
        staffId: staff.id,
        start,
        end,
        status: 'CONFIRMED',
      },
    });

    return { appointmentId: appt.id };
  });
}
