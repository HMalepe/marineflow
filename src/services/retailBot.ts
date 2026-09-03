/**
 * Dr Marley / dispensary WhatsApp order flow — cart, delivery/collection, confirm.
 * Products are Service rows (durationMin often 0). Orders persist as RetailOrder.
 */

import {
  ConversationStep,
  MessageDirection,
  RetailFulfillment,
  RetailOrderStatus,
  type Conversation,
  type Customer,
  type Salon,
  type Service,
  type ServiceCategory,
} from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';
import {
  formatZarFromCents,
  getRetailSettings,
  isDispensarySalon,
} from '../lib/retailSettings.js';
import { isProductSellable } from '../lib/inventory.js';
import { salonDisplayName, buildMainMenuText } from '../lib/hierarchicalMenu.js';
import type { InteractiveMessage } from '../lib/integrations/messaging/types.js';
import { sendWithFallback } from './channelRouter.js';
import {
  buildAgeGateInteractive,
  buildCategoryListInteractive,
  buildConfirmInteractive,
  buildFulfillmentInteractive,
  buildPostAddCartInteractive,
  buildProductListInteractive,
  buildQtyInteractive,
  buildUsualInteractive,
  RETAIL_LIST_PAGE_SIZE,
} from './retailInteractive.js';
import {
  assertCartInStock,
} from './retailInventory.js';
import { createRetailPaymentCheckoutSession } from './payments.js';
import {
  buildPaymentCheckoutCta,
  buildRetailPayfastPromptBody,
} from '../lib/paymentPromptCopy.js';

type Conv = Conversation & { customer: Customer; salon: Salon };

type CartLine = { serviceId: string; name: string; unitPriceCents: number; qty: number };

type RetailCartMenu = 'categories' | 'products' | 'qty' | 'post_add';

type RetailCtx = {
  retailAgeOk?: boolean;
  retailCart?: CartLine[];
  retailCategoryIds?: string[];
  retailProductIds?: string[];
  retailFulfillment?: 'DELIVERY' | 'COLLECTION';
  retailOrderId?: string;
  retailAwaitingQty?: boolean;
  retailPendingServiceId?: string;
  /** Waiting for Yes/No on "the usual" reorder. */
  retailUsualPending?: boolean;
  retailUsualCart?: CartLine[];
  retailPendingCheckoutUrl?: string;
  /** Which numbered menu the customer is on — never infer from empty product ids. */
  retailCartMenu?: RetailCartMenu;
  retailCategoryPage?: number;
  retailProductPage?: number;
  retailActiveCategoryId?: string;
  deliveryLine1?: string;
  deliverySuburb?: string;
  deliveryCity?: string;
  deliveryNotes?: string;
};

function persistableCtx(c: RetailCtx): object {
  return JSON.parse(JSON.stringify(c)) as object;
}

export function isKeepShoppingText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === '1' ||
    t === 'keep' ||
    t === 'shop' ||
    t.includes('keep shopping') ||
    t.includes('shop more') ||
    t.includes('add more')
  );
}

export function isCheckoutText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === '2' || t === 'checkout' || t === 'check out' || t === 'pay' || t.includes('checkout');
}

function isClearCartText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === '3' || t === 'clear' || t.includes('clear cart') || t === 'empty';
}

function ctx(conv: Conv): RetailCtx {
  const raw = conv.context;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as RetailCtx;
  }
  return {};
}

async function reply(conv: Conv, body: string, interactive?: InteractiveMessage | null): Promise<void> {
  await sendWithFallback({
    salonId: conv.salonId,
    to: conv.customer.waId,
    body,
    ...(interactive ? { interactive } : {}),
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

async function setStep(conv: Conv, step: ConversationStep, patch: RetailCtx): Promise<Conv> {
  const next = persistableCtx({ ...ctx(conv), ...patch });
  return getTenantDb().conversation.update({
    where: { id: conv.id },
    data: {
      step,
      context: next,
      lastMessageAt: new Date(),
    },
    include: { customer: true, salon: true },
  });
}

function cartSubtotal(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.unitPriceCents * line.qty, 0);
}

function formatCart(cart: CartLine[]): string {
  if (cart.length === 0) return '_Cart is empty_';
  return cart
    .map(
      (l, i) =>
        `${i + 1}. ${l.name} ×${l.qty} — ${formatZarFromCents(l.unitPriceCents * l.qty)}`,
    )
    .join('\n');
}

export function shouldUseRetailOrderFlow(salon: Pick<Salon, 'industryTemplate'>): boolean {
  return isDispensarySalon(salon.industryTemplate);
}

export async function startRetailOrderFlow(conv: Conv): Promise<Conv> {
  const settings = getRetailSettings(conv.salon.metadata);
  const c = ctx(conv);

  if (settings.ageGateEnabled && !c.retailAgeOk) {
    await reply(conv, settings.ageGateCopy, buildAgeGateInteractive(settings.ageGateCopy));
    return setStep(conv, ConversationStep.RETAIL_BROWSE, { retailAgeOk: false });
  }

  const usual = await buildUsualCart(conv);
  if (usual.length > 0) {
    const preview = usual
      .map((l) => `• ${l.name} ×${l.qty} — ${formatZarFromCents(l.unitPriceCents * l.qty)}`)
      .join('\n');
    const usualBody = [
        `✨ *Welcome back* — want the usual?`,
        '',
        preview,
        `Subtotal *${formatZarFromCents(cartSubtotal(usual))}*`,
        '',
        '1 — Yes, the usual',
        '2 — Browse the full menu',
        '',
        'Reply *HISTORY* anytime for past orders.',
      ].join('\n');
    await reply(conv, usualBody, buildUsualInteractive(usualBody));
    return setStep(conv, ConversationStep.RETAIL_BROWSE, {
      retailAgeOk: true,
      retailUsualPending: true,
      retailUsualCart: usual,
    });
  }

  return showProductCategories(conv);
}

async function buildUsualCart(conv: Conv): Promise<CartLine[]> {
  const last = await getTenantDb().retailOrder.findFirst({
    where: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      status: { notIn: [RetailOrderStatus.CANCELLED, RetailOrderStatus.DRAFT] },
    },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
  if (!last?.items.length) return [];

  const cart: CartLine[] = [];
  for (const item of last.items) {
    const svc = await getTenantDb().service.findFirst({
      where: { id: item.serviceId, salonId: conv.salonId, deletedAt: null },
    });
    if (!svc || !isProductSellable(svc, item.quantity)) continue;
    cart.push({
      serviceId: svc.id,
      name: svc.name,
      unitPriceCents: svc.priceCents,
      qty: item.quantity,
    });
  }
  return cart;
}

async function showProductCategories(conv: Conv): Promise<Conv> {
  const db = getTenantDb();
  const categories = await db.serviceCategory.findMany({
    where: {
      salonId: conv.salonId,
      services: {
        some: {
          active: true,
          deletedAt: null,
          OR: [{ trackInventory: false }, { stockQty: { gt: 0 } }],
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
    take: 40,
  });

  if (categories.length === 0) {
    await reply(
      conv,
      'Our menu is being stocked — please check back soon, or reply *SUPPORT* for help.',
    );
    return setStep(conv, ConversationStep.MENU, {});
  }

  const c = ctx(conv);
  const maxPage = Math.max(0, Math.ceil(categories.length / RETAIL_LIST_PAGE_SIZE) - 1);
  const page = Math.min(Math.max(c.retailCategoryPage ?? 0, 0), maxPage);
  const lines = categories.map((cat, i) => `${i + 1} — ${cat.name}`);
  const body = [
    `🛍️ *${salonDisplayName(conv.salon)} — Products*`,
    '',
    ...lines,
    '',
    '0 — View cart / checkout',
    '',
    'Tap *View options* to pick, or reply with a number. *BACK* for the main menu.',
  ].join('\n');

  await reply(
    conv,
    body,
    buildCategoryListInteractive({
      shopName: salonDisplayName(conv.salon),
      categories,
      page,
      hasCart: (c.retailCart ?? []).length > 0,
    }),
  );
  return setStep(conv, ConversationStep.RETAIL_BROWSE, {
    retailCategoryIds: categories.map((cat) => cat.id),
    retailAgeOk: true,
    retailUsualPending: false,
    retailAwaitingQty: false,
    retailPendingServiceId: undefined,
    retailProductIds: [],
    retailCartMenu: 'categories',
    retailCategoryPage: page,
  });
}

async function showProductsInCategory(conv: Conv, category: ServiceCategory): Promise<Conv> {
  const all = await getTenantDb().service.findMany({
    where: {
      salonId: conv.salonId,
      categoryId: category.id,
      active: true,
      deletedAt: null,
    },
    orderBy: { sortOrder: 'asc' },
    take: 30,
  });
  const products = all.filter((p) => isProductSellable(p, 1)).slice(0, 20);

  if (products.length === 0) {
    await reply(conv, 'Nothing in stock in that category right now. Pick another.');
    return showProductCategories(conv);
  }

  const lines = products.map((p, i) => {
    const stockHint =
      p.trackInventory && p.stockQty <= p.lowStockThreshold
        ? ` · _${p.stockQty} left_`
        : '';
    return (
      `${i + 1} — *${p.name}* · ${formatZarFromCents(p.priceCents)}${stockHint}` +
      (p.description
        ? `\n   _${p.description.slice(0, 80)}${p.description.length > 80 ? '…' : ''}_`
        : '')
    );
  });
  const page = ctx(conv).retailProductPage ?? 0;
  const body = [
    `🌿 *${category.name}*`,
    '',
    ...lines,
    '',
    '0 — Back to categories',
    'Tap *View options* to add, or reply with a number.',
  ].join('\n');

  await reply(
    conv,
    body,
    buildProductListInteractive({
      categoryName: category.name,
      products: products.map((p) => ({
        name: p.name,
        priceLabel: formatZarFromCents(p.priceCents),
      })),
      page,
    }),
  );
  return setStep(conv, ConversationStep.RETAIL_CART, {
    retailProductIds: products.map((p) => p.id),
    retailAgeOk: true,
    retailUsualPending: false,
    retailAwaitingQty: false,
    retailPendingServiceId: undefined,
    retailCartMenu: 'products',
    retailActiveCategoryId: category.id,
    retailProductPage: page,
  });
}

function postAddMenuText(cart: CartLine[]): string {
  return [
    '*Your cart*',
    formatCart(cart),
    `Subtotal: *${formatZarFromCents(cartSubtotal(cart))}*`,
    '',
    '1 — Keep shopping',
    '2 — Checkout',
    '3 — Clear cart',
  ].join('\n');
}

async function showPostAddCart(conv: Conv, cart: CartLine[], prefix?: string): Promise<Conv> {
  const body = [prefix, postAddMenuText(cart)].filter(Boolean).join('\n');
  await reply(conv, body, buildPostAddCartInteractive(body));
  return setStep(conv, ConversationStep.RETAIL_CART, {
    retailCart: cart,
    retailAwaitingQty: false,
    retailPendingServiceId: undefined,
    retailProductIds: [],
    retailUsualPending: false,
    retailCartMenu: 'post_add',
    retailAgeOk: true,
  });
}

function parseQty(text: string): number | null {
  const n = Number.parseInt(text.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 20) return null;
  return n;
}

async function addToCart(conv: Conv, product: Service, qty: number): Promise<Conv> {
  if (!isProductSellable(product, qty)) {
    await reply(
      conv,
      product.trackInventory
        ? `Sorry — *${product.name}* only has ${product.stockQty} left in stock.`
        : `Sorry — *${product.name}* isn’t available right now.`,
    );
    return conv;
  }

  const c = ctx(conv);
  const cart = [...(c.retailCart ?? [])];
  const existing = cart.find((l) => l.serviceId === product.id);
  const nextQty = existing ? existing.qty + qty : qty;
  if (!isProductSellable(product, nextQty)) {
    await reply(
      conv,
      `You already have some in the cart — only ${product.stockQty} total available for *${product.name}*.`,
    );
    return conv;
  }
  if (existing) {
    existing.qty = Math.min(20, nextQty);
  } else {
    cart.push({
      serviceId: product.id,
      name: product.name,
      unitPriceCents: product.priceCents,
      qty,
    });
  }

  return showPostAddCart(conv, cart, `✅ Added *${product.name}* ×${qty}`);
}

async function beginCheckout(conv: Conv): Promise<Conv> {
  const settings = getRetailSettings(conv.salon.metadata);
  const c = ctx(conv);
  const cart = c.retailCart ?? [];
  if (cart.length === 0) {
    await reply(conv, 'Your cart is empty — pick a product first.');
    return showProductCategories(conv);
  }

  const stock = await assertCartInStock(conv.salonId, cart);
  if (!stock.ok) {
    await reply(conv, stock.message);
    return setStep(conv, ConversationStep.RETAIL_CART, { retailCart: cart });
  }

  const subtotal = cartSubtotal(cart);
  if (subtotal < settings.minOrderCents) {
    await reply(
      conv,
      `Minimum order is ${formatZarFromCents(settings.minOrderCents)} (you’re at ${formatZarFromCents(subtotal)}). Add a little more, then checkout.`,
    );
    return showProductCategories(conv);
  }

  const options: string[] = [];
  if (settings.deliveryEnabled) options.push('1 — 🚚 Delivery');
  if (settings.collectionEnabled) options.push(`${options.length + 1} — 🏪 Collection`);

  const fulfillBody = [
      '*How would you like to receive your order?*',
      '',
      formatCart(cart),
      `Subtotal: *${formatZarFromCents(subtotal)}*`,
      '',
      ...options,
      '',
      settings.deliveryAreaNote,
    ].join('\n');
  await reply(
    conv,
    fulfillBody,
    buildFulfillmentInteractive(fulfillBody, settings.deliveryEnabled, settings.collectionEnabled),
  );

  return setStep(conv, ConversationStep.RETAIL_FULFILLMENT, { retailCart: cart });
}

async function askDeliveryAddress(conv: Conv): Promise<Conv> {
  await reply(
    conv,
    [
      '📍 *Delivery address*',
      '',
      'Please send your address in one message, e.g.:',
      '_12 Main Rd, Sandton, Johannesburg_',
      '',
      'You can add a gate code or landmark on the next line.',
    ].join('\n'),
  );
  return setStep(conv, ConversationStep.RETAIL_ADDRESS, {
    retailFulfillment: 'DELIVERY',
  });
}

async function showOrderSummary(conv: Conv): Promise<Conv> {
  const settings = getRetailSettings(conv.salon.metadata);
  const c = ctx(conv);
  const cart = c.retailCart ?? [];
  const subtotal = cartSubtotal(cart);
  const fulfillment = c.retailFulfillment ?? 'DELIVERY';
  const deliveryFee =
    fulfillment === 'DELIVERY' ? settings.deliveryFeeCents : 0;
  const total = subtotal + deliveryFee;

  const eta =
    fulfillment === 'DELIVERY'
      ? `~${settings.deliveryEtaMinutes} min after payment`
      : `Ready in ~${settings.collectionEtaMinutes} min after payment`;

  const addressBlock =
    fulfillment === 'DELIVERY'
      ? `📍 ${[c as RetailCtx & { deliveryLine1?: string }].map(() => (conv.context as Record<string, unknown>).deliveryLine1 ?? 'Address on file').join('')}`
      : '🏪 Collection at store';

  // Read address from context more cleanly
  const raw = conv.context as Record<string, unknown>;
  const addr =
    fulfillment === 'DELIVERY'
      ? [raw.deliveryLine1, raw.deliverySuburb, raw.deliveryCity]
          .filter((x) => typeof x === 'string' && x.trim())
          .join(', ')
      : null;

  const summaryBody = [
      '🧾 *Order summary*',
      '',
      formatCart(cart),
      '',
      fulfillment === 'DELIVERY' ? `Delivery: ${formatZarFromCents(deliveryFee)}` : 'Collection: free',
      addr ? `📍 ${addr}` : addressBlock,
      `ETA: ${eta}`,
      `*Total: ${formatZarFromCents(total)}*`,
      '',
      '1 — Confirm order',
      '2 — Edit cart',
      '3 — Cancel order',
    ].join('\n');
  await reply(conv, summaryBody, buildConfirmInteractive(summaryBody));

  return setStep(conv, ConversationStep.RETAIL_CONFIRM, {
    retailCart: cart,
    retailFulfillment: fulfillment,
  });
}

async function placeOrder(conv: Conv): Promise<Conv> {
  const settings = getRetailSettings(conv.salon.metadata);
  const c = ctx(conv);
  const cart = c.retailCart ?? [];
  const fulfillment =
    c.retailFulfillment === 'COLLECTION'
      ? RetailFulfillment.COLLECTION
      : RetailFulfillment.DELIVERY;
  const subtotal = cartSubtotal(cart);
  const deliveryFee =
    fulfillment === RetailFulfillment.DELIVERY ? settings.deliveryFeeCents : 0;
  const total = subtotal + deliveryFee;
  const raw = conv.context as Record<string, unknown>;

  const stock = await assertCartInStock(conv.salonId, cart);
  if (!stock.ok) {
    await reply(conv, stock.message);
    return setStep(conv, ConversationStep.RETAIL_CART, { retailCart: cart });
  }

  const db = getTenantDb();
  const order = await db.retailOrder.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      status: RetailOrderStatus.PENDING_PAYMENT,
      fulfillment,
      deliveryLine1: typeof raw.deliveryLine1 === 'string' ? raw.deliveryLine1 : null,
      deliverySuburb: typeof raw.deliverySuburb === 'string' ? raw.deliverySuburb : null,
      deliveryCity: typeof raw.deliveryCity === 'string' ? raw.deliveryCity : null,
      deliveryNotes: typeof raw.deliveryNotes === 'string' ? raw.deliveryNotes : null,
      subtotalCents: subtotal,
      deliveryFeeCents: deliveryFee,
      totalCents: total,
      currency: 'zar',
      items: {
        create: cart.map((line) => ({
          salonId: conv.salonId,
          serviceId: line.serviceId,
          nameSnapshot: line.name,
          unitPriceCents: line.unitPriceCents,
          quantity: line.qty,
          lineTotalCents: line.unitPriceCents * line.qty,
        })),
      },
    },
    include: {
      items: true,
      customer: {
        select: {
          waId: true,
          displayName: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const orderRef = `#${order.id.slice(-6).toUpperCase()}`;
  const checkoutUrl = await createRetailPaymentCheckoutSession({
    salonId: conv.salonId,
    customerId: conv.customerId,
    orderId: order.id,
    amountCents: total,
    description: `${conv.salon.tradingName?.trim() || conv.salon.name} ${orderRef}`,
  });

  if (!checkoutUrl) {
    await db.retailOrder.update({
      where: { id: order.id },
      data: { status: RetailOrderStatus.CANCELLED, cancelledAt: new Date() },
    });
    await reply(
      conv,
      'We couldn’t start PayFast checkout just now. Reply *1* on the summary to try again, or *MENU* to start over.',
    );
    return setStep(conv, ConversationStep.RETAIL_CONFIRM, {
      retailCart: cart,
      retailFulfillment: fulfillment,
    });
  }

  const payBody = buildRetailPayfastPromptBody({
    amountCents: total,
    orderRef,
    fulfillment: fulfillment === RetailFulfillment.COLLECTION ? 'COLLECTION' : 'DELIVERY',
  });
  await reply(conv, payBody, buildPaymentCheckoutCta(payBody, checkoutUrl));

  return setStep(conv, ConversationStep.MENU, {
    retailCart: [],
    retailOrderId: order.id,
    retailAgeOk: true,
    retailPendingCheckoutUrl: checkoutUrl,
  });
}

export async function listRetailOrders(conv: Conv): Promise<Conv> {
  const orders = await getTenantDb().retailOrder.findMany({
    where: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      status: { not: RetailOrderStatus.CANCELLED },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { items: true },
  });

  if (orders.length === 0) {
    await reply(conv, 'No orders yet — reply *1* from the main menu to start one.');
    return setStep(conv, ConversationStep.MENU, ctx(conv));
  }

  const lines = orders.map((o, i) => {
    const items = o.items.map((it) => `${it.nameSnapshot}×${it.quantity}`).join(', ');
    const when = new Date(o.createdAt).toLocaleString('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return `${i + 1}. #${o.id.slice(-6).toUpperCase()} · ${o.status.replace(/_/g, ' ')}\n   ${when} · ${formatZarFromCents(o.totalCents)}\n   ${items}`;
  });

  await reply(
    conv,
    [
      '📦 *Your order history*',
      '',
      ...lines,
      '',
      'Reply *USUAL* to reorder your last available basket.',
      'Reply *1* from the main menu to browse again.',
      'Reply *MENU* to go back.',
    ].join('\n'),
  );
  return setStep(conv, ConversationStep.MENU, ctx(conv));
}

/** Route inbound text while on a RETAIL_* step. Returns updated conversation. */
export async function handleRetailStep(conv: Conv, text: string): Promise<Conv> {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const c = ctx(conv);
  const settings = getRetailSettings(conv.salon.metadata);

  if (lower === 'back' || lower === 'menu') {
    return handleRetailBack(conv);
  }

  if (lower === 'usual' || lower === 'the usual' || lower === 'history') {
    if (lower === 'history') {
      return listRetailOrders(conv);
    }
    return startRetailOrderFlow(
      await setStep(conv, ConversationStep.RETAIL_BROWSE, { ...c, retailAgeOk: true }),
    );
  }

  // Age gate
  if (conv.step === ConversationStep.RETAIL_BROWSE && c.retailAgeOk === false) {
    if (lower === 'yes' || lower === 'y' || trimmed === '1') {
      return showProductCategories(
        await setStep(conv, ConversationStep.RETAIL_BROWSE, { retailAgeOk: true }),
      );
    }
    if (lower === 'no' || lower === 'n' || trimmed === '2') {
      await reply(conv, 'No problem — come back when you’re 18+. Reply *SWITCH* for other businesses.');
      return setStep(conv, ConversationStep.CLOSED, {});
    }
    await reply(conv, settings.ageGateCopy, buildAgeGateInteractive(settings.ageGateCopy));
    return conv;
  }

  // "Want the usual?"
  if (conv.step === ConversationStep.RETAIL_BROWSE && c.retailUsualPending) {
    if (trimmed === '1' || lower === 'yes' || lower.includes('usual')) {
      const usual = c.retailUsualCart ?? [];
      if (usual.length === 0) {
        return showProductCategories(
          await setStep(conv, ConversationStep.RETAIL_BROWSE, {
            retailUsualPending: false,
            retailAgeOk: true,
          }),
        );
      }
      return showPostAddCart(conv, usual);
    }
    if (trimmed === '2' || lower.includes('browse') || lower === 'no') {
      return showProductCategories(
        await setStep(conv, ConversationStep.RETAIL_BROWSE, {
          retailUsualPending: false,
          retailAgeOk: true,
        }),
      );
    }
    await reply(
      conv,
      'Reply *1* for the usual, or *2* to browse the menu.',
      buildUsualInteractive('Reply *1* for the usual, or *2* to browse the menu.'),
    );
    return conv;
  }

  if (conv.step === ConversationStep.RETAIL_BROWSE) {
    if (lower === 'more') {
      return showProductCategories(
        await setStep(conv, ConversationStep.RETAIL_BROWSE, {
          retailCategoryPage: (c.retailCategoryPage ?? 0) + 1,
        }),
      );
    }
    if (lower === 'prev') {
      return showProductCategories(
        await setStep(conv, ConversationStep.RETAIL_BROWSE, {
          retailCategoryPage: Math.max(0, (c.retailCategoryPage ?? 0) - 1),
        }),
      );
    }
    if (trimmed === '0') {
      const cart = c.retailCart ?? [];
      if (cart.length === 0) {
        await reply(conv, 'Cart is empty — pick a category first.');
        return conv;
      }
      return showPostAddCart(conv, cart);
    }
    const idx = Number.parseInt(trimmed, 10) - 1;
    const catId = c.retailCategoryIds?.[idx];
    if (!catId) {
      await reply(conv, 'Reply with a category number from the list.');
      return conv;
    }
    const category = await getTenantDb().serviceCategory.findFirst({
      where: { id: catId, salonId: conv.salonId },
    });
    if (!category) return showProductCategories(conv);
    return showProductsInCategory(
      await setStep(conv, ConversationStep.RETAIL_CART, { retailProductPage: 0, retailActiveCategoryId: category.id }),
      category,
    );
  }

  if (conv.step === ConversationStep.RETAIL_CART) {
    const cartMenu: RetailCartMenu =
      c.retailCartMenu ??
      (c.retailAwaitingQty
        ? 'qty'
        : c.retailProductIds && c.retailProductIds.length > 0
          ? 'products'
          : 'post_add');

    if (cartMenu === 'qty' || (c.retailAwaitingQty && c.retailPendingServiceId)) {
      if (trimmed === '0' || lower === 'back') {
        const catId = c.retailCategoryIds?.[0];
        if (catId) {
          const category = await getTenantDb().serviceCategory.findFirst({
            where: { id: catId, salonId: conv.salonId },
          });
          if (category) return showProductsInCategory(conv, category);
        }
        return showProductCategories(conv);
      }
      const qty = parseQty(trimmed);
      if (!qty) {
        await reply(conv, 'How many? Reply with a number from 1–20, or *0* to cancel.');
        return conv;
      }
      const product = await getTenantDb().service.findFirst({
        where: { id: c.retailPendingServiceId, salonId: conv.salonId, active: true },
      });
      if (!product) {
        await reply(conv, 'That product is no longer available. Pick another category.');
        return showProductCategories(conv);
      }
      return addToCart(conv, product, qty);
    }

    if (cartMenu === 'post_add') {
      if (isKeepShoppingText(trimmed)) return showProductCategories(conv);
      if (isCheckoutText(trimmed)) return beginCheckout(conv);
      if (isClearCartText(trimmed)) {
        await reply(conv, 'Cart cleared. Pick a category to start again.');
        return showProductCategories(
          await setStep(conv, ConversationStep.RETAIL_BROWSE, {
            retailCart: [],
            retailCartMenu: 'categories',
          }),
        );
      }
      await reply(
        conv,
        'Reply *1* to keep shopping, *2* to checkout, or *3* to clear the cart.',
        buildPostAddCartInteractive('Reply *1* to keep shopping, *2* to checkout, or *3* to clear the cart.'),
      );
      return conv;
    }

    if (lower === 'more' || lower === 'prev') {
      const catId = c.retailActiveCategoryId;
      if (catId) {
        const category = await getTenantDb().serviceCategory.findFirst({
          where: { id: catId, salonId: conv.salonId },
        });
        if (category) {
          const nextPage =
            lower === 'more'
              ? (c.retailProductPage ?? 0) + 1
              : Math.max(0, (c.retailProductPage ?? 0) - 1);
          return showProductsInCategory(
            await setStep(conv, ConversationStep.RETAIL_CART, { retailProductPage: nextPage }),
            category,
          );
        }
      }
      return showProductCategories(conv);
    }

    if (trimmed === '0' || lower === 'back') return showProductCategories(conv);

    const pIdx = Number.parseInt(trimmed, 10) - 1;
    const productId = c.retailProductIds?.[pIdx];
    if (productId) {
      const product = await getTenantDb().service.findFirst({
        where: { id: productId, salonId: conv.salonId, active: true },
      });
      if (!product) {
        await reply(conv, 'That product is no longer available. Pick another.');
        return showProductCategories(conv);
      }
      const qtyBody = `How many *${product.name}*? (1–20)\n\nReply *0* to go back.`;
      await reply(conv, qtyBody, buildQtyInteractive(product.name));
      return setStep(conv, ConversationStep.RETAIL_CART, {
        retailAwaitingQty: true,
        retailPendingServiceId: product.id,
        retailCartMenu: 'qty',
      });
    }

    await reply(conv, 'Reply with a product number from the list, or *0* to go back to categories.');
    return conv;
  }

  if (conv.step === ConversationStep.RETAIL_FULFILLMENT) {
    const wantsDelivery =
      trimmed === '1' || lower.includes('deliver');
    const wantsCollection =
      (settings.deliveryEnabled ? trimmed === '2' : trimmed === '1') ||
      lower.includes('collect') ||
      lower.includes('pickup') ||
      lower.includes('pick up');

    if (wantsDelivery && settings.deliveryEnabled) {
      return askDeliveryAddress(
        await setStep(conv, ConversationStep.RETAIL_FULFILLMENT, {
          retailFulfillment: 'DELIVERY',
        }),
      );
    }
    if (wantsCollection && settings.collectionEnabled) {
      const updated = await setStep(conv, ConversationStep.RETAIL_CONFIRM, {
        retailFulfillment: 'COLLECTION',
      });
      return showOrderSummary(updated);
    }
    await reply(
      conv,
      'Reply *1* for delivery or *2* for collection.',
      buildFulfillmentInteractive(
        'Reply *1* for delivery or *2* for collection.',
        settings.deliveryEnabled,
        settings.collectionEnabled,
      ),
    );
    return conv;
  }

  if (conv.step === ConversationStep.RETAIL_ADDRESS) {
    if (trimmed.length < 8) {
      await reply(conv, 'Please send a fuller street address (at least suburb + city).');
      return conv;
    }
    const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
    const updated = await getTenantDb().conversation.update({
      where: { id: conv.id },
      data: {
        step: ConversationStep.RETAIL_CONFIRM,
        context: {
          ...c,
          retailFulfillment: 'DELIVERY',
          deliveryLine1: parts[0] ?? trimmed,
          deliverySuburb: parts[1] ?? undefined,
          deliveryCity: parts[2] ?? parts[1] ?? undefined,
        },
        lastMessageAt: new Date(),
      },
      include: { customer: true, salon: true },
    });
    return showOrderSummary(updated);
  }

  if (conv.step === ConversationStep.RETAIL_CONFIRM) {
    if (trimmed === '1' || lower === 'confirm' || lower === 'pay') {
      return placeOrder(conv);
    }
    if (trimmed === '2' || lower.includes('edit') || isKeepShoppingText(trimmed)) {
      const cart = c.retailCart ?? [];
      if (cart.length) return showPostAddCart(conv, cart);
      return showProductCategories(conv);
    }
    if (trimmed === '3' || lower.includes('cancel')) {
      await reply(conv, 'Order cancelled. Reply *MENU* anytime.');
      return setStep(conv, ConversationStep.MENU, { retailCart: [], retailAgeOk: true });
    }
    await reply(
      conv,
      'Reply *1* to confirm, *2* to keep shopping, or *3* to cancel.',
      buildConfirmInteractive('Reply *1* to confirm, *2* to keep shopping, or *3* to cancel.'),
    );
    return conv;
  }

  await reply(
    conv,
    [
      "I didn't catch that. Here's how to continue:",
      '',
      '1 — Keep shopping / browse',
      '2 — Checkout (if you have a cart)',
      '*MENU* — main menu',
      '*SWITCH* — other business',
    ].join('\n'),
  );
  return conv;
}

/** BACK from a retail step — always sends a screen (never silent). */
export async function handleRetailBack(conv: Conv): Promise<Conv> {
  const c = ctx(conv);
  const cart = c.retailCart ?? [];

  if (conv.step === ConversationStep.RETAIL_CONFIRM) {
    return beginCheckout(conv);
  }
  if (conv.step === ConversationStep.RETAIL_ADDRESS) {
    return beginCheckout(conv);
  }
  if (conv.step === ConversationStep.RETAIL_FULFILLMENT) {
    if (cart.length) return showPostAddCart(conv, cart);
    return showProductCategories(conv);
  }
  if (conv.step === ConversationStep.RETAIL_CART) {
    if (c.retailCartMenu === 'qty' || c.retailAwaitingQty) {
      return showProductCategories(conv);
    }
    if (c.retailCartMenu === 'products' || (c.retailProductIds && c.retailProductIds.length > 0)) {
      return showProductCategories(conv);
    }
    await reply(conv, buildMainMenuText(conv.salon));
    return setStep(conv, ConversationStep.MENU, { ...c, retailAgeOk: true });
  }
  await reply(conv, buildMainMenuText(conv.salon));
  return setStep(conv, ConversationStep.MENU, { ...c, retailAgeOk: true });
}

/** Soft free-text product match for dispensary (adds first match to cart flow). */
export async function tryRetailProductQuickAdd(
  conv: Conv,
  text: string,
): Promise<{ handled: boolean; conv: Conv }> {
  if (!shouldUseRetailOrderFlow(conv.salon)) return { handled: false, conv };

  const tokens = text.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return { handled: false, conv };

  const products = await getTenantDb().service.findMany({
    where: { salonId: conv.salonId, active: true, deletedAt: null },
    take: 40,
  });

  const match = products.find((p) => {
    const name = p.name.toLowerCase();
    return tokens.some((t) => name.includes(t));
  });
  if (!match) return { handled: false, conv };

  const settings = getRetailSettings(conv.salon.metadata);
  let next = conv;
  const c = ctx(conv);
  if (settings.ageGateEnabled && !c.retailAgeOk) {
    next = await startRetailOrderFlow(conv);
    return { handled: true, conv: next };
  }

  next = await addToCart(
    await setStep(conv, ConversationStep.RETAIL_CART, { retailAgeOk: true }),
    match,
    1,
  );
  return { handled: true, conv: next };
}
