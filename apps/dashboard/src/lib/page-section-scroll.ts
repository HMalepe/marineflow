/** Smooth-scroll to an in-page section, accounting for the sticky dashboard header. */
export function scrollToPageSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;

  const raw = getComputedStyle(document.documentElement).getPropertyValue('--dashboard-sticky-offset');
  const offset = Number.parseFloat(raw) || 56;
  const top = el.getBoundingClientRect().top + window.scrollY - offset - 12;

  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}
