import { getCachedServices } from './cachedQueries.js';

/** Sentinel ids stored in conversation context for the Services sub-menu. */
export const SERVICE_SUBMENU_PRICES = '__prices__';
export const SERVICE_SUBMENU_OTHER = '__other__';

export type ServiceSubMenuOption = {
  id: string;
  label: string;
};

type CachedService = Awaited<ReturnType<typeof getCachedServices>>[number];

/** Build Services sub-menu options from the live dashboard catalog (cached, invalidated on writes). */
export async function loadServiceSubMenuOptions(salonId: string): Promise<ServiceSubMenuOption[]> {
  const services = await getCachedServices(salonId);
  if (services.length === 0) return [];

  const categoryMap = new Map<string, { name: string; sortOrder: number }>();
  let uncategorized = 0;

  for (const s of services) {
    if (s.category) {
      if (!categoryMap.has(s.category.id)) {
        categoryMap.set(s.category.id, {
          name: s.category.name,
          sortOrder: s.category.sortOrder,
        });
      }
    } else {
      uncategorized++;
    }
  }

  const options: ServiceSubMenuOption[] = [...categoryMap.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .map(([id, cat]) => ({ id, label: cat.name }));

  if (uncategorized > 0) {
    options.push({ id: SERVICE_SUBMENU_OTHER, label: 'Other' });
  }

  options.push({ id: SERVICE_SUBMENU_PRICES, label: 'Prices' });
  return options;
}

export function buildServicesSubMenuText(options: ServiceSubMenuOption[]): string {
  if (options.length === 0) {
    return [
      '*Services*',
      '',
      'No services listed yet.',
      '',
      'Reply BACK for main menu.',
    ].join('\n');
  }
  const lines = options.map((o, i) => `${i + 1} — ${o.label}`);
  return ['*Services*', ...lines, '', 'Reply BACK for main menu.'].join('\n');
}

export async function loadServicesForSubMenuOption(
  salonId: string,
  optionId: string,
): Promise<{ label: string; services: CachedService[] }> {
  const all = await getCachedServices(salonId);

  if (optionId === SERVICE_SUBMENU_PRICES) {
    return { label: 'Service prices', services: all };
  }

  if (optionId === SERVICE_SUBMENU_OTHER) {
    return { label: 'Other', services: all.filter((s) => !s.categoryId) };
  }

  const services = all.filter((s) => s.categoryId === optionId);
  const label = services[0]?.category?.name ?? 'Services';
  return { label, services };
}
