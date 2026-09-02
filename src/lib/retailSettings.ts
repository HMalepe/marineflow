/** Dispensary / retail config stored on Salon.metadata.retail */

export type RetailDriver = {
  name: string;
  /** E.164 or SA local — normalized at use time. */
  phone: string;
};

export type RetailSettings = {
  /** When true, bot treats the shop as always open (Uber Eats–style 24/7). */
  alwaysOpen: boolean;
  deliveryEnabled: boolean;
  collectionEnabled: boolean;
  /** Flat delivery fee in cents (ZAR). */
  deliveryFeeCents: number;
  /** Minimum order subtotal before delivery fee (cents). 0 = no minimum. */
  minOrderCents: number;
  /** Soft copy for coverage — not geo-enforced yet. */
  deliveryAreaNote: string;
  /** Shown on age gate before first order. */
  ageGateEnabled: boolean;
  ageGateCopy: string;
  /** ETA copy after order confirmed. */
  deliveryEtaMinutes: number;
  collectionEtaMinutes: number;
  /** WhatsApp ping OWNER/MANAGER/RECEPTIONIST phones on every new order. */
  notifyStaffOnOrder: boolean;
  /**
   * When true, registered drivers get Uber-style ACCEPT/DECLINE offers
   * on the shared WhatsApp business number.
   */
  driverNotifyEnabled: boolean;
  /** Legacy flat phone list — prefer `drivers`. */
  driverPhones: string[];
  /** Named riders who receive delivery offers. */
  drivers: RetailDriver[];
};

export const DEFAULT_RETAIL_SETTINGS: RetailSettings = {
  alwaysOpen: true,
  deliveryEnabled: true,
  collectionEnabled: true,
  deliveryFeeCents: 5000, // R50
  minOrderCents: 15000, // R150
  deliveryAreaNote: 'We deliver across Joburg metro — reply with your suburb and we’ll confirm.',
  ageGateEnabled: true,
  ageGateCopy:
    '🌿 *Bart Marley Dispensary*\n\nYou must be *18+* to order cannabis products.\n\nReply *YES* to confirm you are 18 or older, or *NO* to exit.',
  deliveryEtaMinutes: 60,
  collectionEtaMinutes: 30,
  notifyStaffOnOrder: true,
  driverNotifyEnabled: false,
  driverPhones: [],
  drivers: [],
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim());
}

function asDrivers(value: unknown): RetailDriver[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row): RetailDriver | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const phone = typeof r.phone === 'string' ? r.phone.trim() : '';
      if (!phone) return null;
      const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Driver';
      return { name, phone };
    })
    .filter((d): d is RetailDriver => d != null);
}

export function getRetailSettings(metadata: unknown): RetailSettings {
  const root =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const raw =
    root.retail && typeof root.retail === 'object' && !Array.isArray(root.retail)
      ? (root.retail as Record<string, unknown>)
      : {};

  const drivers = asDrivers(raw.drivers);
  const driverPhones = asStringArray(raw.driverPhones).length
    ? asStringArray(raw.driverPhones)
    : DEFAULT_RETAIL_SETTINGS.driverPhones;

  const hasDrivers = drivers.length > 0 || driverPhones.length > 0;

  return {
    alwaysOpen:
      typeof raw.alwaysOpen === 'boolean' ? raw.alwaysOpen : DEFAULT_RETAIL_SETTINGS.alwaysOpen,
    deliveryEnabled:
      typeof raw.deliveryEnabled === 'boolean'
        ? raw.deliveryEnabled
        : DEFAULT_RETAIL_SETTINGS.deliveryEnabled,
    collectionEnabled:
      typeof raw.collectionEnabled === 'boolean'
        ? raw.collectionEnabled
        : DEFAULT_RETAIL_SETTINGS.collectionEnabled,
    deliveryFeeCents:
      typeof raw.deliveryFeeCents === 'number' && Number.isFinite(raw.deliveryFeeCents)
        ? Math.max(0, Math.round(raw.deliveryFeeCents))
        : DEFAULT_RETAIL_SETTINGS.deliveryFeeCents,
    minOrderCents:
      typeof raw.minOrderCents === 'number' && Number.isFinite(raw.minOrderCents)
        ? Math.max(0, Math.round(raw.minOrderCents))
        : DEFAULT_RETAIL_SETTINGS.minOrderCents,
    deliveryAreaNote:
      typeof raw.deliveryAreaNote === 'string' && raw.deliveryAreaNote.trim()
        ? raw.deliveryAreaNote.trim()
        : DEFAULT_RETAIL_SETTINGS.deliveryAreaNote,
    ageGateEnabled:
      typeof raw.ageGateEnabled === 'boolean'
        ? raw.ageGateEnabled
        : DEFAULT_RETAIL_SETTINGS.ageGateEnabled,
    ageGateCopy:
      typeof raw.ageGateCopy === 'string' && raw.ageGateCopy.trim()
        ? raw.ageGateCopy.trim()
        : DEFAULT_RETAIL_SETTINGS.ageGateCopy,
    deliveryEtaMinutes:
      typeof raw.deliveryEtaMinutes === 'number' && Number.isFinite(raw.deliveryEtaMinutes)
        ? Math.max(15, Math.round(raw.deliveryEtaMinutes))
        : DEFAULT_RETAIL_SETTINGS.deliveryEtaMinutes,
    collectionEtaMinutes:
      typeof raw.collectionEtaMinutes === 'number' && Number.isFinite(raw.collectionEtaMinutes)
        ? Math.max(10, Math.round(raw.collectionEtaMinutes))
        : DEFAULT_RETAIL_SETTINGS.collectionEtaMinutes,
    notifyStaffOnOrder:
      typeof raw.notifyStaffOnOrder === 'boolean'
        ? raw.notifyStaffOnOrder
        : DEFAULT_RETAIL_SETTINGS.notifyStaffOnOrder,
    // Auto-enable when drivers are registered unless explicitly false
    driverNotifyEnabled:
      typeof raw.driverNotifyEnabled === 'boolean'
        ? raw.driverNotifyEnabled
        : hasDrivers
          ? true
          : DEFAULT_RETAIL_SETTINGS.driverNotifyEnabled,
    driverPhones,
    drivers: drivers.length ? drivers : DEFAULT_RETAIL_SETTINGS.drivers,
  };
}

export function formatZarFromCents(cents: number): string {
  return `R${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function isDispensarySalon(industryTemplate: string | null | undefined): boolean {
  return industryTemplate === 'dispensary';
}

/**
 * 24/7 open: explicit retail.alwaysOpen, or dispensary default (true unless set false).
 * Non-dispensary salons stay on normal BusinessHour rows unless they opt in.
 */
export function isRetailAlwaysOpen(
  metadata: unknown,
  industryTemplate?: string | null,
): boolean {
  const root =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const raw =
    root.retail && typeof root.retail === 'object' && !Array.isArray(root.retail)
      ? (root.retail as Record<string, unknown>)
      : {};
  if (typeof raw.alwaysOpen === 'boolean') return raw.alwaysOpen;
  return industryTemplate === 'dispensary';
}
