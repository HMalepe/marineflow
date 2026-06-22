/** Smooth-scroll to an in-page section, accounting for sticky chrome (desktop header or mobile tab bar). */
export function scrollToPageSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;

  const raw = getComputedStyle(document.documentElement).getPropertyValue('--dashboard-sticky-offset');
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  const mobileBottom = getComputedStyle(document.documentElement).getPropertyValue(
    '--dashboard-mobile-bottom-padding',
  );
  const offset = isMobile
    ? Number.parseFloat(mobileBottom) || 72
    : Number.parseFloat(raw) || 56;
  const top = el.getBoundingClientRect().top + window.scrollY - (isMobile ? 16 : offset) - 12;

  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}
