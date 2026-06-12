import { describe, expect, it } from 'vitest';
import {
  formatAddonMenu,
  parseAddonSelection,
  totalAddonDuration,
  totalAddonPriceCents,
  type ServiceAddonWithDetails,
} from './upselling.js';

function mockAddon(n: number, name: string, price: number, duration = 15): ServiceAddonWithDetails {
  return {
    id: `addon-${n}`,
    serviceId: 'svc-main',
    addonServiceId: `svc-addon-${n}`,
    pitchMessage: null,
    sortOrder: n,
    addon: { id: `svc-addon-${n}`, name, priceCents: price, durationMin: duration, description: null },
  };
}

describe('upselling', () => {
  const addons = [
    mockAddon(1, 'Deep conditioning', 12000, 20),
    mockAddon(2, 'Hot towel', 5000, 10),
    mockAddon(3, 'Ear wax', 8000, 5),
  ];

  it('parseAddonSelection skips on SKIP/no/0', () => {
    expect(parseAddonSelection('skip', addons)).toEqual([]);
    expect(parseAddonSelection('NO', addons)).toEqual([]);
    expect(parseAddonSelection('0', addons)).toEqual([]);
  });

  it('parseAddonSelection picks single and multiple', () => {
    expect(parseAddonSelection('1', addons).map((a) => a.addon.name)).toEqual(['Deep conditioning']);
    expect(parseAddonSelection('1 3', addons).map((a) => a.addon.name)).toEqual([
      'Deep conditioning',
      'Ear wax',
    ]);
  });

  it('dedupes duplicate numbers', () => {
    expect(parseAddonSelection('1 1 2', addons)).toHaveLength(2);
  });

  it('ignores out-of-range numbers', () => {
    expect(parseAddonSelection('99', addons)).toEqual([]);
    expect(parseAddonSelection('1 99', addons)).toHaveLength(1);
  });

  it('totals duration and price', () => {
    const picked = parseAddonSelection('1 2', addons);
    expect(totalAddonDuration(picked)).toBe(30);
    expect(totalAddonPriceCents(picked)).toBe(17000);
  });

  it('formatAddonMenu includes skip hint', () => {
    const menu = formatAddonMenu(addons);
    expect(menu).toContain('SKIP');
    expect(menu).toContain('Deep conditioning');
  });

  it('uses custom pitch when set', () => {
    const custom = [{ ...addons[0]!, pitchMessage: 'Treat yourself — R120 add-on?' }];
    expect(formatAddonMenu(custom)).toContain('Treat yourself');
  });
});
