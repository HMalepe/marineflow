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
  AMBIENT_CYCLE,
  AMBIENT_PHYSICS,
  ambientRespawnImpulse,
  BALL_POSITION_SPRING,
  pickAmbientSpawn,
} from "@/lib/hero-ball-ambient-cycle";
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

type Phase = "entering" | "ambient" | "simulating";
type CyclePhase = "live" | "fading-out" | "dormant" | "fading-in";

const MIN_DIAMETER = Math.round(120 * HERO_BALL_SIZE_SCALE);
const MAX_DIAMETER = Math.round(880 * HERO_BALL_SIZE_SCALE);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isMobileHeroLayout() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function getDefaultDiameter() {
  if (typeof window === "undefined") return Math.round(240 * HERO_BALL_SIZE_SCALE);
  if (window.matchMedia("(min-width: 1024px)").matches) {
    return Math.round(440 * HERO_BALL_SIZE_SCALE);
  }
  if (window.matchMedia("(min-width: 768px)").matches) {
    return Math.round(360 * HERO_BALL_SIZE_SCALE);
  }
  if (isMobileHeroLayout()) {
    return Math.round(140 * HERO_BALL_SIZE_SCALE);
  }
  return Math.round(200 * HERO_BALL_SIZE_SCALE);
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
  const [phase, setPhase] = useState<Phase>(prefersReducedMotion ? "ambient" : "entering");
  const phaseRef = useRef<Phase>(prefersReducedMotion ? "ambient" : "entering");
  const cycleRef = useRef<CyclePhase>("live");
  const [diameter, setDiameter] = useState(getDefaultDiameter);
  const [faceReveal, setFaceReveal] = useState(prefersReducedMotion ? 1 : 0);
  const [faceHint, setFaceHint] = useState(0);
  const [rollAngle, setRollAngle] = useState(0);
  const isHoveringRef = useRef(false);
  const entranceStartedRef = useRef(false);
  const restSinceRef = useRef<number | null>(null);
  const dormantTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeControlsRef = useRef<ReturnType<typeof animate> | null>(null);

  const posX = useMotionValue(0);
  const posY = useMotionValue(0);
  const displayX = useSpring(posX, BALL_POSITION_SPRING);
  const displayY = useSpring(posY, BALL_POSITION_SPRING);
  const entranceSmile = useMotionValue(prefersReducedMotion ? 1 : 0);
  const ballPresence = useMotionValue(1);
  const squashValue = useMotionValue(1);
  const squashX = useSpring(useTransform(squashValue, (v) => 2 - v), { stiffness: 420, damping: 28 });
  const squashY = useSpring(squashValue, { stiffness: 420, damping: 28 });

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
    const bounds = getSectionBallBounds(width, height, radiusRef.current);

    if (!isMobileHeroLayout()) {
      return { width, height, bounds };
    }

    // Keep the hero ball in the upper band on mobile so copy stays readable.
    const ceiling = height * 0.32;
    return {
      width,
      height,
      bounds: {
        ...bounds,
        minY: Math.min(bounds.minY, height * 0.07),
        maxY: Math.min(bounds.maxY, ceiling),
      },
    };
  }, [groundRef]);

  useEffect(() => {
    radiusRef.current = diameter / 2;
  }, [diameter]);

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearDormantTimer = useCallback(() => {
    if (dormantTimerRef.current) {
      clearTimeout(dormantTimerRef.current);
      dormantTimerRef.current = null;
    }
  }, []);

  const stopFade = useCallback(() => {
    fadeControlsRef.current?.stop();
    fadeControlsRef.current = null;
  }, []);

  const interruptCycle = useCallback(() => {
    stopFade();
    clearDormantTimer();
    cycleRef.current = "live";
    restSinceRef.current = null;
    ballPresence.set(1);
  }, [ballPresence, clearDormantTimer, stopFade]);

  const beginFadeOut = useCallback(() => {
    if (cycleRef.current !== "live" || phaseRef.current === "simulating") return;

    cycleRef.current = "fading-out";
    restSinceRef.current = null;

    fadeControlsRef.current = animate(ballPresence, 0, {
      duration: AMBIENT_CYCLE.fadeOutMs / 1000,
      ease: [0.45, 0, 0.55, 1],
    });

    void fadeControlsRef.current.then(() => {
      if (cycleRef.current !== "fading-out") return;

      cycleRef.current = "dormant";
      const { width, bounds } = readSectionBounds();
      const spawn = pickAmbientSpawn(bounds, width);
      stateRef.current = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 };
      posX.set(spawn.x);
      posY.set(spawn.y);

      clearDormantTimer();
      dormantTimerRef.current = setTimeout(() => {
        if (cycleRef.current !== "dormant") return;

        cycleRef.current = "fading-in";
        fadeControlsRef.current = animate(ballPresence, 1, {
          duration: AMBIENT_CYCLE.fadeInMs / 1000,
          ease: [0.22, 1, 0.36, 1],
        });

        void fadeControlsRef.current.then(() => {
          if (cycleRef.current !== "fading-in") return;

          cycleRef.current = "live";
          restSinceRef.current = null;
          const impulse = ambientRespawnImpulse(width);
          const current = stateRef.current;
          stateRef.current = { ...current, ...impulse };
          setPhaseSafe("ambient");
        });
      }, AMBIENT_CYCLE.dormantMs);
    });
  }, [ballPresence, clearDormantTimer, posX, posY, readSectionBounds, setPhaseSafe]);

  const settleEntrance = useCallback(() => {
    const baseDiameter = getDefaultDiameter();
    setDiameter(baseDiameter);
    radiusRef.current = baseDiameter / 2;
    squashValue.set(1);

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

    interruptCycle();
    setPhaseSafe("ambient");
    restSinceRef.current = performance.now();
  }, [entranceSmile, interruptCycle, posX, posY, setPhaseSafe, squashValue]);

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

        const dt = Math.min(now - last, 24);
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
          squashValue.set(1 - impact * 0.1);
        } else {
          squashValue.set(squashValue.get() + (1 - squashValue.get()) * 0.16);
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
  }, [
    isPhone,
    posX,
    posY,
    prefersReducedMotion,
    readSectionBounds,
    settleEntrance,
    setPhaseSafe,
    squashValue,
  ]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let raf = 0;
    let last = performance.now();
    let prevX = stateRef.current.x;
    let prevY = stateRef.current.y;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const phase = phaseRef.current;
      const cycle = cycleRef.current;

      if (phase !== "ambient" && phase !== "simulating") return;
      if (phase === "ambient" && cycle !== "live") return;

      const dt = Math.min(now - last, 24);
      last = now;

      const { width, bounds } = readSectionBounds();
      const drag = phase === "simulating" && draggingRef.current ? pointerRef.current : null;
      const config = phase === "ambient" ? AMBIENT_PHYSICS : HERO_BALL_PHYSICS;

      const result = stepBasketballPhysics(stateRef.current, config, bounds, dt, drag
        ? { isDragging: true, dragX: drag.x, dragY: drag.y }
        : { isDragging: false });

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

      if (phase === "simulating" && result.sleeping) {
        interruptCycle();
        setPhaseSafe("ambient");
        restSinceRef.current = now;
        return;
      }

      if (phase === "ambient") {
        if (result.sleeping) {
          if (!restSinceRef.current) {
            restSinceRef.current = now;
          } else if (now - restSinceRef.current >= AMBIENT_CYCLE.restBeforeFadeMs) {
            beginFadeOut();
          }
        } else {
          restSinceRef.current = null;
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    beginFadeOut,
    interruptCycle,
    posX,
    posY,
    prefersReducedMotion,
    readSectionBounds,
    setPhaseSafe,
  ]);

  useEffect(() => {
    if (phase === "entering" || phase === "ambient") return;
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
    [0, 0.22, 0.5, 0.78, 1],
    [1, 0.92, 0.7, 0.42, 0.12],
  );
  const scrollPresence = useSpring(scrollPresenceRaw, { stiffness: 70, damping: 24 });
  const scrollScale = useSpring(
    useTransform(heroProgress, [0, 0.55, 1], [1, 0.96, 0.88]),
    { stiffness: 70, damping: 24 },
  );

  const presenceOpacity = useTransform(ballPresence, [0, 0.06, 1], [0, 0.08, 1]);
  const presenceScale = useTransform(ballPresence, [0, 1], [0.9, 1]);
  const presenceBlur = useTransform(ballPresence, [0, 0.35, 1], [6, 2.5, 0]);
  const presenceBrightness = useTransform(ballPresence, [0, 0.2, 0.55, 1], [0.18, 0.42, 0.72, 1]);
  const presenceSaturate = useTransform(ballPresence, [0, 0.25, 1], [0.25, 0.62, 1]);

  const cinematicOpacity = useTransform(
    [scrollPresence, presenceOpacity],
    ([scroll, presence]) => Number(scroll) * Number(presence),
  );
  const cinematicScale = useTransform(
    [scrollScale, presenceScale],
    ([scroll, presence]) => Number(scroll) * Number(presence),
  );
  const cinematicBlurPx = useTransform(
    [presenceBlur],
    ([blur]) => Math.min(10, Number(blur)),
  );
  const cinematicFilter = useMotionTemplate`blur(${cinematicBlurPx}px) brightness(${presenceBrightness}) saturate(${presenceSaturate})`;
  const shadowOpacity = useTransform(cinematicOpacity, (value) => Number(value) * 0.68);
  const glowOpacity = useTransform(cinematicOpacity, (value) => Number(value) * 0.5);

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

  const activateFromAmbient = useCallback(() => {
    const el = ballRef.current;
    const ground = groundRef.current;
    if (!el || !ground || phaseRef.current !== "ambient") return;
    if (cycleRef.current !== "live") return;

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
    interruptCycle();
    setPhaseSafe("simulating");
  }, [groundRef, interruptCycle, posX, posY, setPhaseSafe]);

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
    return () => {
      stopFade();
      clearDormantTimer();
    };
  }, [clearDormantTimer, stopFade]);

  useEffect(() => {
    const onResize = () => {
      if (phaseRef.current === "entering" || phaseRef.current === "ambient") return;
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

    if (phaseRef.current === "ambient") {
      if (cycleRef.current !== "live") return;
      activateFromAmbient();
    } else {
      interruptCycle();
      setPhaseSafe("simulating");
    }

    draggingRef.current = true;
    pointerSamplesRef.current = [];
    applyClientDrag(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || phaseRef.current === "ambient" || phaseRef.current === "entering") {
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
    interruptCycle();
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

  const showFullFace = faceReveal > 0.08 || phase !== "entering";
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
        className="pointer-events-none absolute left-1/2 z-[8] -translate-x-1/2 top-[14%] md:top-auto md:bottom-[10%]"
        style={ballStyle}
      >
        <div
          className="relative h-full w-full rounded-full"
          style={{ background: BALL_SURFACE, boxShadow: BALL_SHADOW }}
        />
      </div>
    );
  }

  const isInteractive = phase === "entering" || phase === "simulating";
  const ballLayerZ = isInteractive ? "z-[18]" : "z-[8]";

  return (
    <>
      <motion.div
        aria-hidden
        className={`hero-ball-ambient-glow pointer-events-none absolute left-0 top-0 ${ballLayerZ}`}
        style={{
          width: diameter * 1.35,
          height: diameter * 1.35,
          x: displayX,
          y: displayY,
          translateX: "-50%",
          translateY: "-50%",
          opacity: glowOpacity,
          scale: cinematicScale,
        }}
      />

      <motion.div
        aria-hidden
        className={`pointer-events-none absolute left-0 top-0 ${ballLayerZ}`}
        style={{
          width: diameter * 0.72,
          height: diameter * 0.14,
          x: displayX,
          y: displayY,
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
          x: displayX,
          y: displayY,
          translateX: "-50%",
          translateY: "-50%",
          opacity: cinematicOpacity,
          scale: cinematicScale,
          filter: cinematicFilter,
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
            scaleX: phase === "entering" ? squashX : 1,
            scaleY: phase === "entering" ? squashY : 1,
            willChange: "transform",
          }}
          {...pointerHandlers}
        >
          <div className="h-full w-full">{face}</div>
        </motion.div>
      </motion.div>
    </>
  );
}
