import { useEffect, useRef } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import {
  getNearestSnapIndex,
  scrollToSnap,
  snapIdFromIndex,
  SNAP_ORDER,
} from "@/lib/scroll-choreography";

const SCROLL_END_MS = 140;
const WHEEL_DELTA_MIN = 28;
const WHEEL_LOCK_MS = 560;
const CORRECTION_COOLDOWN_MS = 120;

const MAX_SNAP_INDEX = SNAP_ORDER.length - 1;

/**
 * One snap per gesture — hard wheel flings and trackpad momentum cannot skip
 * cards in the Projects runway (or any other section).
 */
export function useScrollChoreography() {
  const { prefersReducedMotion } = useDeviceProfile();
  const gestureStartSnapRef = useRef(0);
  const scrollingRef = useRef(false);
  const scrollEndTimerRef = useRef<number | null>(null);
  const correctingRef = useRef(false);
  const wheelLockedRef = useRef(false);
  const wheelLockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const releaseWheelLock = () => {
      wheelLockedRef.current = false;
      if (wheelLockTimerRef.current) {
        window.clearTimeout(wheelLockTimerRef.current);
        wheelLockTimerRef.current = null;
      }
    };

    const lockWheel = () => {
      wheelLockedRef.current = true;
      if (wheelLockTimerRef.current) {
        window.clearTimeout(wheelLockTimerRef.current);
      }
      wheelLockTimerRef.current = window.setTimeout(releaseWheelLock, WHEEL_LOCK_MS);
    };

    const correctToSnap = (index: number) => {
      correctingRef.current = true;
      gestureStartSnapRef.current = index;
      scrollToSnap(snapIdFromIndex(index), "auto");
      window.setTimeout(() => {
        correctingRef.current = false;
      }, CORRECTION_COOLDOWN_MS);
    };

    const onScroll = () => {
      if (!scrollingRef.current) {
        gestureStartSnapRef.current = getNearestSnapIndex();
        scrollingRef.current = true;
      }

      if (scrollEndTimerRef.current) {
        window.clearTimeout(scrollEndTimerRef.current);
      }
      scrollEndTimerRef.current = window.setTimeout(onScrollEnd, SCROLL_END_MS);
    };

    const onScrollEnd = () => {
      scrollingRef.current = false;
      releaseWheelLock();

      if (correctingRef.current) return;

      const nearest = getNearestSnapIndex();
      const gestureStart = gestureStartSnapRef.current;

      // Never advance or retreat more than one snap per gesture.
      if (nearest > gestureStart + 1) {
        correctToSnap(gestureStart + 1);
        return;
      }

      if (nearest < gestureStart - 1) {
        correctToSnap(gestureStart - 1);
        return;
      }

      gestureStartSnapRef.current = nearest;
    };

    const onWheel = (event: WheelEvent) => {
      if (wheelLockedRef.current || correctingRef.current) {
        event.preventDefault();
        return;
      }

      if (Math.abs(event.deltaY) < WHEEL_DELTA_MIN) return;

      const current = getNearestSnapIndex();
      const down = event.deltaY > 0;
      const target = down ? Math.min(MAX_SNAP_INDEX, current + 1) : Math.max(0, current - 1);

      if (target === current) return;

      event.preventDefault();
      gestureStartSnapRef.current = current;
      lockWheel();
      scrollToSnap(snapIdFromIndex(target), "smooth");
    };

    const onScrollEndNative = () => onScrollEnd();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scrollend", onScrollEndNative);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scrollend", onScrollEndNative);
      if (scrollEndTimerRef.current) window.clearTimeout(scrollEndTimerRef.current);
      if (wheelLockTimerRef.current) window.clearTimeout(wheelLockTimerRef.current);
    };
  }, [prefersReducedMotion]);
}
