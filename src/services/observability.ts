import { prisma } from '../lib/prisma.js';

/**
 * Platform-wide observability metrics for the admin panel.
 */
export async function getPlatformMetrics() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [
    totalSalons,
    activeSalons,
    totalCustomers,
    totalAppointments,
    appointmentsToday,
    messagesLastHour,
    webhookDeliveries24h,
    webhookFailures24h,
    campaignsSending,
  ] = await Promise.all([
    prisma.salon.count(),
    prisma.salon.count({ where: { status: 'ACTIVE' } }),
    prisma.customer.count(),
    prisma.appointment.count(),
    prisma.appointment.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.message.count({ where: { createdAt: { gte: oneHourAgo } } }),
    prisma.webhookDelivery.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.webhookDelivery.count({ where: { createdAt: { gte: oneDayAgo }, success: false } }),
    prisma.campaign.count({ where: { status: 'SENDING' } }),
  ]);

  const webhookSuccessRate = webhookDeliveries24h > 0
    ? ((webhookDeliveries24h - webhookFailures24h) / webhookDeliveries24h * 100).toFixed(1)
    : '100.0';

  return {
    platform: {
      totalSalons,
      activeSalons,
      totalCustomers,
      totalAppointments,
    },
    activity: {
      appointmentsToday,
      messagesLastHour,
      campaignsSending,
    },
    webhooks: {
      deliveries24h: webhookDeliveries24h,
      failures24h: webhookFailures24h,
      successRate: `${webhookSuccessRate}%`,
    },
    timestamp: now.toISOString(),
  };
}

/**
 * Bot conversation funnel analytics.
 * Tracks drop-off at each conversation step.
 */
export async function getConversationFunnel(salonId?: string) {
  const where = salonId ? { salonId } : {};

  const steps = [
    'GREETING',
    'MENU',
    'PICK_SERVICE',
    'PICK_STAFF',
    'PICK_DATE',
    'PICK_SLOT',
    'CONFIRM_BOOKING',
  ];

  const counts = await Promise.all(
    steps.map(async (step) => ({
      step,
      count: await prisma.conversation.count({
        where: { ...where, step: step as never },
      }),
    })),
  );

  const completed = await prisma.appointment.count({
    where: salonId ? { salonId, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } : { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
  });

  return {
    funnel: counts,
    completedBookings7d: completed,
  };
}

/**
 * Check for alert conditions.
 */
export async function checkAlertThresholds() {
  const alerts: { level: string; message: string }[] = [];

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // High webhook failure rate
  const [total, failed] = await Promise.all([
    prisma.webhookDelivery.count({ where: { createdAt: { gte: oneHourAgo } } }),
    prisma.webhookDelivery.count({ where: { createdAt: { gte: oneHourAgo }, success: false } }),
  ]);

  if (total > 10 && failed / total > 0.5) {
    alerts.push({
      level: 'critical',
      message: `Webhook failure rate ${((failed / total) * 100).toFixed(0)}% in last hour (${failed}/${total})`,
    });
  }

  // Campaigns stuck in SENDING
  const stuckCampaigns = await prisma.campaign.count({
    where: {
      status: 'SENDING',
      sentAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
    },
  });

  if (stuckCampaigns > 0) {
    alerts.push({
      level: 'warning',
      message: `${stuckCampaigns} campaign(s) stuck in SENDING state for >30min`,
    });
  }

  // Salons past due
  const pastDue = await prisma.salon.count({ where: { status: 'PAST_DUE' } });
  if (pastDue > 0) {
    alerts.push({
      level: 'info',
      message: `${pastDue} salon(s) in PAST_DUE status`,
    });
  }

  return { alerts, checkedAt: new Date().toISOString() };
}
