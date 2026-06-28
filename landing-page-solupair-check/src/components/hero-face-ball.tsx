import { motion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useDeviceProfile } from "@/hooks/use-device-profile";

type BallProps = {
  lidScale: MotionValue<number>;
  mouthRadius: MotionValue<string>;
  mouthHeight: MotionValue<string>;
  mouthWidth: MotionValue<string>;
  bounceAmp: MotionValue<number>;
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

function BouncingBall({ lidScale, mouthRadius, mouthHeight, mouthWidth, bounceAmp }: BallProps) {
  const ampPx = useTransform(bounceAmp, (v) => `${v}px`);
  return (
    <motion.div
      className="h-full w-full animate-[novaBounce_2.8s_ease-in-out_infinite]"
      style={{ ["--nova-amp" as string]: ampPx }}
    >
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
    </motion.div>
  );
}

/** Lovable commit 428e943 — Animated scroll reveal (canonical ball). */
export function HeroFaceBall() {
  const { scrollY } = useScroll();
  const { prefersReducedMotion } = useDeviceProfile();

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

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 sm:h-[360px] sm:w-[360px] lg:h-[440px] lg:w-[440px]"
    >
      {prefersReducedMotion ? (
        <div
          className="relative h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, oklch(0.72 0.18 275) 0%, oklch(0.48 0.26 275) 55%, oklch(0.32 0.22 275) 100%)",
            boxShadow:
              "inset -40px -50px 80px oklch(0 0 0 / 0.35), 0 40px 80px oklch(0 0 0 / 0.25)",
          }}
        />
      ) : (
        <BouncingBall
          lidScale={lidScale}
          mouthRadius={mouthRadius}
          mouthHeight={mouthHeight}
          mouthWidth={mouthWidth}
          bounceAmp={bounceAmp}
        />
      )}
    </div>
  );
}
