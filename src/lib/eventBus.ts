import { Redis } from 'ioredis';
import { env } from '../config.js';
import { logger } from './logger.js';

const CHANNEL_PREFIX = 'marineflow:events:';

export interface SalonEvent {
  type: string;
  salonId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    publisher.on('error', (err: Error) => logger.error({ err }, 'event_bus_pub_error'));
  }
  return publisher;
}

function getSubscriber(): Redis {
  if (!subscriber) {
    subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    subscriber.on('error', (err: Error) => logger.error({ err }, 'event_bus_sub_error'));
  }
  return subscriber;
}

export async function publishEvent(event: SalonEvent): Promise<void> {
  const channel = `${CHANNEL_PREFIX}${event.salonId}`;
  await getPublisher().publish(channel, JSON.stringify(event));

  // Fan out to outbound webhook subscriptions (fire-and-forget)
  import('../services/webhookDelivery.js')
    .then(({ fanOutWebhooks }) => fanOutWebhooks(event))
    .catch((err) => logger.warn({ err }, 'webhook_fanout_error'));
}

export type EventHandler = (event: SalonEvent) => void;

export async function subscribeSalon(salonId: string, handler: EventHandler): Promise<() => void> {
  const channel = `${CHANNEL_PREFIX}${salonId}`;
  const sub = getSubscriber();

  const listener = (ch: string, message: string) => {
    if (ch !== channel) return;
    try {
      const event = JSON.parse(message) as SalonEvent;
      handler(event);
    } catch (err) {
      logger.error({ err }, 'event_bus_parse_error');
    }
  };

  await sub.subscribe(channel);
  sub.on('message', listener);

  return () => {
    sub.off('message', listener);
    sub.unsubscribe(channel).catch(() => {});
  };
}

export function emitAppointmentCreated(salonId: string, appointmentId: string, summary: Record<string, unknown>) {
  return publishEvent({
    type: 'appointment.created',
    salonId,
    payload: { appointmentId, ...summary },
    timestamp: new Date().toISOString(),
  });
}

export function emitAppointmentUpdated(salonId: string, appointmentId: string, changes: Record<string, unknown>) {
  return publishEvent({
    type: 'appointment.updated',
    salonId,
    payload: { appointmentId, ...changes },
    timestamp: new Date().toISOString(),
  });
}

export function emitMessageReceived(salonId: string, customerId: string, body: string) {
  return publishEvent({
    type: 'message.received',
    salonId,
    payload: { customerId, body: body.slice(0, 100) },
    timestamp: new Date().toISOString(),
  });
}
