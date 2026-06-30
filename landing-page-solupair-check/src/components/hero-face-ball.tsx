import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { BallSphere } from "@/components/ball-sphere";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import {
  ENTRANCE_PHYSICS,
  faceHintFromRoll,
  getEntranceInitialState,
  getEntranceMaxDurationMs,
  HERO_BALL_PHYSICS,
  HERO_BALL_SIZE_SCALE,
  rollDeltaFromMotion,
} from "@/lib/hero-ball-entrance";
import {
  BALL_SHADOW,
  BALL_SURFACE,
  clientToSectionLocal,
  computeThrowVelocity,
  getSectionBallBounds,
  stepBasketballPhysics,
  type PhysicsBallState,
  type PointerSample,
} from "@/lib/ball-physics";

type Phase = "entering" | "idle" | "simulating" | "resting";

const MIN_DIAMETER = Math.round(120 * HERO_BALL_SIZE_SCALE);
const MAX_DIAMETER = Math.round(880 * HERO_BALL_SIZE_SCALE);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDefaultDiameter() {
  if (typeof window === "undefined") return Math.round(280 * HERO_BALL_SIZE_SCALE);
  if (window.matchMedia("(min-width: 1024px)").matches) {
    return Math.round(440 * HERO_BALL_SIZE_SCALE);
  }
  if (window.matchMedia("(min-width: 640px)").matches) {
    return Math.round(360 * HERO_BALL_SIZE_SCALE);
  }
  return Math.round(280 * HERO_BALL_SIZE_SCALE);
}

export function HeroFaceBall({
  groundRef,
}: {
  groundRef: RefObject<HTMLElement | null>;
}) {
  const { scrollY } = useScroll();
  const { scrollYProgress: heroProgress } = useScroll({
    target: groundRef,
    offset: ["start start", "end start"],
  });
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
  const entranceSmile = useMotionValue(prefersReducedMotion ? 1 : 0);
  const cinematicDepth = useMotionValue(0);
  const breathControlsRef = useRef<ReturnType<typeof animate> | null>(null);
  const stateRef = useRef<PhysicsBallState>({ x: 0, y: 0, vx: 0, vy: 0 });
  const draggingRef = useRef(false);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const pointerSamplesRef = useRef<PointerSample[]>([]);
  const radiusRef = useRef(diameter / 2);
  const rollAngleRef = useRef(0);
  const [squash, setSquash] = useState(1);

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

  const stopIdleBreath = useCallback(() => {
    breathControlsRef.current?.stop();
    breathControlsRef.current = null;
  }, []);

  const startIdleBreath = useCallback(() => {
    stopIdleBreath();
    breathControlsRef.current = animate(cinematicDepth, [0.3, 0.46, 0.3], {
      duration: 6.2,
      repeat: Infinity,
      ease: "easeInOut",
    });
  }, [cinematicDepth, stopIdleBreath]);

  const recedeToBackground = useCallback(() => {
    stopIdleBreath();
    void animate(cinematicDepth, 0.38, {
      duration: 1.35,
      ease: [0.22, 1, 0.36, 1],
    }).then(() => {
      if (phaseRef.current === "idle" || phaseRef.current === "resting") {
        startIdleBreath();
      }
    });
  }, [cinematicDepth, startIdleBreath, stopIdleBreath]);

  const emergeFromBackground = useCallback(() => {
    stopIdleBreath();
    void animate(cinematicDepth, 0, { duration: 0.5, ease: [0.22, 1, 0.36, 1] });
  }, [cinematicDepth, stopIdleBreath]);

  const settleEntrance = useCallback(() => {
    const baseDiameter = getDefaultDiameter();
    setDiameter(baseDiameter);
    radiusRef.current = baseDiameter / 2;
    setSquash(1);

    const s = stateRef.current;
    stateRef.current = { x: s.x, y: s.y, vx: 0, vy: 0 };
    posX.set(s.x);
    posY.set(s.y);

    setFaceReveal(1);
    setFaceHint(0);
    void animate(entranceSmile, 1, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
    });
    setPhaseSafe("idle");
    recedeToBackground();
  }, [entranceSmile, posX, posY, recedeToBackground, setPhaseSafe]);

  useEffect(() => {
    if (prefersReducedMotion || entranceStartedRef.current) return;
    entranceStartedRef.current = true;

    let raf = 0;
    let cancelled = false;
    let last = performance.now();
    const startTime = performance.now();
    const maxDuration = getEntranceMaxDurationMs(isPhone);
    const baseDiameter = getDefaultDiameter();

    const boot = () => {
      const { width, height } = readSectionBounds();
      if (width <= 0 || height <= 0) {
        raf = requestAnimationFrame(boot);
        return;
      }

      const entranceDiameter = baseDiameter * 0.9;
      setDiameter(entranceDiameter);
      radiusRef.current = entranceDiameter / 2;

      const initial = getEntranceInitialState(width, height, radiusRef.current);
      stateRef.current = initial;
      posX.set(initial.x);
      posY.set(initial.y);
      rollAngleRef.current = 0;
      setRollAngle(0);
      setPhaseSafe("entering");

      const tick = (now: number) => {
        if (cancelled || phaseRef.current !== "entering") return;

        if (now - startTime > maxDuration) {
          settleEntrance();
          return;
        }

        const dt = Math.min(now - last, 32);
        last = now;

        const { bounds } = readSectionBounds();
        const prev = stateRef.current;
        const result = stepBasketballPhysics(prev, ENTRANCE_PHYSICS, bounds, dt, {
          isDragging: false,
        });

        const dx = result.x - prev.x;
        const dy = result.y - prev.y;
        rollAngleRef.current += rollDeltaFromMotion(dx, dy, radiusRef.current);
        setRollAngle(rollAngleRef.current);

        const hitRightWall =
          prev.x < bounds.maxX - 2 && result.x >= bounds.maxX - 2 && prev.vx > 0;
        const hitLeftWall =
          prev.x > bounds.minX + 2 && result.x <= bounds.minX + 2 && prev.vx < 0;
        const hitFloor =
          prev.y < bounds.maxY - 2 && result.y >= bounds.maxY - 2 && prev.vy > 0;

        if (hitRightWall || hitLeftWall || hitFloor) {
          const impact = Math.min(1, Math.hypot(prev.vx, prev.vy) / 2000);
          setSquash(1 - impact * 0.12);
        } else {
          setSquash((current) => current + (1 - current) * 0.2);
        }

        const elapsed = (now - startTime) / maxDuration;
        setFaceHint(faceHintFromRoll(rollAngleRef.current, false));
        setDiameter(baseDiameter * (0.9 + Math.min(1, elapsed) * 0.1));

        stateRef.current = result;
        posX.set(result.x);
        posY.set(result.y);

        if (result.sleeping) {
          settleEntrance();
          return;
        }

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(boot);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isPhone, posX, posY, prefersReducedMotion, readSectionBounds, settleEntrance, setPhaseSafe]);

  useEffect(() => {
    if (prefersReducedMotion || phase !== "idle") return;

    const { width, height, bounds } = readSectionBounds();
    if (width <= 0 || height <= 0) return;

    const cx = width / 2;
    const cy = bounds.maxY;
    stateRef.current = { x: cx, y: cy, vx: 0, vy: 0 };
    posX.set(cx);
    posY.set(cy);
  }, [phase, prefersReducedMotion, readSectionBounds, posX, posY]);

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

  const scrollSmileRaw = useTransform(scrollY, [180, 520], [0, 1]);
  const combinedSmile = useTransform([entranceSmile, scrollSmileRaw], ([entrance, scroll]) =>
    Math.max(Number(entrance), Number(scroll)),
  );
  const smile = useSpring(combinedSmile, { stiffness: 140, damping: 22 });

  const lidRaw = useTransform(scrollY, [0, 220], [1, 0]);
  const lidScale = useSpring(lidRaw, { stiffness: 140, damping: 22 });

  const scrollPresenceRaw = useTransform(
    heroProgress,
    [0, 0.18, 0.42, 0.68, 1],
    [1, 0.94, 0.72, 0.44, 0.14],
  );
  const scrollPresence = useSpring(scrollPresenceRaw, { stiffness: 80, damping: 22 });
  const scrollScale = useSpring(
    useTransform(heroProgress, [0, 0.55, 1], [1, 0.96, 0.88]),
    { stiffness: 80, damping: 22 },
  );
  const scrollBlur = useTransform(heroProgress, [0, 0.45, 1], [0, 1.5, 4]);

  const depthOpacity = useTransform(cinematicDepth, [0, 0.5], [1, 0.55]);
  const depthScale = useTransform(cinematicDepth, [0, 0.5], [1, 0.93]);
  const depthBlur = useTransform(cinematicDepth, [0, 0.5], [0, 2.5]);

  const cinematicOpacity = useTransform(
    [scrollPresence, depthOpacity],
    ([scroll, depth]) => Number(scroll) * Number(depth),
  );
  const cinematicScale = useTransform(
    [scrollScale, depthScale],
    ([scroll, depth]) => Number(scroll) * Number(depth),
  );
  const cinematicBlurPx = useTransform(
    [scrollBlur, depthBlur],
    ([scroll, depth]) => Math.min(8, Number(scroll) + Number(depth)),
  );
  const cinematicBlur = useMotionTemplate`blur(${cinematicBlurPx}px)`;
  const shadowOpacity = useTransform(cinematicOpacity, (value) => Number(value) * 0.72);
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
      emergeFromBackground();
      setPhaseSafe("simulating");
    }
  }, [emergeFromBackground, setPhaseSafe]);

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
    emergeFromBackground();
    setPhaseSafe("simulating");
  }, [emergeFromBackground, groundRef, posX, posY, setPhaseSafe]);

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
        HERO_BALL_PHYSICS,
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
        recedeToBackground();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [posX, posY, prefersReducedMotion, readSectionBounds, recedeToBackground, setPhaseSafe]);

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
    return () => stopIdleBreath();
  }, [stopIdleBreath]);

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
      settleEntrance();
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
    if (!draggingRef.current || phaseRef.current === "idle" || phaseRef.current === "entering") {
      return;
    }
    applyClientDrag(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;

    const throwVel = computeThrowVelocity(
      pointerSamplesRef.current,
      HERO_BALL_PHYSICS.maxSpeed,
      1.05,
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
  const squashY = phase === "entering" ? squash : 1;
  const squashX = phase === "entering" ? 2 - squash : 1;

  const pointerHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    onPointerEnter: handlePointerEnter,
    onPointerLeave: handlePointerLeave,
  };

  const showFullFace = faceReveal > 0.08 || phase === "idle";
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
        className="pointer-events-none absolute bottom-[10%] left-1/2 z-10 -translate-x-1/2"
        style={ballStyle}
      >
        <div
          className="relative h-full w-full rounded-full"
          style={{ background: BALL_SURFACE, boxShadow: BALL_SHADOW }}
        />
      </div>
    );
  }

  const ballLayerZ =
    phase === "entering" || phase === "simulating" || phase === "resting" ? "z-[18]" : "z-[8]";

  return (
    <>
      <motion.div
        aria-hidden
        className={`pointer-events-none absolute left-0 top-0 ${ballLayerZ}`}
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
          opacity: shadowOpacity,
          scale: cinematicScale,
        }}
      />

      <motion.div
        aria-hidden
        className={`pointer-events-none absolute left-0 top-0 ${ballLayerZ} touch-none`}
        style={{
          x: posX,
          y: posY,
          translateX: "-50%",
          translateY: "-50%",
          opacity: cinematicOpacity,
          scale: cinematicScale,
          filter: cinematicBlur,
          willChange: "transform, opacity, filter",
        }}
      >
        <motion.div
          ref={ballRef}
          className={
            phase === "entering"
              ? "pointer-events-auto cursor-default"
              : "pointer-events-auto cursor-grab active:cursor-grabbing"
          }
          style={{
            ...ballStyle,
            scaleX: squashX,
            scaleY: squashY,
            willChange: "transform",
          }}
          {...pointerHandlers}
        >
          {phase === "idle" || phase === "resting" ? (
            <div
              className="h-full w-full animate-[novaBounce_2.8s_ease-in-out_infinite]"
              style={{ ["--nova-amp" as string]: "8px" }}
            >
              {face}
            </div>
          ) : (
            <div className="h-full w-full">{face}</div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
