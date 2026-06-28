import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { BallSphere } from "@/components/ball-sphere";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import {
  BALL_SHADOW,
  BALL_SURFACE,
  BASKETBALL_PHYSICS,
  getViewportBallBounds,
  stepBasketballPhysics,
  type PhysicsBallState,
} from "@/lib/ball-physics";

type Phase = "idle" | "simulating" | "resting";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function HeroFaceBall({
  interactionRef: _interactionRef,
}: {
  interactionRef: RefObject<HTMLElement | null>;
}) {
  const { scrollY } = useScroll();
  const { prefersReducedMotion } = useDeviceProfile();
  const ballRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");

  const posX = useMotionValue(0);
  const posY = useMotionValue(0);
  const stateRef = useRef<PhysicsBallState>({ x: 0, y: 0, vx: 0, vy: 0 });
  const draggingRef = useRef(false);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const radiusRef = useRef(220);

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

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

  const applyDragPosition = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = getViewportBallBounds(radiusRef.current);
      const px = clamp(clientX, bounds.minX, bounds.maxX);
      const py = clamp(clientY, bounds.minY, bounds.maxY);
      pointerRef.current = { x: px, y: py };
      stateRef.current = { ...stateRef.current, x: px, y: py };
      posX.set(px);
      posY.set(py);
    },
    [posX, posY],
  );

  const activateFromIdle = useCallback(() => {
    const el = ballRef.current;
    if (!el || phaseRef.current !== "idle") return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    radiusRef.current = rect.width / 2;

    stateRef.current = { x: cx, y: cy, vx: 0, vy: 0 };
    posX.set(cx);
    posY.set(cy);
    setPhaseSafe("simulating");
  }, [posX, posY, setPhaseSafe]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      if (phaseRef.current !== "simulating") return;

      const dt = now - last;
      last = now;

      const bounds = getViewportBallBounds(radiusRef.current);
      const drag = draggingRef.current ? pointerRef.current : null;

      const result = stepBasketballPhysics(
        stateRef.current,
        BASKETBALL_PHYSICS,
        bounds,
        dt,
        drag
          ? { isDragging: true, dragX: drag.x, dragY: drag.y }
          : { isDragging: false },
      );

      stateRef.current = result;
      posX.set(result.x);
      posY.set(result.y);

      if (result.sleeping) {
        setPhaseSafe("resting");
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [posX, posY, prefersReducedMotion, setPhaseSafe]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || phaseRef.current === "resting") return;

    if (phaseRef.current === "idle") {
      activateFromIdle();
    }

    draggingRef.current = true;
    applyDragPosition(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || phaseRef.current === "idle" || phaseRef.current === "resting") {
      return;
    }
    applyDragPosition(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;

    draggingRef.current = false;
    pointerRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const sizeClass =
    "h-[280px] w-[280px] sm:h-[360px] sm:w-[360px] lg:h-[440px] lg:w-[440px]";

  const face = (
    <BallSphere
      showFace
      lidScale={lidScale}
      mouthRadius={mouthRadius}
      mouthHeight={mouthHeight}
      mouthWidth={mouthWidth}
    />
  );

  if (prefersReducedMotion) {
    return (
      <div
        aria-hidden
        className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 ${sizeClass}`}
      >
        <div
          className="relative h-full w-full rounded-full"
          style={{ background: BALL_SURFACE, boxShadow: BALL_SHADOW }}
        />
      </div>
    );
  }

  if (phase === "idle") {
    return (
      <div
        aria-hidden
        className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 ${sizeClass}`}
      >
        <motion.div
          ref={ballRef}
          className="h-full w-full animate-[novaBounce_2.8s_ease-in-out_infinite] cursor-grab touch-none active:cursor-grabbing"
          style={{ ["--nova-amp" as string]: "10px" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {face}
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      ref={ballRef}
      aria-hidden
      className={`fixed left-0 top-0 z-50 ${sizeClass} ${
        phase === "resting" ? "cursor-default" : "cursor-grab touch-none active:cursor-grabbing"
      }`}
      style={{
        x: posX,
        y: posY,
        translateX: "-50%",
        translateY: "-50%",
        willChange: "transform",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {face}
    </motion.div>
  );
}
