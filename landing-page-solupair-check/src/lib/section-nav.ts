import { scrollToSnap, type SnapId } from "@/lib/scroll-choreography";

export function navigateToSection(id: SnapId, prefersReducedMotion: boolean) {
  scrollToSnap(id, prefersReducedMotion ? "auto" : "smooth");
}
