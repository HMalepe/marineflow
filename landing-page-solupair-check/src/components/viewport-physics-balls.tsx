import { motion } from "framer-motion";
import { useMemo } from "react";
import { BallSphere } from "@/components/ball-sphere";
import { useBallPhysics } from "@/hooks/use-ball-physics";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import { VIEWPORT_PHYSICS, type DriftConfig } from "@/lib/ball-physics";

type AmbientBallProps = {
  size: number;
  drift: DriftConfig;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  className?: string;
};

function AmbientBlurBall({ size, drift, bounds, className }: AmbientBallProps) {
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
      className={`pointer-events-none absolute z-0 ${className ?? ""}`}
      style={{ width: size, height: size, x, y, willChange: "transform" }}
    >
      <div className="h-full w-full scale-110 blur-[40px] sm:blur-[56px] lg:blur-[72px]">
        <BallSphere compact />
      </div>
    </motion.div>
  );
}

/** One soft blue blur orb per dark section (Projects + Contact). */
export function ViewportPhysicsBalls({ variant }: { variant: "projects" | "contact" }) {
  const { isPhone, isDesktop, prefersReducedMotion } = useDeviceProfile();

  const size = isDesktop ? 240 : 180;
  const travel = isDesktop ? 72 : 52;

  const bounds = useMemo(
    () => ({
      minX: -travel,
      maxX: travel,
      minY: -travel,
      maxY: travel,
    }),
    [travel],
  );

  const config = useMemo(() => {
    if (variant === "projects") {
      return {
        className: "left-[2%] top-[8%] opacity-50 sm:left-[4%] sm:top-[10%] sm:opacity-55",
        drift: {
          amplitudeX: travel * 0.9,
          amplitudeY: travel * 0.75,
          frequencyX: 0.42,
          frequencyY: 0.36,
          phaseX: 0.2,
          phaseY: 1.1,
        } satisfies DriftConfig,
      };
    }

    return {
      className: "right-[2%] top-[6%] opacity-45 sm:right-[6%] sm:top-[8%] sm:opacity-50",
      drift: {
        amplitudeX: travel * 0.85,
        amplitudeY: travel * 0.7,
        frequencyX: 0.38,
        frequencyY: 0.44,
        phaseX: 1.8,
        phaseY: 2.2,
      } satisfies DriftConfig,
    };
  }, [travel, variant]);

  if (isPhone || prefersReducedMotion) return null;

  return (
    <AmbientBlurBall size={size} drift={config.drift} bounds={bounds} className={config.className} />
  );
}
