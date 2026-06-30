import { useEffect, useRef } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import {
  getNearestSnapIndex,
  scrollToSnap,
} from "@/lib/scroll-choreography";

const SCROLL_END_MS = 140;
const BOUNDARY_WHEEL_MIN = 28;

/**
 * Ensures fast flings never skip the Projects runway — always land on page 2
 * before Contact (down) or Hero (up). Uses native CSS mandatory snap + light guards.
 */
export function useScrollChoreography() {
  const { prefersReducedMotion } = useDeviceProfile();
  const gestureStartSnapRef = useRef(0);
  const scrollingRef = useRef(false);
  const scrollEndTimerRef = useRef<number | null>(null);
  const correctingRef = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion) return;

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
      if (correctingRef.current) return;

      const nearest = getNearestSnapIndex();
      const gestureStart = gestureStartSnapRef.current;

      // Hero fling must land on project 1 — never skip the runway.
      if (gestureStart === 0 && nearest > 1) {
        correctingRef.current = true;
        scrollToSnap("work-0", "smooth");
        window.setTimeout(() => {
          correctingRef.current = false;
        }, 480);
        return;
      }

      // Contact fling upward must land on project 3 first.
      if (gestureStart === 4 && nearest < 3) {
        correctingRef.current = true;
        scrollToSnap("work-2", "smooth");
        window.setTimeout(() => {
          correctingRef.current = false;
        }, 480);
        return;
      }

      // Each settled stop becomes the new gesture origin (multi-step scroll journeys).
      gestureStartSnapRef.current = nearest;
    };

    const onWheel = (event: WheelEvent) => {
      if (correctingRef.current || Math.abs(event.deltaY) < BOUNDARY_WHEEL_MIN) return;

      const current = getNearestSnapIndex();
      const down = event.deltaY > 0;

      if (current === 0 && down) {
        event.preventDefault();
        scrollToSnap("work-0", "smooth");
        return;
      }

      if (current === 4 && !down) {
        event.preventDefault();
        scrollToSnap("work-2", "smooth");
      }
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
    };
  }, [prefersReducedMotion]);
}
