import { cn } from '@/lib/utils';

export type OverviewNeonVariant =
  | 'violet'
  | 'fuchsia'
  | 'cyan'
  | 'emerald'
  | 'orange'
  | 'rose'
  | 'sky';

/** Shaded neon vbox — 2px border + tinted fill + outer glow. */
export function overviewNeonBox(
  variant: OverviewNeonVariant = 'violet',
  className?: string,
) {
  return cn('overview-neon-box', `overview-neon-box--${variant}`, className);
}

/** @alias overviewNeonBox — shared across dashboard pages */
export const dashboardNeonBox = overviewNeonBox;

/** Section block with bold bottom separator. */
export function overviewSection(className?: string) {
  return cn('dashboard-section-anchor overview-section', className);
}

/** @alias overviewSection */
export const dashboardSection = overviewSection;

/** Bold horizontal rule inside a panel. */
export function overviewDivider(className?: string) {
  return cn('overview-divider', className);
}

/** @alias overviewDivider */
export const dashboardDivider = overviewDivider;
