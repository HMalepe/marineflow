import { useEffect, useRef, useState } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";

type SectionInViewOptions = {
  threshold?: number;
  rootMargin?: string;
};

/** IntersectionObserver reveal trigger — respects prefers-reduced-motion. */
export function useSectionInView(options: SectionInViewOptions = {}) {
  const { threshold = 0.12, rootMargin = "0px 0px -8% 0px" } = options;
  const sectionRef = useRef<HTMLElement>(null);
  const [sectionInView, setSectionInView] = useState(false);
  const { prefersReducedMotion } = useDeviceProfile();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (prefersReducedMotion) {
      setSectionInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSectionInView(true);
        observer.disconnect();
      },
      { threshold, rootMargin },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [prefersReducedMotion, rootMargin, threshold]);

  return { sectionRef, sectionInView };
}
