import { motion } from "framer-motion";
import { useMemo } from "react";
import { BallSphere } from "@/components/ball-sphere";
import { useBallPhysics } from "@/hooks/use-ball-physics";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import { VIEWPORT_PHYSICS, type DriftConfig } from "@/lib/ball-physics";

type ViewportBallProps = {
  size: number;
  drift: DriftConfig;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  className?: string;
};

function ViewportBall({ size, drift, bounds, className }: ViewportBallProps) {
  const { prefersReducedMotion } = useDeviceProfile();
  const { x, y } = useBallPhysics({
    enabled: !prefersReducedMotion,
    config: VIEWPORT_PHYSICS,
    bounds,
    drift,
  });

  if (prefersReducedMotion) return null;

  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute ${className ?? ""}`}
      style={{ width: size, height: size, x, y, willChange: "transform" }}
    >
      <BallSphere compact />
    </motion.div>
  );
}

/** Ambient physics balls — one pair per section (projects + contact). */
export function ViewportPhysicsBalls({ variant }: { variant: "projects" | "contact" }) {
  const { isPhone, isDesktop } = useDeviceProfile();
  const size = isPhone ? 52 : isDesktop ? 88 : 68;
  const travel = isPhone ? 22 : isDesktop ? 44 : 32;

  const bounds = useMemo(
    () => ({
      minX: -travel,
      maxX: travel,
      minY: -travel,
      maxY: travel,
    }),
    [travel],
  );

  const configs = useMemo(() => {
    if (variant === "projects") {
      return [
        {
          className: "left-[4%] top-[12%] opacity-70 sm:left-[6%] sm:top-[14%]",
          drift: {
            amplitudeX: travel * 0.85,
            amplitudeY: travel * 0.65,
            frequencyX: 0.42,
            frequencyY: 0.36,
            phaseX: 0.2,
            phaseY: 1.1,
          } satisfies DriftConfig,
        },
        {
          className: "right-[5%] bottom-[18%] opacity-55 sm:right-[8%] sm:bottom-[20%]",
          drift: {
            amplitudeX: travel * 0.75,
            amplitudeY: travel * 0.9,
            frequencyX: 0.55,
            frequencyY: 0.48,
            phaseX: 2.4,
            phaseY: 0.6,
          } satisfies DriftConfig,
        },
      ];
    }

    return [
      {
        className: "left-[6%] top-[8%] opacity-60 sm:left-[10%]",
        drift: {
          amplitudeX: travel * 0.7,
          amplitudeY: travel * 0.8,
          frequencyX: 0.38,
          frequencyY: 0.44,
          phaseX: 1.8,
          phaseY: 2.2,
        } satisfies DriftConfig,
      },
      {
        className: "right-[4%] top-[28%] opacity-50 sm:right-[12%] sm:top-[32%]",
        drift: {
          amplitudeX: travel * 0.9,
          amplitudeY: travel * 0.55,
          frequencyX: 0.5,
          frequencyY: 0.33,
          phaseX: 0.9,
          phaseY: 3.1,
        } satisfies DriftConfig,
      },
    ];
  }, [travel, variant]);

  return (
    <>
      {configs.map((ball) => (
        <ViewportBall
          key={`${variant}-${ball.className}`}
          size={size}
          drift={ball.drift}
          bounds={bounds}
          className={ball.className}
        />
      ))}
    </>
  );
}
