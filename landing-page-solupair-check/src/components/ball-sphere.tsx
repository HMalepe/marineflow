import { motion, type MotionValue } from "framer-motion";
import { BALL_SHADOW, BALL_SURFACE } from "@/lib/ball-physics";

function Eye({ side, lidScale }: { side: "left" | "right"; lidScale: MotionValue<number> }) {
  const posClass = side === "left" ? "left-[26%]" : "right-[26%]";
  return (
    <div className={`absolute ${posClass} top-[38%] aspect-square w-[22cqmin]`}>
      <div className="absolute inset-0 flex items-center justify-center text-[18cqmin] leading-none text-black">
        ✻
      </div>
      <motion.div
        className="absolute inset-0 origin-center rounded-full"
        style={{
          scaleY: lidScale,
          background: BALL_SURFACE,
        }}
      />
    </div>
  );
}

type BallSphereProps = {
  showFace?: boolean;
  lidScale?: MotionValue<number>;
  mouthRadius?: MotionValue<string>;
  mouthHeight?: MotionValue<string>;
  mouthWidth?: MotionValue<string>;
  compact?: boolean;
};

export function BallSphere({
  showFace = false,
  lidScale,
  mouthRadius,
  mouthHeight,
  mouthWidth,
  compact = false,
}: BallSphereProps) {
  return (
    <div
      className="@container relative h-full w-full rounded-full"
      style={{
        background: BALL_SURFACE,
        boxShadow: compact
          ? "inset -16px -20px 32px oklch(0 0 0 / 0.35), 0 16px 32px oklch(0 0 0 / 0.22)"
          : BALL_SHADOW,
      }}
    >
      {showFace && lidScale && mouthRadius && mouthHeight && mouthWidth && (
        <>
          <Eye side="left" lidScale={lidScale} />
          <Eye side="right" lidScale={lidScale} />
          <motion.div
            className="absolute left-1/2 top-[64%] -translate-x-1/2 bg-black"
            style={{ width: mouthWidth, height: mouthHeight, borderRadius: mouthRadius }}
          />
        </>
      )}
    </div>
  );
}
