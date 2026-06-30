export type SnapId =
  | "hero"
  | "services"
  | "audience"
  | "pricing"
  | "work-0"
  | "work-1"
  | "work-2"
  | "cta"
  | "contact";

export const SNAP_ORDER: SnapId[] = [
  "hero",
  "services",
  "audience",
  "pricing",
  "work-0",
  "work-1",
  "work-2",
  "cta",
  "contact",
];

export function getSnapElement(id: SnapId): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-scroll-snap="${id}"]`);
}

export function scrollToSnap(id: SnapId, behavior: ScrollBehavior = "smooth") {
  const el = getSnapElement(id);
  if (!el) return;
  el.scrollIntoView({ behavior, block: "start" });
}

export function getSnapTops(scrollY = window.scrollY) {
  return SNAP_ORDER.map((id) => {
    const el = getSnapElement(id);
    if (!el) return Number.POSITIVE_INFINITY;
    return el.getBoundingClientRect().top + scrollY;
  });
}

/** Nearest snap index (0 = hero … last = contact). */
export function getNearestSnapIndex(scrollY = window.scrollY) {
  const tops = getSnapTops(scrollY);
  let nearest = 0;
  let minDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < tops.length; i += 1) {
    const dist = Math.abs(scrollY - tops[i]);
    if (dist < minDist) {
      minDist = dist;
      nearest = i;
    }
  }

  return nearest;
}

export function snapIdFromIndex(index: number): SnapId {
  return SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, Math.max(0, index))];
}

export function projectIndexFromSnapId(id: SnapId) {
  if (id === "work-0") return 0;
  if (id === "work-1") return 1;
  if (id === "work-2") return 2;
  return 0;
}

export function snapIdFromProjectIndex(index: number): SnapId {
  return `work-${Math.min(2, Math.max(0, index))}` as SnapId;
}

export function getWorkScrollBounds() {
  const work = getSnapElement("work-0");
  const contact = getSnapElement("contact");
  if (!work || !contact) return null;

  const workTop = work.offsetTop;
  const contactTop = contact.offsetTop;
  return { workTop, contactTop };
}
