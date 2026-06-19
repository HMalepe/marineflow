/** Coarse tenant category — distinct from `industryTemplate` (vertical copy/vocabulary). */

export type BusinessType = 'SALON' | 'RESTAURANT' | 'CAR_WASH' | 'OTHER';

export const BUSINESS_TYPES: BusinessType[] = ['SALON', 'RESTAURANT', 'CAR_WASH', 'OTHER'];

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  SALON: 'Salon & beauty',
  RESTAURANT: 'Restaurant',
  CAR_WASH: 'Car wash',
  OTHER: 'Other business',
};

/** Short chip label for tables and badges. */
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

/** Derive business type when only industry template is known (e.g. legacy rows). */
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
