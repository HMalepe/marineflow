/** Coarse tenant category — distinct from industry vertical templates. */

export type BusinessType = 'SALON' | 'RESTAURANT' | 'CAR_WASH' | 'OTHER';

export const BUSINESS_TYPES: BusinessType[] = ['SALON', 'RESTAURANT', 'CAR_WASH', 'OTHER'];

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  SALON: 'Salon & beauty',
  RESTAURANT: 'Restaurant',
  CAR_WASH: 'Car wash',
  OTHER: 'Other business',
};

const BUSINESS_TYPE_SHORT_LABELS: Record<BusinessType, string> = {
  SALON: 'Salon',
  RESTAURANT: 'Restaurant',
  CAR_WASH: 'Car wash',
  OTHER: 'Other',
};

export function getBusinessTypeLabel(type: BusinessType): string {
  return BUSINESS_TYPE_LABELS[type] ?? BUSINESS_TYPE_LABELS.OTHER;
}

export function getBusinessTypeShortLabel(type: BusinessType): string {
  return BUSINESS_TYPE_SHORT_LABELS[type] ?? BUSINESS_TYPE_SHORT_LABELS.OTHER;
}

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (BUSINESS_TYPES as string[]).includes(value);
}

export function businessTypeFromIndustryTemplate(template: string): BusinessType {
  switch (template) {
    case 'restaurant':
      return 'RESTAURANT';
    case 'carwash':
      return 'CAR_WASH';
    case 'fitness':
    case 'clinic':
      return 'OTHER';
    default:
      return 'SALON';
  }
}

export const BUSINESS_TYPE_CHIP_CLASS: Record<BusinessType, string> = {
  SALON: 'bg-violet-500/15 text-violet-800 dark:text-violet-300 border-violet-500/30',
  RESTAURANT: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30',
  CAR_WASH: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
  OTHER: 'bg-muted text-muted-foreground border-border',
};
