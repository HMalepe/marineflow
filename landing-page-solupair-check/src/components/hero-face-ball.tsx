import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { BallSphere } from "@/components/ball-sphere";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import {
  buildHeroEntrancePath,
  easeEntrance,
  faceHintFromRoll,
  faceRevealFromProgress,
  getEntranceDurationMs,
  rollDeltaFromMotion,
  sampleEntrancePath,
} from "@/lib/hero-ball-entrance";
import {
  BALL_SHADOW,
  BALL_SURFACE,
  BASKETBALL_PHYSICS,
  clientToSectionLocal,
  computeThrowVelocity,
  getSectionBallBounds,
  stepBasketballPhysics,
  type PhysicsBallState,
  type PointerSample,
} from "@/lib/ball-physics";

type Phase = "entering" | "idle" | "simulating" | "resting";

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
  const { prefersReducedMotion, isPhone } = useDeviceProfile();
  const ballRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>(prefersReducedMotion ? "idle" : "entering");
  const phaseRef = useRef<Phase>(prefersReducedMotion ? "idle" : "entering");
  const [diameter, setDiameter] = useState(getDefaultDiameter);
  const [faceReveal, setFaceReveal] = useState(prefersReducedMotion ? 1 : 0);
  const [faceHint, setFaceHint] = useState(0);
  const [rollAngle, setRollAngle] = useState(0);
  const isHoveringRef = useRef(false);
  const entranceStartedRef = useRef(false);

  const posX = useMotionValue(0);
  const posY = useMotionValue(0);
  const stateRef = useRef<PhysicsBallState>({ x: 0, y: 0, vx: 0, vy: 0 });
  const draggingRef = useRef(false);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const pointerSamplesRef = useRef<PointerSample[]>([]);
  const radiusRef = useRef(diameter / 2);
  const rollAngleRef = useRef(0);

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

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const landInCenter = useCallback(() => {
    const { width, height } = readSectionBounds();
    if (width <= 0 || height <= 0) return;

    const cx = width / 2;
    const cy = height * 0.36;
    stateRef.current = { x: cx, y: cy, vx: 0, vy: 0 };
    posX.set(cx);
    posY.set(cy);
    rollAngleRef.current = 0;
    setRollAngle(0);
    setFaceReveal(1);
    setFaceHint(0);
    setPhaseSafe("idle");
  }, [posX, posY, readSectionBounds, setPhaseSafe]);

  useEffect(() => {
    if (prefersReducedMotion || entranceStartedRef.current) return;
    entranceStartedRef.current = true;

    let raf = 0;
    let cancelled = false;

    const run = () => {
      const { width, height } = readSectionBounds();
      if (width <= 0 || height <= 0) {
        raf = requestAnimationFrame(run);
        return;
      }

      const baseDiameter = getDefaultDiameter();
      const entranceDiameter = baseDiameter * 0.84;
      setDiameter(entranceDiameter);
      radiusRef.current = entranceDiameter / 2;

      const path = buildHeroEntrancePath(width, height, radiusRef.current);
      if (path.length === 0) {
        landInCenter();
        return;
      }

      const duration = getEntranceDurationMs(isPhone);
      const startTime = performance.now();
      let prevX = path[0].x;
      let prevY = path[0].y;

      posX.set(prevX);
      posY.set(prevY);
      rollAngleRef.current = 0;
      setRollAngle(0);
      setPhaseSafe("entering");

      const tick = (now: number) => {
        if (cancelled || phaseRef.current !== "entering") return;

        const rawT = (now - startTime) / duration;

        if (rawT >= 1) {
          setDiameter(baseDiameter);
          radiusRef.current = baseDiameter / 2;
          landInCenter();
          return;
        }

        const eased = easeEntrance(rawT);
        const sample = sampleEntrancePath(path, eased);
        const nx = sample.x;
        const ny = sample.y;

        const dx = nx - prevX;
        const dy = ny - prevY;
        rollAngleRef.current += rollDeltaFromMotion(dx, dy, radiusRef.current);

        prevX = nx;
        prevY = ny;

        posX.set(nx);
        posY.set(ny);
        setRollAngle(rollAngleRef.current);

        const grow = 0.84 + eased * 0.16;
        setDiameter(baseDiameter * grow);

        setFaceReveal(faceRevealFromProgress(eased));
        setFaceHint(faceHintFromRoll(rollAngleRef.current, eased));

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(run);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isPhone, landInCenter, posX, posY, prefersReducedMotion, readSectionBounds, setPhaseSafe]);

  useEffect(() => {
    if (phase !== "idle") return;
    const { width, height } = readSectionBounds();
    if (width <= 0 || height <= 0) return;

    const cx = width / 2;
    const cy = height * 0.36;
    stateRef.current = { x: cx, y: cy, vx: 0, vy: 0 };
    posX.set(cx);
    posY.set(cy);
  }, [phase, readSectionBounds, posX, posY]);

  useEffect(() => {
    if (phase === "idle" || phase === "entering") return;
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

  const recordPointerSample = useCallback((localX: number, localY: number) => {
    const now = performance.now();
    pointerSamplesRef.current.push({ x: localX, y: localY, t: now });
    if (pointerSamplesRef.current.length > 28) {
      pointerSamplesRef.current = pointerSamplesRef.current.slice(-28);
    }
  }, []);

  const applyDragPosition = useCallback(
    (localX: number, localY: number) => {
      const { bounds } = readSectionBounds();
      const px = clamp(localX, bounds.minX, bounds.maxX);
      const py = clamp(localY, bounds.minY, bounds.maxY);
      const prev = stateRef.current;
      const dx = px - prev.x;
      const dy = py - prev.y;
      rollAngleRef.current += rollDeltaFromMotion(dx, dy, radiusRef.current);
      setRollAngle(rollAngleRef.current);

      pointerRef.current = { x: px, y: py };
      recordPointerSample(px, py);
      stateRef.current = { ...prev, x: px, y: py };
      posX.set(px);
      posY.set(py);
    },
    [posX, posY, readSectionBounds, recordPointerSample],
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
    setFaceReveal(1);
    setFaceHint(0);
    setPhaseSafe("simulating");
  }, [groundRef, posX, posY, setPhaseSafe]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let raf = 0;
    let last = performance.now();
    let prevX = stateRef.current.x;
    let prevY = stateRef.current.y;

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

      const dx = result.x - prevX;
      const dy = result.y - prevY;
      if (!drag) {
        rollAngleRef.current += rollDeltaFromMotion(dx, dy, radiusRef.current);
        setRollAngle(rollAngleRef.current);
      }

      prevX = result.x;
      prevY = result.y;
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
      if (phaseRef.current === "entering") return;
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

    if (phaseRef.current === "entering") {
      setDiameter(getDefaultDiameter());
      landInCenter();
      return;
    }

    if (phaseRef.current === "idle") {
      activateFromIdle();
    } else {
      wakeBall();
    }

    draggingRef.current = true;
    pointerSamplesRef.current = [];
    applyClientDrag(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || phaseRef.current === "idle" || phaseRef.current === "entering") return;
    applyClientDrag(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;

    const throwVel = computeThrowVelocity(
      pointerSamplesRef.current,
      BASKETBALL_PHYSICS.maxSpeed,
    );
    const current = stateRef.current;
    stateRef.current = {
      x: current.x,
      y: current.y,
      vx: throwVel.vx,
      vy: throwVel.vy,
    };

    draggingRef.current = false;
    pointerRef.current = null;
    pointerSamplesRef.current = [];
    setPhaseSafe("simulating");

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const ballStyle = { width: diameter, height: diameter };
  const radius = diameter / 2;

  const pointerHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    onPointerEnter: handlePointerEnter,
    onPointerLeave: handlePointerLeave,
  };

  const showFullFace = faceReveal > 0.08;
  const face = (
    <BallSphere
      showFace={showFullFace}
      faceReveal={faceReveal}
      faceHint={faceHint}
      rollAngle={rollAngle}
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
        className="pointer-events-none absolute left-1/2 top-[36%] z-10 -translate-x-1/2 -translate-y-1/2"
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
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-[5]"
        style={{
          width: diameter * 0.72,
          height: diameter * 0.14,
          x: posX,
          y: posY,
          translateX: "-50%",
          translateY: radius * 0.92,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, oklch(0 0 0 / 0.28) 0%, oklch(0 0 0 / 0) 72%)",
          filter: "blur(10px)",
          opacity: phase === "entering" ? 0.55 : 0.7,
        }}
      />

      <motion.div
        ref={ballRef}
        aria-hidden
        className={`absolute left-0 top-0 ${
          phase === "entering" ? "z-30 cursor-default" : "cursor-grab active:cursor-grabbing"
        } ${phase === "idle" ? "z-10" : "z-30"} touch-none`}
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
          <div className="h-full w-full">{face}</div>
        )}
      </motion.div>
    </>
  );
}
