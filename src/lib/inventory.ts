import type { Service } from '@prisma/client';

export type InventoryService = Pick<
  Service,
  'id' | 'name' | 'active' | 'trackInventory' | 'stockQty' | 'lowStockThreshold' | 'deletedAt'
>;

export function isProductSellable(
  service: Pick<Service, 'active' | 'deletedAt' | 'trackInventory' | 'stockQty'>,
  qty = 1,
): boolean {
  if (!service.active || service.deletedAt) return false;
  if (!service.trackInventory) return true;
  return service.stockQty >= qty;
}

export function inventoryStatusLabel(
  service: Pick<Service, 'trackInventory' | 'stockQty' | 'lowStockThreshold' | 'active'>,
): 'in_stock' | 'low' | 'out' | 'untracked' | 'inactive' {
  if (!service.active) return 'inactive';
  if (!service.trackInventory) return 'untracked';
  if (service.stockQty <= 0) return 'out';
  if (service.stockQty <= service.lowStockThreshold) return 'low';
  return 'in_stock';
}

export function stockBadgeCopy(
  service: Pick<Service, 'trackInventory' | 'stockQty' | 'lowStockThreshold' | 'active'>,
): string {
  switch (inventoryStatusLabel(service)) {
    case 'inactive':
      return 'Hidden';
    case 'untracked':
      return 'Not tracked';
    case 'out':
      return 'Out of stock';
    case 'low':
      return `Low · ${service.stockQty} left`;
    default:
      return `${service.stockQty} in stock`;
  }
}
