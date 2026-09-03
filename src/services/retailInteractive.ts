import { truncateListField } from '../lib/integrations/messaging/interactiveList.js';
import type { InteractiveButtons, InteractiveList, InteractiveMessage } from '../lib/integrations/messaging/types.js';
import { pickerDisplayLabel, type LinkedBusinessOption } from '../lib/businessRouter.js';

const MAX_LIST_ROWS = 10;
export const RETAIL_LIST_PAGE_SIZE = 7;

export function buildBusinessPickerInteractive(
  options: LinkedBusinessOption[],
): InteractiveMessage | null {
  if (options.length === 0) return null;
  const body =
    '*Welcome — which business can we help you with?*\n\nTap an option below. Reply *SWITCH* anytime to change businesses.';
  const rows = options.map((opt, i) => ({
    id: String(i + 1),
    title: pickerDisplayLabel(opt),
    description: opt.subtitle,
  }));
  if (rows.length <= 3) {
    return {
      type: 'button',
      body,
      buttons: rows.map((r) => ({ id: r.id, title: truncateListField(r.title, 20) })),
    };
  }
  return numberedList(body, 'View options', 'Businesses', rows);
}

function numberedList(
  body: string,
  buttonLabel: string,
  sectionTitle: string,
  items: Array<{ id: string; title: string; description?: string }>,
): InteractiveList | null {
  if (items.length === 0) return null;
  const rows = items.slice(0, MAX_LIST_ROWS).map((item) => ({
    id: item.id,
    title: truncateListField(item.title, 24),
    description: item.description ? truncateListField(item.description, 72) : undefined,
  }));
  return {
    type: 'list',
    body: truncateListField(body, 1024),
    button: truncateListField(buttonLabel, 20),
    sections: [{ title: truncateListField(sectionTitle, 24), rows }],
  };
}

function buttons(
  body: string,
  items: Array<{ id: string; title: string }>,
): InteractiveButtons {
  return {
    type: 'button',
    body: truncateListField(body, 1024),
    buttons: items.slice(0, 3).map((b) => ({
      id: b.id,
      title: truncateListField(b.title, 20),
    })),
  };
}

export function buildAgeGateInteractive(copy: string): InteractiveMessage {
  return buttons(copy, [
    { id: 'yes', title: 'Yes, I am 18+' },
    { id: 'no', title: 'No / exit' },
  ]);
}

export function buildUsualInteractive(body: string): InteractiveMessage {
  return buttons(body, [
    { id: '1', title: 'The usual' },
    { id: '2', title: 'Browse menu' },
  ]);
}

export function buildCategoryListInteractive(input: {
  shopName: string;
  categories: Array<{ name: string }>;
  page: number;
  hasCart: boolean;
}): InteractiveMessage | null {
  const { shopName, categories, page, hasCart } = input;
  const start = page * RETAIL_LIST_PAGE_SIZE;
  const slice = categories.slice(start, start + RETAIL_LIST_PAGE_SIZE);
  const hasMore = start + RETAIL_LIST_PAGE_SIZE < categories.length;
  const items: Array<{ id: string; title: string; description?: string }> = slice.map((cat, i) => ({
    id: String(start + i + 1),
    title: cat.name,
  }));
  if (page > 0) items.push({ id: 'prev', title: 'Previous page' });
  if (hasMore) items.push({ id: 'more', title: 'More categories' });
  if (hasCart) items.push({ id: '0', title: 'View cart' });
  const body = `🛍️ *${shopName} — Products*\nTap *View options* to pick a category.`;
  return numberedList(body, 'View options', 'Categories', items.slice(0, MAX_LIST_ROWS));
}

export function buildProductListInteractive(input: {
  categoryName: string;
  products: Array<{ name: string; priceLabel: string }>;
  page: number;
}): InteractiveMessage | null {
  const start = input.page * RETAIL_LIST_PAGE_SIZE;
  const slice = input.products.slice(start, start + RETAIL_LIST_PAGE_SIZE);
  const hasMore = start + RETAIL_LIST_PAGE_SIZE < input.products.length;
  const items: Array<{ id: string; title: string; description?: string }> = slice.map((p, i) => ({
    id: String(start + i + 1),
    title: p.name,
    description: p.priceLabel,
  }));
  if (input.page > 0) items.push({ id: 'prev', title: 'Previous page' });
  if (hasMore) items.push({ id: 'more', title: 'More products' });
  items.push({ id: '0', title: 'Back to categories' });
  const body = `🌿 *${input.categoryName}*\nTap *View options* to add to your cart.`;
  return numberedList(body, 'View options', input.categoryName, items.slice(0, MAX_LIST_ROWS));
}

export function buildPostAddCartInteractive(body: string): InteractiveMessage {
  return buttons(body, [
    { id: '1', title: 'Keep shopping' },
    { id: '2', title: 'Checkout' },
    { id: '3', title: 'Clear cart' },
  ]);
}

export function buildQtyInteractive(productName: string): InteractiveMessage {
  return buttons(`How many *${productName}*? (1–20)\nTap a shortcut or type a number.`, [
    { id: '1', title: '1' },
    { id: '2', title: '2' },
    { id: '5', title: '5' },
  ]);
}

export function buildFulfillmentInteractive(body: string, delivery: boolean, collection: boolean): InteractiveMessage {
  const items: Array<{ id: string; title: string }> = [];
  if (delivery) items.push({ id: '1', title: 'Delivery' });
  if (collection) items.push({ id: delivery ? '2' : '1', title: 'Collection' });
  return buttons(body, items);
}

export function buildConfirmInteractive(body: string): InteractiveMessage {
  return buttons(body, [
    { id: '1', title: 'Confirm order' },
    { id: '2', title: 'Edit cart' },
    { id: '3', title: 'Cancel' },
  ]);
}
