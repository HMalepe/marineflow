import { useEffect, useState } from "react";

export type DeviceProfile = {
  /** <= 639px */
  isPhone: boolean;
  /** 640px – 1023px */
  isTablet: boolean;
  /** >= 1024px */
  isDesktop: boolean;
  prefersReducedMotion: boolean;
  /** Touch-first device */
  coarsePointer: boolean;
};

const defaultProfile: DeviceProfile = {
  isPhone: false,
  isTablet: false,
  isDesktop: true,
  prefersReducedMotion: false,
  coarsePointer: false,
};

function readProfile(): DeviceProfile {
  if (typeof window === "undefined") return defaultProfile;

  const width = window.innerWidth;
  const isPhone = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  return {
    isPhone,
    isTablet,
    isDesktop,
    prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
  };
}

/** Responsive + accessibility signals for layout and motion decisions. */
export function useDeviceProfile(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>(defaultProfile);

  useEffect(() => {
    const update = () => setProfile(readProfile());

    update();

    const queries = [
      window.matchMedia("(max-width: 639px)"),
      window.matchMedia("(min-width: 640px) and (max-width: 1023px)"),
      window.matchMedia("(prefers-reduced-motion: reduce)"),
      window.matchMedia("(pointer: coarse)"),
    ];

    queries.forEach((mq) => mq.addEventListener("change", update));
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);

    return () => {
      queries.forEach((mq) => mq.removeEventListener("change", update));
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return profile;
}

export function getViewportHeight() {
  if (typeof window === "undefined") return 0;
  return window.visualViewport?.height ?? window.innerHeight;
}
