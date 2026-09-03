/**
 * WhatsApp business-picker gateway for shared numbers (Bontle + Dr Marley).
 * Runs in the router salon’s tenant context only — never mixes RLS with operating salons.
 */

import {
  ConversationStep,
  MessageDirection,
  type Conversation,
  type Customer,
  type Salon,
} from '@prisma/client';
import { getTenantDb, withTenantContext } from '../lib/db/tenantSession.js';
import {
  buildBusinessPickerText,
  getLinkedBusinesses,
  isBusinessRouterSalon,
  isRouterChoiceFresh,
  isSwitchBusinessCommand,
  parseBusinessPickerChoice,
  readRouterChoice,
  type LinkedBusinessOption,
} from '../lib/businessRouter.js';
import { findSalonById, type ResolvedTenant } from '../lib/tenant.js';
import { logger } from '../lib/logger.js';
import { sendWithFallback } from './channelRouter.js';

type RouterConv = Conversation & { customer: Customer; salon: Salon };

async function sendRouterWhatsApp(salonId: string, waId: string, body: string): Promise<void> {
  try {
    await sendWithFallback({ salonId, to: waId, body });
  } catch (err) {
    logger.error({ err, salonId, waId }, 'business_router_send_failed');
  }
}

async function loadOrCreateRouterConversation(
  salon: Salon,
  waId: string,
): Promise<RouterConv> {
  const db = getTenantDb();
  let customer = await db.customer.findUnique({
    where: { salonId_waId: { salonId: salon.id, waId } },
  });
  if (!customer) {
    customer = await db.customer.create({
      data: {
        salonId: salon.id,
        waId,
        source: 'whatsapp',
        displayName: 'Guest',
      },
    });
  }

  let conv = await db.conversation.findUnique({
    where: { salonId_customerId: { salonId: salon.id, customerId: customer.id } },
    include: { customer: true, salon: true },
  });
  if (!conv) {
    conv = await db.conversation.create({
      data: {
        salonId: salon.id,
        customerId: customer.id,
        step: ConversationStep.CHOOSE_BUSINESS,
        context: {},
      },
      include: { customer: true, salon: true },
    });
  }
  return conv;
}

async function persistRouterChoice(
  convId: string,
  option: LinkedBusinessOption,
): Promise<void> {
  const db = getTenantDb();
  await db.conversation.update({
    where: { id: convId },
    data: {
      step: ConversationStep.CHOOSE_BUSINESS,
      context: {
        chosenSalonId: option.salonId,
        chosenAt: new Date().toISOString(),
        chosenLabel: option.label,
      },
      lastMessageAt: new Date(),
      lastCustomerMessageAt: new Date(),
    },
  });
}

async function clearRouterChoice(convId: string): Promise<void> {
  const db = getTenantDb();
  await db.conversation.update({
    where: { id: convId },
    data: {
      step: ConversationStep.CHOOSE_BUSINESS,
      context: {},
      lastMessageAt: new Date(),
      lastCustomerMessageAt: new Date(),
    },
  });
}

async function showPicker(conv: RouterConv, waId: string, options: LinkedBusinessOption[]) {
  const body = buildBusinessPickerText(options);
  await sendRouterWhatsApp(conv.salonId, waId, body);
  await getTenantDb().conversation.update({
    where: { id: conv.id },
    data: {
      step: ConversationStep.CHOOSE_BUSINESS,
      lastMessageAt: new Date(),
    },
  });
  await getTenantDb().message.create({
    data: {
      conversationId: conv.id,
      customerId: conv.customerId,
      direction: MessageDirection.OUTBOUND,
      body,
    },
  });
}

/**
 * If inbound resolved to a business-router salon, either:
 * - return the already-chosen operating tenant, or
 * - run the picker and return handled=true (message fully handled).
 */
export async function resolveOperatingTenantViaRouter(input: {
  routerTenant: ResolvedTenant;
  waId: string;
  text: string;
}): Promise<
  | { handled: true }
  | { handled: false; tenant: ResolvedTenant; textOverride?: string }
> {
  const fullRouter = await withTenantContext(input.routerTenant.id, async () => {
    return getTenantDb().salon.findUniqueOrThrow({ where: { id: input.routerTenant.id } });
  });

  if (!isBusinessRouterSalon(fullRouter)) {
    return { handled: false, tenant: input.routerTenant };
  }

  const options = getLinkedBusinesses(fullRouter);
  if (options.length === 0) {
    logger.error({ salonId: fullRouter.id }, 'business_router_has_no_linked_businesses');
    await sendRouterWhatsApp(
      fullRouter.id,
      input.waId,
      'This WhatsApp line is not linked to any businesses yet. Please try again later.',
    );
    return { handled: true };
  }

  return withTenantContext(fullRouter.id, async () => {
    const conv = await loadOrCreateRouterConversation(fullRouter, input.waId);
    const choice = readRouterChoice(conv.context);

    if (isSwitchBusinessCommand(input.text)) {
      await clearRouterChoice(conv.id);
      await showPicker(conv, input.waId, options);
      return { handled: true as const };
    }

    if (choice.chosenSalonId && isRouterChoiceFresh(choice.chosenAt)) {
      const operating = await findSalonById(choice.chosenSalonId);
      if (operating) {
        await getTenantDb().conversation.update({
          where: { id: conv.id },
          data: {
            context: {
              ...choice,
              chosenAt: new Date().toISOString(),
            },
            lastMessageAt: new Date(),
            lastCustomerMessageAt: new Date(),
          },
        });
        return { handled: false as const, tenant: operating };
      }
    }

    const picked = parseBusinessPickerChoice(input.text, options);
    if (picked) {
      await persistRouterChoice(conv.id, picked);
      await getTenantDb().message.create({
        data: {
          conversationId: conv.id,
          customerId: conv.customerId,
          direction: MessageDirection.INBOUND,
          body: input.text,
        },
      });
      const handoff =
        `✨ *${picked.label}*\n\n` +
        (picked.subtitle ? `${picked.subtitle}\n\n` : '') +
        'Opening that menu for you…';
      await sendRouterWhatsApp(fullRouter.id, input.waId, handoff);

      const operating = await findSalonById(picked.salonId);
      if (!operating) {
        await sendRouterWhatsApp(
          fullRouter.id,
          input.waId,
          'Sorry — that business is unavailable right now. Reply with another number.',
        );
        await clearRouterChoice(conv.id);
        await showPicker(conv, input.waId, options);
        return { handled: true as const };
      }
      // Don't forward "1"/"2" into the operating menu — open with a wake word.
      return { handled: false as const, tenant: operating, textOverride: 'hi' };
    }

    await getTenantDb().message.create({
      data: {
        conversationId: conv.id,
        customerId: conv.customerId,
        direction: MessageDirection.INBOUND,
        body: input.text || '(empty)',
      },
    });
    await showPicker(conv, input.waId, options);
    return { handled: true as const };
  });
}
