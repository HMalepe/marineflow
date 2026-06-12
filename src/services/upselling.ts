import { getTenantDb } from '../lib/db/tenantSession.js';

export interface ServiceAddonWithDetails {
  id: string;
  serviceId: string;
  addonServiceId: string;
  pitchMessage: string | null;
  sortOrder: number;
  addon: {
    id: string;
    name: string;
    priceCents: number;
    durationMin: number;
    description: string | null;
  };
}

export async function getAddonsForService(
  salonId: string,
  serviceId: string,
): Promise<ServiceAddonWithDetails[]> {
  const db = getTenantDb();
  const rows = await db.serviceAddon.findMany({
    where: { salonId, serviceId, active: true },
    include: {
      addonService: {
        select: {
          id: true,
          name: true,
          priceCents: true,
          durationMin: true,
          description: true,
          active: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return rows
    .filter((r) => r.addonService.active && !r.addonService.deletedAt)
    .map((r) => ({
      id: r.id,
      serviceId: r.serviceId,
      addonServiceId: r.addonServiceId,
      pitchMessage: r.pitchMessage,
      sortOrder: r.sortOrder,
      addon: {
        id: r.addonService.id,
        name: r.addonService.name,
        priceCents: r.addonService.priceCents,
        durationMin: r.addonService.durationMin,
        description: r.addonService.description,
      },
    }));
}

export function formatAddonMenu(addons: ServiceAddonWithDetails[]): string {
  if (!addons.length) return '';
  const lines = addons.map((a, i) => {
    const price = (a.addon.priceCents / 100).toFixed(0);
    const pitch = a.pitchMessage?.trim() || `Add ${a.addon.name} for R${price}?`;
    return `${i + 1}. ${pitch}`;
  });
  return ['Would you like to add any extras?', ...lines, '', 'Reply with numbers (e.g. 1 2) or SKIP to continue.'].join('\n');
}

export function parseAddonSelection(
  text: string,
  addons: ServiceAddonWithDetails[],
): ServiceAddonWithDetails[] {
  const t = text.trim().toLowerCase();
  if (!t || t === 'skip' || t === 'no' || t === '0') return [];

  const nums = t.match(/\d+/g)?.map((n) => parseInt(n, 10)) ?? [];
  const selected: ServiceAddonWithDetails[] = [];
  for (const n of nums) {
    if (n >= 1 && n <= addons.length) {
      const addon = addons[n - 1]!;
      if (!selected.some((s) => s.addonServiceId === addon.addonServiceId)) {
        selected.push(addon);
      }
    }
  }
  return selected;
}

export function totalAddonDuration(addons: ServiceAddonWithDetails[]): number {
  return addons.reduce((sum, a) => sum + a.addon.durationMin, 0);
}

export function totalAddonPriceCents(addons: ServiceAddonWithDetails[]): number {
  return addons.reduce((sum, a) => sum + a.addon.priceCents, 0);
}
