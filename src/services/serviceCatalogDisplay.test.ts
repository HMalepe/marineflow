import { describe, expect, it } from 'vitest';
import { buildCategorizedPriceLines, sanitizeAiBookReply, isAddonCatalogService, filterBookableCatalogServices } from './serviceCatalogDisplay.js';

describe('serviceCatalogDisplay', () => {
  it('buildCategorizedPriceLines uses exact dashboard prices by category', () => {
    const lines = buildCategorizedPriceLines([
      {
        id: 's1',
        name: 'Haircut',
        priceCents: 4500,
        sortOrder: 0,
        categoryId: 'c1',
        category: { id: 'c1', name: 'Cuts', sortOrder: 0, salonId: 'salon', slug: 'cuts', createdAt: new Date() },
      } as never,
      {
        id: 's2',
        name: 'Fade',
        priceCents: 17050,
        sortOrder: 1,
        categoryId: 'c1',
        category: { id: 'c1', name: 'Cuts', sortOrder: 0, salonId: 'salon', slug: 'cuts', createdAt: new Date() },
      } as never,
    ]);

    expect(lines).toContain('*Cuts*');
    expect(lines).toContain('• Haircut — R 45.00');
    expect(lines).toContain('• Fade — R 170.50');
  });

  it('sanitizeAiBookReply strips hallucinated price ranges', () => {
    const cleaned = sanitizeAiBookReply(
      'Perfect! We have options from basic cuts (R45) to fades (R170-200). What style are you thinking?',
    );
    expect(cleaned).not.toMatch(/R\s?\d/i);
    expect(cleaned.length).toBeGreaterThan(0);
  });

  it('isAddonCatalogService detects add-on category and names', () => {
    const addon = {
      name: 'Hot Towel Treatment (Add-On)',
      category: { slug: 'add-ons', name: 'Add-Ons' },
    } as never;
    expect(isAddonCatalogService(addon)).toBe(true);
    expect(filterBookableCatalogServices([addon])).toHaveLength(0);
  });
});
