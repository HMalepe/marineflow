/** Smooth-scroll to an in-page section, accounting for sticky chrome (desktop header or mobile tab bar). */
export function scrollToPageSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;

  const root = getComputedStyle(document.documentElement);
  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  let topOffset: number;
  if (isMobile) {
    const header = Number.parseFloat(root.getPropertyValue('--mobile-header-height')) || 56;
    const safeTop = Number.parseFloat(root.getPropertyValue('--safe-area-top')) || 0;
    topOffset = header + safeTop + 12;
  } else {
    const sticky = Number.parseFloat(root.getPropertyValue('--dashboard-sticky-offset')) || 56;
    topOffset = sticky + 12;
  }

  const top = el.getBoundingClientRect().top + window.scrollY - topOffset;

  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}
