import { describe, expect, it } from 'vitest';
import { inventoryStatusLabel, isProductSellable, stockBadgeCopy } from './inventory.js';

describe('inventory helpers', () => {
  it('treats untracked products as sellable', () => {
    expect(
      isProductSellable({
        active: true,
        deletedAt: null,
        trackInventory: false,
        stockQty: 0,
      }),
    ).toBe(true);
  });

  it('blocks out-of-stock tracked products', () => {
    expect(
      isProductSellable({
        active: true,
        deletedAt: null,
        trackInventory: true,
        stockQty: 0,
      }),
    ).toBe(false);
    expect(
      isProductSellable(
        {
          active: true,
          deletedAt: null,
          trackInventory: true,
          stockQty: 2,
        },
        3,
      ),
    ).toBe(false);
  });

  it('labels low and out stock', () => {
    expect(
      inventoryStatusLabel({
        active: true,
        trackInventory: true,
        stockQty: 0,
        lowStockThreshold: 5,
      }),
    ).toBe('out');
    expect(
      stockBadgeCopy({
        active: true,
        trackInventory: true,
        stockQty: 3,
        lowStockThreshold: 5,
      }),
    ).toContain('Low');
  });
});
