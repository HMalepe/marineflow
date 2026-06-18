import { AsyncLocalStorage } from 'node:async_hooks';
import type { InteractiveMessage } from './integrations/messaging/types.js';

export type PendingOutbound = {
  salonId: string;
  convId: string;
  customerId: string;
  waId: string;
  body: string;
  interactive?: InteractiveMessage;
};

export type PendingWelcomeJourney = {
  salonId: string;
  customerId: string;
  isFirstInteraction: boolean;
  waId: string;
};

type BotRequestStore = {
  pendingOutbound: PendingOutbound[];
  pendingWelcomeJourney: PendingWelcomeJourney | null;
};

const botRequestStore = new AsyncLocalStorage<BotRequestStore>();

/** Run one inbound WhatsApp handler with isolated outbound deferral state. */
export function runWithBotRequest<T>(fn: () => Promise<T>): Promise<T> {
  return botRequestStore.run(
    { pendingOutbound: [], pendingWelcomeJourney: null },
    fn,
  );
}

export function getBotRequestStore(): BotRequestStore | undefined {
  return botRequestStore.getStore();
}

export function queuePendingWelcomeJourney(job: PendingWelcomeJourney): void {
  const store = botRequestStore.getStore();
  if (!store) return;
  store.pendingWelcomeJourney = job;
}

export function takePendingWelcomeJourney(): PendingWelcomeJourney | null {
  const store = botRequestStore.getStore();
  if (!store?.pendingWelcomeJourney) return null;
  const job = store.pendingWelcomeJourney;
  store.pendingWelcomeJourney = null;
  return job;
}
