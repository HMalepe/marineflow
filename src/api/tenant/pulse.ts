import { DateTime } from 'luxon';
import type { PrismaTx } from '../../lib/db/tenantSession.js';

export type StationStatus = 'occupied' | 'idle' | 'arriving' | 'payment_pending' | 'off';

export type PulseStation = {
  staffId: string;
  staffName: string;
  branchId: string | null;
  branchName: string | null;
  status: StationStatus;
  customerName: string | null;
  serviceName: string | null;
  until: string | null;
  appointmentId: string | null;
};

export type PulseConversation = {
  id: string;
  customerName: string;
  step: string;
  stepLabel: string;
  lastMessageAt: string | null;
  isHandoff: boolean;
};

export type PulseTickerItem = {
  id: string;
  at: string;
  text: string;
};

export type PulseSnapshot = {
  generatedAt: string;
  stations: PulseStation[];
  conversations: PulseConversation[];
  ticker: PulseTickerItem[];
  summary: {
    occupied: number;
    idle: number;
    arriving: number;
    paymentPending: number;
    activeChats: number;
  };
};

const STEP_LABELS: Record<string, string> = {
  GREETING: 'Greeting',
  MENU: 'Main menu',
  PICK_SERVICE: 'Picking service',
  PICK_SERVICE_CATEGORY: 'Browsing services',
  PICK_STAFF: 'Picking stylist',
  PICK_DATE: 'Picking date',
  PICK_SLOT: 'Picking time',
  CONFIRM_BOOKING: 'Confirming',
  FAQ: 'FAQ',
  HANDOFF: 'Live handoff',
  MANAGE_BOOKING: 'Managing booking',
  RESCHEDULE: 'Rescheduling',
  MARKETING_CONSENT: 'POPIA consent',
};

const ACTIVE_STEPS = [
  'GREETING',
  'MENU',
  'PICK_SERVICE',
  'PICK_SERVICE_CATEGORY',
  'PICK_STAFF',
  'PICK_DATE',
  'PICK_SLOT',
  'CONFIRM_BOOKING',
  'FAQ',
  'HANDOFF',
  'MANAGE_BOOKING',
  'RESCHEDULE',
  'MARKETING_CONSENT',
  'BOOKING_POPIA_CONSENT',
  'PICK_BRANCH',
] as const;

export async function getPulseSnapshot(
  db: PrismaTx,
  salonId: string,
  options?: { branchId?: string | null },
): Promise<PulseSnapshot> {
  const salon = await db.salon.findUniqueOrThrow({
    where: { id: salonId },
    select: { timezone: true },
  });
  const timezone = salon.timezone || 'Africa/Johannesburg';
  const now = DateTime.now().setZone(timezone);
  const nowJs = now.toJSDate();
  const in30 = now.plus({ minutes: 30 }).toJSDate();
  const twoHoursAgo = now.minus({ hours: 2 }).toJSDate();

  const branchFilter = options?.branchId ? { branchId: options.branchId } : {};

  const [staff, appointments, conversations, recentAppts, arrivingAppts] = await Promise.all([
    db.staff.findMany({
      where: {
        salonId,
        deletedAt: null,
        active: true,
        isBookable: true,
        ...(options?.branchId ? { branchId: options.branchId } : {}),
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        branchId: true,
        branch: { select: { name: true } },
      },
    }),
    db.appointment.findMany({
      where: {
        salonId,
        status: { notIn: ['CANCELLED', 'RESCHEDULED'] },
        start: { lte: in30 },
        end: { gte: nowJs },
        ...branchFilter,
      },
      include: {
        service: { select: { name: true } },
        customer: { select: { displayName: true, firstName: true, lastName: true } },
        staff: { select: { id: true, name: true } },
      },
    }),
    db.conversation.findMany({
      where: {
        salonId,
        step: { in: [...ACTIVE_STEPS] },
        lastMessageAt: { gte: twoHoursAgo },
      },
      include: {
        customer: { select: { displayName: true, firstName: true, lastName: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 12,
    }),
    db.appointment.findMany({
      where: {
        salonId,
        createdAt: { gte: twoHoursAgo },
        status: { notIn: ['CANCELLED'] },
        ...branchFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        service: { select: { name: true } },
        customer: { select: { displayName: true, firstName: true } },
        staff: { select: { name: true } },
      },
    }),
    db.appointment.findMany({
      where: {
        salonId,
        status: { notIn: ['CANCELLED', 'RESCHEDULED', 'COMPLETED'] },
        start: { gt: nowJs, lte: in30 },
        ...branchFilter,
      },
      include: {
        service: { select: { name: true } },
        customer: { select: { displayName: true, firstName: true } },
        staff: { select: { id: true, name: true } },
      },
    }),
  ]);

  function custName(c: {
    displayName: string | null;
    firstName: string | null;
    lastName?: string | null;
  }) {
    return c.displayName?.trim() || c.firstName?.trim() || 'Customer';
  }

  const stations: PulseStation[] = staff.map((s) => {
    const current = appointments.find((a) => a.staffId === s.id && a.start <= nowJs && a.end >= nowJs);
    const arriving = arrivingAppts.find((a) => a.staffId === s.id);
    const paymentPending = current?.status === 'PENDING_PAYMENT';

    if (paymentPending && current) {
      return {
        staffId: s.id,
        staffName: s.name,
        branchId: s.branchId,
        branchName: s.branch?.name ?? null,
        status: 'payment_pending' as const,
        customerName: custName(current.customer),
        serviceName: current.service.name,
        until: current.end.toISOString(),
        appointmentId: current.id,
      };
    }

    if (current) {
      return {
        staffId: s.id,
        staffName: s.name,
        branchId: s.branchId,
        branchName: s.branch?.name ?? null,
        status: 'occupied' as const,
        customerName: custName(current.customer),
        serviceName: current.service.name,
        until: current.end.toISOString(),
        appointmentId: current.id,
      };
    }

    if (arriving) {
      return {
        staffId: s.id,
        staffName: s.name,
        branchId: s.branchId,
        branchName: s.branch?.name ?? null,
        status: 'arriving' as const,
        customerName: custName(arriving.customer),
        serviceName: arriving.service.name,
        until: arriving.start.toISOString(),
        appointmentId: arriving.id,
      };
    }

    return {
      staffId: s.id,
      staffName: s.name,
      branchId: s.branchId,
      branchName: s.branch?.name ?? null,
      status: 'idle' as const,
      customerName: null,
      serviceName: null,
      until: null,
      appointmentId: null,
    };
  });

  const pulseConversations: PulseConversation[] = conversations.map((c) => ({
    id: c.id,
    customerName: custName(c.customer),
    step: c.step,
    stepLabel: STEP_LABELS[c.step] ?? c.step.replace(/_/g, ' ').toLowerCase(),
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    isHandoff: c.step === 'HANDOFF' || Boolean(c.handoffReason),
  }));

  const ticker: PulseTickerItem[] = recentAppts.map((a) => {
    const when = DateTime.fromJSDate(a.start).setZone(timezone).toFormat('EEE d MMM HH:mm');
    return {
      id: a.id,
      at: a.createdAt.toISOString(),
      text: `${custName(a.customer)} booked ${a.service.name} for ${when}${a.staff ? ` with ${a.staff.name}` : ''}`,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    stations,
    conversations: pulseConversations,
    ticker,
    summary: {
      occupied: stations.filter((s) => s.status === 'occupied').length,
      idle: stations.filter((s) => s.status === 'idle').length,
      arriving: stations.filter((s) => s.status === 'arriving').length,
      paymentPending: stations.filter((s) => s.status === 'payment_pending').length,
      activeChats: pulseConversations.length,
    },
  };
}
