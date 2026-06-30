export type SnapId = "hero" | "services" | "work" | "cta" | "contact";

/** Major page sections — CSS scroll-snap targets only (not carousel state). */
export const SNAP_ORDER: SnapId[] = [
  "hero",
  "services",
  "work",
  "cta",
  "contact",
];

export function getSnapElement(id: SnapId): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-scroll-snap="${id}"]`);
}

export function scrollToSnap(id: SnapId, behavior: ScrollBehavior = "smooth") {
  const el = getSnapElement(id) ?? document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior, block: "start" });
}
