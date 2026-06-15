import { formatCentsZar } from '../lib/formatPrice.js';
import { getCachedServices } from './cachedQueries.js';

export type SalonCatalogService = Awaited<ReturnType<typeof getCachedServices>>[number];

/** Live active services from the dashboard catalog (cached, invalidated on CRUD). */
export async function loadSalonServiceCatalog(salonId: string): Promise<SalonCatalogService[]> {
  return getCachedServices(salonId);
}

/** Services in Add-Ons category or marked as add-ons — not bookable as a primary appointment via WhatsApp. */
export function isAddonCatalogService(
  service: Pick<SalonCatalogService, 'name' | 'category'>,
): boolean {
  const slug = service.category?.slug?.toLowerCase() ?? '';
  const catName = service.category?.name?.toLowerCase() ?? '';
  if (slug === 'add-ons' || slug === 'addons') return true;
  if (catName.includes('add-on') || catName.includes('addon')) return true;
  if (/\(add-?on\)/i.test(service.name)) return true;
  return false;
}

export function filterBookableCatalogServices(services: SalonCatalogService[]): SalonCatalogService[] {
  return services.filter((s) => !isAddonCatalogService(s));
}

function sortServices(services: SalonCatalogService[]): SalonCatalogService[] {
  return [...services].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function groupCatalogServicesByCategory(services: SalonCatalogService[]) {
  const groups = new Map<string, { name: string; sortOrder: number; services: SalonCatalogService[] }>();
  const uncategorized: SalonCatalogService[] = [];

  for (const s of services) {
    if (s.category) {
      const g = groups.get(s.category.id);
      if (g) g.services.push(s);
      else {
        groups.set(s.category.id, {
          name: s.category.name,
          sortOrder: s.category.sortOrder,
          services: [s],
        });
      }
    } else {
      uncategorized.push(s);
    }
  }

  const sorted = [...groups.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .map(([, cat]) => ({ ...cat, services: sortServices(cat.services) }));

  return { sorted, uncategorized: sortServices(uncategorized) };
}

/** WhatsApp lines grouped by dashboard category with exact stored prices. */
export function buildCategorizedPriceLines(
  services: SalonCatalogService[],
  label: (text: string) => string = (t) => t,
): string[] {
  const lines: string[] = [];
  const { sorted, uncategorized } = groupCatalogServicesByCategory(services);

  for (const cat of sorted) {
    lines.push(`*${label(cat.name)}*`);
    for (const s of cat.services) {
      lines.push(`• ${label(s.name)} — ${formatCentsZar(s.priceCents)}`);
    }
    lines.push('');
  }

  if (uncategorized.length > 0) {
    lines.push('*Other*');
    for (const s of uncategorized) {
      lines.push(`• ${label(s.name)} — ${formatCentsZar(s.priceCents)}`);
    }
  }

  while (lines.at(-1) === '') lines.pop();
  return lines;
}

export function formatCatalogServiceLine(
  service: SalonCatalogService,
  index: number,
  label: (text: string) => string = (t) => t,
): string {
  return `${index}. ${label(service.name)} (${formatCentsZar(service.priceCents)})`;
}

/** Remove invented R amounts from AI book replies — catalog quick-picks show real prices. */
export function sanitizeAiBookReply(reply: string): string {
  let t = reply
    .replace(/R\s?\d[\d,]*(?:\.\d{2})?(?:\s*[-–to]+\s*R\s?\d[\d,]*(?:\.\d{2})?)?/gi, '')
    .replace(/\(\s*R[^)]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!t) return 'I can help you book!';
  return t;
}
