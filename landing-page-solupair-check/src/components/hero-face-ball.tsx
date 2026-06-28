import { useCallback, useEffect, useMemo, useRef, type PointerEvent, type RefObject } from "react";
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { BallSphere } from "@/components/ball-sphere";
import { useBallPhysics } from "@/hooks/use-ball-physics";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import { BALL_SHADOW, BALL_SURFACE, HERO_PHYSICS } from "@/lib/ball-physics";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function HeroFaceBall({
  interactionRef,
}: {
  interactionRef: RefObject<HTMLElement | null>;
}) {
  const { scrollY } = useScroll();
  const { prefersReducedMotion, isPhone } = useDeviceProfile();
  const ballRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, active: false });

  const dragLimit = isPhone ? 88 : 132;
  const bounds = useMemo(
    () => ({
      minX: -dragLimit,
      maxX: dragLimit,
      minY: -dragLimit,
      maxY: dragLimit,
    }),
    [dragLimit],
  );

  const getHoverNudge = useCallback(() => {
    if (pointerRef.current.active) return undefined;
    const zone = interactionRef.current;
    if (!zone) return undefined;
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = pointerRef.current.x - cx;
    const dy = pointerRef.current.y - cy;
    const strength = isPhone ? 0.06 : 0.09;
    const limit = isPhone ? 36 : 56;
    return {
      x: clamp(dx * strength, -limit, limit),
      y: clamp(dy * strength, -limit, limit),
    };
  }, [interactionRef, isPhone]);

  const { x, y, setDragTarget, setDragging } = useBallPhysics({
    enabled: !prefersReducedMotion,
    config: HERO_PHYSICS,
    bounds,
    getHoverNudge,
  });

  const lidRaw = useTransform(scrollY, [0, 220], [1, 0]);
  const lidScale = useSpring(lidRaw, { stiffness: 140, damping: 22 });
  const smileRaw = useTransform(scrollY, [180, 520], [0, 1]);
  const smile = useSpring(smileRaw, { stiffness: 140, damping: 22 });
  const mouthWidth = useTransform(smile, (v: number) => `${22 + v * 70}px`);
  const mouthHeight = useTransform(smile, (v: number) => `${36 + v * 12}px`);
  const mouthRadius = useTransform(
    smile,
    (v: number) =>
      `${50 - v * 40}% ${50 - v * 40}% ${50 + v * 45}% ${50 + v * 45}% / ${50 - v * 35}% ${50 - v * 35}% ${50 + v * 55}% ${50 + v * 55}%`,
  );

  const toLocalOffset = (clientX: number, clientY: number) => {
    const zone = interactionRef.current;
    if (!zone) return { x: 0, y: 0 };
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return {
      x: clamp(clientX - cx, -dragLimit, dragLimit),
      y: clamp(clientY - cy, -dragLimit, dragLimit),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    pointerRef.current.active = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    const offset = toLocalOffset(event.clientX, event.clientY);
    setDragTarget(offset.x, offset.y);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    pointerRef.current.x = event.clientX;
    pointerRef.current.y = event.clientY;
    if (!pointerRef.current.active) return;
    const offset = toLocalOffset(event.clientX, event.clientY);
    setDragTarget(offset.x, offset.y);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointerRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  useEffect(() => {
    const zone = interactionRef.current;
    if (!zone || prefersReducedMotion) return;

    const onMove = (event: globalThis.PointerEvent) => {
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;
    };

    zone.addEventListener("pointermove", onMove);
    return () => zone.removeEventListener("pointermove", onMove);
  }, [interactionRef, prefersReducedMotion]);

  const sizeClass =
    "h-[280px] w-[280px] sm:h-[360px] sm:w-[360px] lg:h-[440px] lg:w-[440px]";

  return (
    <div
      aria-hidden
      className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 ${sizeClass}`}
    >
      {prefersReducedMotion ? (
        <div
          className="relative h-full w-full rounded-full"
          style={{ background: BALL_SURFACE, boxShadow: BALL_SHADOW }}
        />
      ) : (
        <motion.div
          ref={ballRef}
          className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
          style={{ x, y, willChange: "transform" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <BallSphere
            showFace
            lidScale={lidScale}
            mouthRadius={mouthRadius}
            mouthHeight={mouthHeight}
            mouthWidth={mouthWidth}
          />
        </motion.div>
      )}
    </div>
  );
}
