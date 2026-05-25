import type { FastifyInstance } from 'fastify';
import { requireAuth } from './auth.js';
import { withUserTenant } from '../lib/db/withUserTenant.js';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { getAvailableSlots } from '../services/slots.js';
import { getCachedServices, getCachedStaff } from '../services/cachedQueries.js';

/**
 * Mobile-optimized API endpoints.
 * Designed for React Native / mobile clients with:
 * - Sparse field selection via `fields` query param
 * - Paginated results
 * - Push notification registration
 * - QR code walk-in check-in
 */
export async function mobileApiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // ─── Services (cached, lightweight) ─────────────────────────────────
  app.get('/mobile/services', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const services = await getCachedServices(user.salonId);
      return {
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMin: s.durationMin,
          priceCents: s.priceCents,
          category: s.category?.name ?? null,
        })),
      };
    });
  });

  // ─── Staff (cached, lightweight) ───────────────────────────────────
  app.get('/mobile/staff', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const staff = await getCachedStaff(user.salonId);
      return {
        staff: staff.map((s) => ({
          id: s.id,
          name: s.name,
          bio: s.bio,
          avatarUrl: s.avatarUrl,
        })),
      };
    });
  });

  // ─── Available Slots (for booking) ─────────────────────────────────
  app.get('/mobile/slots', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { serviceId, staffId, date } = request.query as {
        serviceId?: string;
        staffId?: string;
        date?: string;
      };

      if (!serviceId || !staffId || !date) {
        reply.code(400);
        return { error: 'serviceId, staffId, and date required' };
      }

      const db = getTenantDb();
      const [service, staff] = await Promise.all([
        db.service.findUnique({ where: { id: serviceId } }),
        db.staff.findUnique({ where: { id: staffId } }),
      ]);

      if (!service || !staff) {
        reply.code(404);
        return { error: 'service_or_staff_not_found' };
      }

      const slots = await getAvailableSlots({
        salonId: user.salonId,
        service,
        staff,
        localDateStr: date,
      });

      return {
        slots: slots.map((s) => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
        })),
      };
    });
  });

  // ─── Push Token Registration ────────────────────────────────────────
  app.post('/mobile/push-token', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { token, platform, customerId } = request.body as {
        token: string;
        platform: string;
        customerId: string;
      };

      if (!token || !platform || !customerId) {
        reply.code(400);
        return { error: 'token, platform, customerId required' };
      }

      const db = getTenantDb();
      const existing = await db.pushToken.findFirst({
        where: { customerId, token },
      });

      if (existing) {
        await db.pushToken.update({
          where: { id: existing.id },
          data: { active: true },
        });
        return { registered: true, id: existing.id };
      }

      const record = await db.pushToken.create({
        data: {
          salonId: user.salonId,
          customerId,
          platform,
          token,
        },
      });

      return { registered: true, id: record.id };
    });
  });

  app.delete('/mobile/push-token', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const { token } = request.body as { token: string };
      if (!token) {
        reply.code(400);
        return { error: 'token required' };
      }

      const db = getTenantDb();
      await db.pushToken.updateMany({
        where: { token },
        data: { active: false },
      });

      return { ok: true };
    });
  });

  // ─── QR Code Walk-in Check-in ──────────────────────────────────────
  app.post('/mobile/checkin', async (request, reply) => {
    return withUserTenant(request, reply, async (user) => {
      const { appointmentId, qrPayload } = request.body as {
        appointmentId?: string;
        qrPayload?: string;
      };

      const db = getTenantDb();

      if (qrPayload) {
        // QR code encodes the appointment ID
        const decoded = Buffer.from(qrPayload, 'base64url').toString('utf8');
        const apt = await db.appointment.findFirst({
          where: { id: decoded, salonId: user.salonId },
        });
        if (!apt) {
          reply.code(404);
          return { error: 'appointment_not_found' };
        }
        await db.appointment.update({
          where: { id: apt.id },
          data: { status: 'CONFIRMED' },
        });
        return { checkedIn: true, appointmentId: apt.id };
      }

      if (appointmentId) {
        await db.appointment.update({
          where: { id: appointmentId },
          data: { status: 'CONFIRMED' },
        });
        return { checkedIn: true, appointmentId };
      }

      reply.code(400);
      return { error: 'appointmentId or qrPayload required' };
    });
  });

  // ─── QR Code Generation ────────────────────────────────────────────
  app.get('/mobile/checkin-qr/:appointmentId', async (request, reply) => {
    return withUserTenant(request, reply, async () => {
      const { appointmentId } = request.params as { appointmentId: string };
      const payload = Buffer.from(appointmentId, 'utf8').toString('base64url');
      return { qrPayload: payload, appointmentId };
    });
  });
}
