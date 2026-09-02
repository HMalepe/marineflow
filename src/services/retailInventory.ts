import { getTenantDb } from '../lib/db/tenantSession.js';
import { isProductSellable } from '../lib/inventory.js';
import { logger } from '../lib/logger.js';
import { syncSalonRosterLater } from './rosterSync.js';

/** Decrement stock after a confirmed retail order (skips untracked SKUs). */
export async function decrementInventoryForOrder(input: {
  salonId: string;
  items: { serviceId: string; quantity: number }[];
}): Promise<void> {
  const db = getTenantDb();
  for (const line of input.items) {
    if (line.quantity <= 0) continue;
    const svc = await db.service.findFirst({
      where: { id: line.serviceId, salonId: input.salonId, deletedAt: null },
      select: { id: true, trackInventory: true, stockQty: true, name: true },
    });
    if (!svc?.trackInventory) continue;
    const next = Math.max(0, svc.stockQty - line.quantity);
    await db.service.update({
      where: { id: svc.id },
      data: { stockQty: next },
    });
    if (next === 0) {
      logger.info({ serviceId: svc.id, name: svc.name }, 'retail_sku_now_out_of_stock');
    }
  }
  syncSalonRosterLater(input.salonId, 'services', { reason: 'inventory_decrement' });
}

export async function assertCartInStock(
  salonId: string,
  cart: { serviceId: string; qty: number; name: string }[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getTenantDb();
  for (const line of cart) {
    const svc = await db.service.findFirst({
      where: { id: line.serviceId, salonId, deletedAt: null },
    });
    if (!svc || !isProductSellable(svc, line.qty)) {
      const left = svc?.trackInventory ? svc.stockQty : 0;
      return {
        ok: false,
        message: svc?.trackInventory
          ? `*${line.name}* only has ${left} left — update your cart (reply *2* to edit).`
          : `*${line.name}* is unavailable right now — update your cart.`,
      };
    }
  }
  return { ok: true };
}
