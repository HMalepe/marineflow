import { animate, motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useCallback, useEffect, useState, type RefObject } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type BallProps = {
  lidScale: MotionValue<number>;
  mouthRadius: MotionValue<string>;
  mouthHeight: MotionValue<string>;
  mouthWidth: MotionValue<string>;
  bounceAmp: MotionValue<number>;
  reducedMotion?: boolean;
  isDragging?: boolean;
  isPressed?: boolean;
};

function Eye({ side, lidScale }: { side: "left" | "right"; lidScale: MotionValue<number> }) {
  const posClass = side === "left" ? "left-[26%]" : "right-[26%]";
  return (
    <div
      className={`absolute ${posClass} top-[38%] h-[60px] w-[60px] sm:h-[80px] sm:w-[80px] lg:h-[100px] lg:w-[100px]`}
    >
      <div className="absolute inset-0 flex items-center justify-center text-[60px] leading-none text-black sm:text-[80px] lg:text-[100px]">
        ✻
      </div>
      <motion.div
        className="absolute inset-0 origin-center rounded-full"
        style={{
          scaleY: lidScale,
          background:
            "radial-gradient(circle at 32% 28%, oklch(0.72 0.18 275) 0%, oklch(0.48 0.26 275) 55%, oklch(0.32 0.22 275) 100%)",
        }}
      />
    </div>
  );
}

function BallSphere({
  lidScale,
  mouthRadius,
  mouthHeight,
  mouthWidth,
}: Pick<BallProps, "lidScale" | "mouthRadius" | "mouthHeight" | "mouthWidth">) {
  return (
    <div
      className="relative h-full w-full rounded-full"
      style={{
        background:
          "radial-gradient(circle at 32% 28%, oklch(0.72 0.18 275) 0%, oklch(0.48 0.26 275) 55%, oklch(0.32 0.22 275) 100%)",
        boxShadow:
          "inset -40px -50px 80px oklch(0 0 0 / 0.35), 0 40px 80px oklch(0 0 0 / 0.25)",
      }}
    >
      <Eye side="left" lidScale={lidScale} />
      <Eye side="right" lidScale={lidScale} />
      <motion.div
        className="absolute left-1/2 top-[64%] -translate-x-1/2 bg-black"
        style={{ width: mouthWidth, height: mouthHeight, borderRadius: mouthRadius }}
      />
    </div>
  );
}

function BouncingBall({
  lidScale,
  mouthRadius,
  mouthHeight,
  mouthWidth,
  bounceAmp,
  reducedMotion,
  isDragging,
  isPressed,
}: BallProps) {
  const ampPx = useTransform(bounceAmp, (v) => `${v}px`);
  const animateBounce = !reducedMotion && !isDragging && !isPressed;

  return (
    <div
      className={`h-full w-full ${animateBounce ? "animate-[novaBounce_2.8s_ease-in-out_infinite]" : ""}`}
      style={animateBounce ? { ["--nova-amp" as string]: ampPx } : undefined}
    >
      <div
        className={`h-full w-full origin-bottom ${
          animateBounce ? "animate-[novaSquash_2.8s_ease-in-out_infinite]" : ""
        } ${isPressed ? "scale-x-[1.04] scale-y-[0.96]" : ""}`}
        style={{ transition: isPressed ? "transform 120ms ease-out" : undefined }}
      >
        <BallSphere
          lidScale={lidScale}
          mouthRadius={mouthRadius}
          mouthHeight={mouthHeight}
          mouthWidth={mouthWidth}
        />
      </div>
    </div>
  );
}

export function HeroFaceBall({
  compact,
  interactionRef,
}: {
  compact?: boolean;
  interactionRef: RefObject<HTMLElement | null>;
}) {
  const { scrollY } = useScroll();
  const { prefersReducedMotion } = useDeviceProfile();
  const [isDragging, setIsDragging] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const smoothX = useSpring(x, { stiffness: 220, damping: 28 });
  const smoothY = useSpring(y, { stiffness: 220, damping: 28 });

  const pointerLimit = compact ? 28 : 52;
  const dragLimit = compact ? 72 : 120;

  const resetPosition = useCallback(() => {
    animate(x, 0, { type: "spring", stiffness: 280, damping: 26 });
    animate(y, 0, { type: "spring", stiffness: 280, damping: 26 });
  }, [x, y]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (prefersReducedMotion || isDragging) return;
      const rect = interactionRef.current?.getBoundingClientRect();
      if (!rect) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const followStrength = compact ? 0.1 : 0.12;

      x.set(clamp((event.clientX - centerX) * followStrength, -pointerLimit, pointerLimit));
      y.set(clamp((event.clientY - centerY) * followStrength, -pointerLimit, pointerLimit));
    },
    [compact, interactionRef, isDragging, pointerLimit, prefersReducedMotion, x, y],
  );

  const handlePointerLeave = useCallback(() => {
    setIsPressed(false);
    if (!isDragging) resetPosition();
  }, [isDragging, resetPosition]);

  useEffect(() => {
    const target = interactionRef.current;
    if (!target || prefersReducedMotion) return;

    const onDown = () => setIsPressed(true);
    const onUp = () => setIsPressed(false);

    target.addEventListener("pointermove", handlePointerMove);
    target.addEventListener("pointerleave", handlePointerLeave);
    target.addEventListener("pointerdown", onDown);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);

    return () => {
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerleave", handlePointerLeave);
      target.removeEventListener("pointerdown", onDown);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
  }, [handlePointerLeave, handlePointerMove, interactionRef, prefersReducedMotion]);

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
  const bounceAmp = useTransform(scrollY, [0, 600], [8, 34]);

  const sizeClass = compact
    ? "h-[min(52vw,200px)] w-[min(52vw,200px)]"
    : "h-[280px] w-[280px] sm:h-[360px] sm:w-[360px] lg:h-[440px] lg:w-[440px]";

  return (
    <div
      aria-hidden
      className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 ${sizeClass}`}
    >
      <motion.div
        drag={prefersReducedMotion ? false : true}
        dragConstraints={{
          left: -dragLimit,
          right: dragLimit,
          top: -dragLimit,
          bottom: dragLimit,
        }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragStart={() => {
          setIsDragging(true);
          setIsPressed(true);
        }}
        onDragEnd={() => {
          setIsDragging(false);
          setIsPressed(false);
          resetPosition();
        }}
        style={{ x: isDragging ? x : smoothX, y: isDragging ? y : smoothY }}
        className={`h-full w-full ${
          prefersReducedMotion
            ? "pointer-events-none"
            : "pointer-events-auto cursor-grab touch-none active:cursor-grabbing"
        }`}
      >
        <BouncingBall
          lidScale={lidScale}
          mouthRadius={mouthRadius}
          mouthHeight={mouthHeight}
          mouthWidth={mouthWidth}
          bounceAmp={bounceAmp}
          reducedMotion={prefersReducedMotion}
          isDragging={isDragging}
          isPressed={isPressed}
        />
      </motion.div>
    </div>
  );
}
