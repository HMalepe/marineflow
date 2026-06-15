/**
 * WhatsApp Flows — data exchange handler.
 * Called by our Fastify endpoint when Meta POST's a flow data exchange request.
 *
 * Each screen navigation calls this endpoint to fetch dynamic data
 * (services, staff, available slots) before rendering the next screen.
 */

import { DateTime } from 'luxon';
import { withTenantContext } from '../db/tenantSession.js';
import { getTenantDb } from '../db/tenantSession.js';
import { getAvailableSlots } from '../../services/slots.js';
import { FLOW_SCREENS } from './types.js';
import type { FlowDataExchangeRequest, FlowDataExchangeResponse, FlowCompletionResponse } from './types.js';
import { logger } from '../logger.js';

type FlowResponse = FlowDataExchangeResponse | FlowCompletionResponse;

/** Entry point — route incoming screen action to the right handler. */
export async function handleFlowDataExchange(
  salonId: string,
  req: FlowDataExchangeRequest,
): Promise<FlowResponse> {
  const { screen, action, data } = req;

  if (action === 'INIT') {
    return handleInit(salonId);
  }

  if (action === 'data_exchange') {
    const target = (data.screen as string | undefined) ?? screen;
    switch (target) {
      case FLOW_SCREENS.STAFF:
        return handleStaffScreen(salonId, data);
      case FLOW_SCREENS.DATE:
        return handleDateScreen(salonId, data);
      case FLOW_SCREENS.TIME:
        return handleTimeScreen(salonId, data);
      case FLOW_SCREENS.CONFIRM:
        return handleConfirmScreen(salonId, data);
      default:
        return handleInit(salonId);
    }
  }

  // BACK — return to service screen
  return handleInit(salonId);
}

// ── Screen handlers ──────────────────────────────────────────────────────────

async function handleInit(salonId: string): Promise<FlowDataExchangeResponse> {
  const services = await withTenantContext(salonId, async () => {
    return getTenantDb().service.findMany({
      where: { salonId, active: true, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, durationMin: true, priceCents: true },
    });
  });

  return {
    version: '3.0',
    screen: FLOW_SCREENS.SERVICE,
    data: {
      services: services.map((s) => ({
        id: s.id,
        title: s.name,
        description: `${s.durationMin} min · ${formatMoney(s.priceCents)}`,
      })),
    },
  };
}

async function handleStaffScreen(
  salonId: string,
  data: Record<string, unknown>,
): Promise<FlowDataExchangeResponse> {
  const serviceId = data.serviceId as string;

  const [service, staffList] = await withTenantContext(salonId, async () => {
    const db = getTenantDb();
    return Promise.all([
      db.service.findFirst({ where: { id: serviceId, salonId, active: true, deletedAt: null } }),
      db.staff.findMany({
        where: { salonId, active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);
  });

  if (!service) throw new Error(`Service ${serviceId} not found`);

  return {
    version: '3.0',
    screen: FLOW_SCREENS.STAFF,
    data: {
      serviceId: service.id,
      serviceName: `${service.name} · ${formatMoney(service.priceCents)}`,
      staff: [
        { id: 'any', title: 'Any Available', description: 'First available staff member' },
        ...staffList.map((s) => ({ id: s.id, title: s.name })),
      ],
    },
  };
}

async function handleDateScreen(
  salonId: string,
  data: Record<string, unknown>,
): Promise<FlowDataExchangeResponse> {
  const serviceId = data.serviceId as string;
  const staffId = data.staffId as string;

  const [service, staff] = await withTenantContext(salonId, async () => {
    const db = getTenantDb();
    return Promise.all([
      db.service.findFirst({ where: { id: serviceId, salonId } }),
      staffId === 'any' ? null : db.staff.findFirst({ where: { id: staffId, salonId } }),
    ]);
  });

  if (!service) throw new Error(`Service ${serviceId} not found`);

  const today = DateTime.now().setZone(await getSalonTimezone(salonId));
  const minDate = today.toFormat('yyyy-MM-dd');
  const maxDate = today.plus({ days: 60 }).toFormat('yyyy-MM-dd');
  const staffName = staff?.name ?? 'Any Available';

  return {
    version: '3.0',
    screen: FLOW_SCREENS.DATE,
    data: {
      serviceId: service.id,
      serviceName: service.name,
      staffId: staffId,
      staffName,
      subtitle: `${service.name} with ${staffName}`,
      minDate,
      maxDate,
    },
  };
}

async function handleTimeScreen(
  salonId: string,
  data: Record<string, unknown>,
): Promise<FlowDataExchangeResponse> {
  const serviceId = data.serviceId as string;
  const staffId = data.staffId as string;
  const date = data.date as string; // YYYY-MM-DD

  const [service, staffList, tz] = await withTenantContext(salonId, async () => {
    const db = getTenantDb();
    const [svc, allStaff, salon] = await Promise.all([
      db.service.findFirst({ where: { id: serviceId, salonId, active: true, deletedAt: null } }),
      staffId === 'any'
        ? db.staff.findMany({ where: { salonId, active: true } })
        : db.staff.findMany({ where: { id: staffId, salonId, active: true } }),
      db.salon.findUniqueOrThrow({ where: { id: salonId }, select: { timezone: true } }),
    ]);
    return [svc, allStaff, salon.timezone] as const;
  });

  if (!service || !staffList.length) {
    return {
      version: '3.0',
      screen: FLOW_SCREENS.TIME,
      data: {
        serviceId,
        serviceName: service?.name ?? '',
        staffId,
        staffName: 'Any Available',
        date,
        dateLabel: formatDateLabel(date, tz),
        subtitle: `${service?.name ?? ''} with Any Available`,
        noSlots: true,
        slots: [],
      },
    };
  }

  // Collect slots across all eligible staff (deduplicate by start time)
  const seenTimes = new Set<string>();
  const slots: { id: string; title: string }[] = [];

  for (const staff of staffList) {
    let result;
    try {
      result = await withTenantContext(salonId, () =>
        getAvailableSlots({ salonId, service, staff, localDateStr: date }),
      );
    } catch (err) {
      logger.warn({ err, salonId, serviceId, staffId: staff.id, date }, 'flow_slots_fetch_failed');
      continue;
    }

    for (const slot of result.slots) {
      const key = slot.start.toISOString();
      if (seenTimes.has(key)) continue;
      seenTimes.add(key);
      const label = DateTime.fromJSDate(slot.start).setZone(tz).toFormat('HH:mm');
      slots.push({ id: slot.start.toISOString(), title: label });
    }
  }

  // Sort by time
  slots.sort((a, b) => a.id.localeCompare(b.id));

  const pickedStaff = staffList[0]!;
  const staffName = staffId === 'any' ? 'Any Available' : pickedStaff.name;

  return {
    version: '3.0',
    screen: FLOW_SCREENS.TIME,
    data: {
      serviceId,
      serviceName: service.name,
      staffId,
      staffName,
      date,
      dateLabel: formatDateLabel(date, tz),
      subtitle: `${service.name} with ${staffName}`,
      noSlots: slots.length === 0,
      slots,
    },
  };
}

async function handleConfirmScreen(
  _salonId: string,
  data: Record<string, unknown>,
): Promise<FlowDataExchangeResponse> {
  const serviceName = data.serviceName as string;
  const staffName = data.staffName as string;
  const dateLabel = data.dateLabel as string;
  const timeLabel = data.timeLabel as string;

  const summary = [
    `📋 *Booking Summary*`,
    ``,
    `💇 ${serviceName}`,
    `👤 ${staffName}`,
    `📅 ${dateLabel}`,
    `🕐 ${timeLabel}`,
  ].join('\n');

  return {
    version: '3.0',
    screen: FLOW_SCREENS.CONFIRM,
    data: { ...data, summary },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(cents: number): string {
  return `R ${(cents / 100).toFixed(0)}`;
}

function formatDateLabel(dateStr: string, tz: string): string {
  return DateTime.fromISO(dateStr, { zone: tz }).toFormat('cccc, dd MMM yyyy');
}

async function getSalonTimezone(_salonId: string): Promise<string> {
  const salon = getTenantDb().salon.findUniqueOrThrow({ where: { id: _salonId }, select: { timezone: true } });
  return (await salon).timezone;
}
