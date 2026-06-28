import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { BallSphere } from "@/components/ball-sphere";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import {
  BALL_SHADOW,
  BALL_SURFACE,
  BASKETBALL_PHYSICS,
  clientToSectionLocal,
  getSectionBallBounds,
  stepBasketballPhysics,
  type PhysicsBallState,
} from "@/lib/ball-physics";

type Phase = "idle" | "simulating" | "resting";

const MIN_DIAMETER = 120;
const MAX_DIAMETER = 880;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDefaultDiameter() {
  if (typeof window === "undefined") return 280;
  if (window.matchMedia("(min-width: 1024px)").matches) return 440;
  if (window.matchMedia("(min-width: 640px)").matches) return 360;
  return 280;
}

export function HeroFaceBall({
  groundRef,
}: {
  groundRef: RefObject<HTMLElement | null>;
}) {
  const { scrollY } = useScroll();
  const { prefersReducedMotion } = useDeviceProfile();
  const ballRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const [diameter, setDiameter] = useState(getDefaultDiameter);
  const isHoveringRef = useRef(false);

  const posX = useMotionValue(0);
  const posY = useMotionValue(0);
  const stateRef = useRef<PhysicsBallState>({ x: 0, y: 0, vx: 0, vy: 0 });
  const draggingRef = useRef(false);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const radiusRef = useRef(diameter / 2);

  const readSectionBounds = useCallback(() => {
    const ground = groundRef.current;
    if (!ground) {
      return { width: 0, height: 0, bounds: getSectionBallBounds(0, 0, radiusRef.current) };
    }

    const width = ground.clientWidth;
    const height = ground.clientHeight;
    return {
      width,
      height,
      bounds: getSectionBallBounds(width, height, radiusRef.current),
    };
  }, [groundRef]);

  useEffect(() => {
    radiusRef.current = diameter / 2;
  }, [diameter]);

  useEffect(() => {
    if (phase !== "idle") return;
    const { width, height } = readSectionBounds();
    if (width <= 0 || height <= 0) return;

    const cx = width / 2;
    const cy = height * 0.44;
    stateRef.current = { x: cx, y: cy, vx: 0, vy: 0 };
    posX.set(cx);
    posY.set(cy);
  }, [phase, readSectionBounds, posX, posY]);

  useEffect(() => {
    if (phase === "idle") return;
    const { bounds } = readSectionBounds();
    const s = stateRef.current;
    const nx = clamp(s.x, bounds.minX, bounds.maxX);
    const ny = clamp(s.y, bounds.minY, bounds.maxY);
    if (nx !== s.x || ny !== s.y) {
      stateRef.current = { ...s, x: nx, y: ny };
      posX.set(nx);
      posY.set(ny);
    }
  }, [diameter, phase, readSectionBounds, posX, posY]);

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
    (localX: number, localY: number) => {
      const { bounds } = readSectionBounds();
      const px = clamp(localX, bounds.minX, bounds.maxX);
      const py = clamp(localY, bounds.minY, bounds.maxY);
      pointerRef.current = { x: px, y: py };
      stateRef.current = { ...stateRef.current, x: px, y: py };
      posX.set(px);
      posY.set(py);
    },
    [posX, posY, readSectionBounds],
  );

  const applyClientDrag = useCallback(
    (clientX: number, clientY: number) => {
      const ground = groundRef.current;
      if (!ground) return;
      const local = clientToSectionLocal(clientX, clientY, ground.getBoundingClientRect());
      applyDragPosition(local.x, local.y);
    },
    [applyDragPosition, groundRef],
  );

  const wakeBall = useCallback(() => {
    if (phaseRef.current === "resting") {
      setPhaseSafe("simulating");
    }
  }, [setPhaseSafe]);

  const activateFromIdle = useCallback(() => {
    const el = ballRef.current;
    const ground = groundRef.current;
    if (!el || !ground || phaseRef.current !== "idle") return;

    const ballRect = el.getBoundingClientRect();
    const groundRect = ground.getBoundingClientRect();
    const local = clientToSectionLocal(
      ballRect.left + ballRect.width / 2,
      ballRect.top + ballRect.height / 2,
      groundRect,
    );

    const nextDiameter = ballRect.width;
    setDiameter(nextDiameter);
    radiusRef.current = nextDiameter / 2;

    stateRef.current = { x: local.x, y: local.y, vx: 0, vy: 0 };
    posX.set(local.x);
    posY.set(local.y);
    setPhaseSafe("simulating");
  }, [groundRef, posX, posY, setPhaseSafe]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      if (phaseRef.current !== "simulating") return;

      const dt = now - last;
      last = now;

      const { bounds } = readSectionBounds();
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
  }, [posX, posY, prefersReducedMotion, readSectionBounds, setPhaseSafe]);

  useEffect(() => {
    const el = ballRef.current;
    if (!el || prefersReducedMotion) return;

    const onWheel = (event: WheelEvent) => {
      if (!isHoveringRef.current) return;
      event.preventDefault();

      const { width, height } = readSectionBounds();
      const max = Math.min(
        MAX_DIAMETER,
        Math.min(width, height) * 0.85 || MAX_DIAMETER,
      );

      setDiameter((prev) => {
        const next = clamp(prev + -event.deltaY * 0.35, MIN_DIAMETER, max);
        return next;
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [phase, prefersReducedMotion, readSectionBounds]);

  useEffect(() => {
    const onResize = () => {
      if (phaseRef.current === "idle") return;
      const { bounds } = readSectionBounds();
      const s = stateRef.current;
      const nx = clamp(s.x, bounds.minX, bounds.maxX);
      const ny = clamp(s.y, bounds.minY, bounds.maxY);
      if (nx !== s.x || ny !== s.y) {
        stateRef.current = { ...s, x: nx, y: ny };
        posX.set(nx);
        posY.set(ny);
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [posX, posY, readSectionBounds]);

  const handlePointerEnter = () => {
    isHoveringRef.current = true;
  };

  const handlePointerLeave = () => {
    isHoveringRef.current = false;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;

    if (phaseRef.current === "idle") {
      activateFromIdle();
    } else {
      wakeBall();
    }

    draggingRef.current = true;
    applyClientDrag(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || phaseRef.current === "idle") return;
    applyClientDrag(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;

    draggingRef.current = false;
    pointerRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const ballStyle = { width: diameter, height: diameter };

  const pointerHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    onPointerEnter: handlePointerEnter,
    onPointerLeave: handlePointerLeave,
  };

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
        className="pointer-events-none absolute left-1/2 top-[44%] z-10 -translate-x-1/2 -translate-y-1/2"
        style={ballStyle}
      >
        <div
          className="relative h-full w-full rounded-full"
          style={{ background: BALL_SURFACE, boxShadow: BALL_SHADOW }}
        />
      </div>
    );
  }

  return (
    <motion.div
      ref={ballRef}
      aria-hidden
      className={`absolute left-0 top-0 z-10 cursor-grab touch-none active:cursor-grabbing ${
        phase === "idle" ? "" : "z-20"
      }`}
      style={{
        ...ballStyle,
        x: posX,
        y: posY,
        translateX: "-50%",
        translateY: "-50%",
        willChange: "transform",
      }}
      {...pointerHandlers}
    >
      {phase === "idle" ? (
        <div
          className="h-full w-full animate-[novaBounce_2.8s_ease-in-out_infinite]"
          style={{ ["--nova-amp" as string]: "10px" }}
        >
          {face}
        </div>
      ) : (
        face
      )}
    </motion.div>
  );
}
