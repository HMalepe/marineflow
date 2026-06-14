import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildServicesSubMenuText,
  loadServiceSubMenuOptions,
  loadServicesForSubMenuOption,
  SERVICE_SUBMENU_OTHER,
  SERVICE_SUBMENU_PRICES,
} from './serviceMenuCatalog.js';

const getCachedServices = vi.hoisted(() => vi.fn());

vi.mock('./cachedQueries.js', () => ({
  getCachedServices: getCachedServices,
}));

describe('serviceMenuCatalog', () => {
  beforeEach(() => {
    getCachedServices.mockReset();
  });

  it('builds sub-menu from dashboard categories only (no hardcoded nails/massage)', async () => {
    getCachedServices.mockResolvedValue([
      {
        id: 's1',
        name: 'Low Fade',
        priceCents: 17000,
        categoryId: 'cat-other',
        category: { id: 'cat-other', name: 'Other', sortOrder: 3 },
      },
      {
        id: 's2',
        name: 'Teen Fade',
        priceCents: 15000,
        categoryId: 'cat-other',
        category: { id: 'cat-other', name: 'Other', sortOrder: 3 },
      },
      {
        id: 's3',
        name: 'Line Up',
        priceCents: 8000,
        categoryId: null,
        category: null,
      },
    ]);

    const options = await loadServiceSubMenuOptions('salon-1');
    expect(options.map((o) => o.label)).toEqual(['Other', 'Other', 'Prices']);
    // duplicate category collapsed
    expect(options.filter((o) => o.id === 'cat-other')).toHaveLength(1);
    expect(options.some((o) => o.id === SERVICE_SUBMENU_OTHER)).toBe(true);
    expect(options.some((o) => o.id === SERVICE_SUBMENU_PRICES)).toBe(true);
    expect(options.some((o) => o.label === 'Nails')).toBe(false);
  });

  it('formats WhatsApp sub-menu text', () => {
    const text = buildServicesSubMenuText([
      { id: 'cat-1', label: 'Cuts' },
      { id: SERVICE_SUBMENU_PRICES, label: 'Prices' },
    ]);
    expect(text).toContain('*Services*');
    expect(text).toContain('1 — Cuts');
    expect(text).toContain('2 — Prices');
  });

  it('loads services for a category option id', async () => {
    getCachedServices.mockResolvedValue([
      { id: 's1', name: 'Fade', priceCents: 100, categoryId: 'cat-a', category: { name: 'Cuts' } },
      { id: 's2', name: 'Colour', priceCents: 200, categoryId: 'cat-b', category: { name: 'Color' } },
    ]);

    const { label, services } = await loadServicesForSubMenuOption('salon-1', 'cat-a');
    expect(label).toBe('Cuts');
    expect(services).toHaveLength(1);
    expect(services[0]!.name).toBe('Fade');
  });
});
