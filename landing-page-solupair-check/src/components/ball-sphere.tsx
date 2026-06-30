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
  faceReveal?: number;
  faceHint?: number;
  lidScale?: MotionValue<number>;
  mouthRadius?: MotionValue<string>;
  mouthHeight?: MotionValue<string>;
  mouthWidth?: MotionValue<string>;
  compact?: boolean;
};

export function BallSphere({
  showFace = false,
  faceReveal = 1,
  faceHint = 0,
  lidScale,
  mouthRadius,
  mouthHeight,
  mouthWidth,
  compact = false,
}: BallSphereProps) {
  const reveal = showFace ? faceReveal : 0;
  const hint = showFace ? 0 : faceHint;

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
      {hint > 0.02 && (
        <div
          className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-75"
          style={{ opacity: hint }}
          aria-hidden
        >
          <div className="absolute left-[28%] top-[39%] h-[3cqmin] w-[3cqmin] rounded-full bg-black/35 blur-[1px]" />
          <div className="absolute right-[28%] top-[39%] h-[3cqmin] w-[3cqmin] rounded-full bg-black/35 blur-[1px]" />
          <div className="absolute left-1/2 top-[57%] h-[1.5cqmin] w-[14cqmin] -translate-x-1/2 rounded-full bg-black/20 blur-[0.5px]" />
        </div>
      )}

      {showFace && lidScale && mouthRadius && mouthHeight && mouthWidth && (
        <div
          className="absolute inset-0 rounded-full"
          style={{ opacity: reveal, transition: "opacity 0.12s linear" }}
        >
          <Eye side="left" lidScale={lidScale} />
          <Eye side="right" lidScale={lidScale} />
          <motion.div
            className="absolute left-1/2 top-[64%] -translate-x-1/2 bg-black"
            style={{ width: mouthWidth, height: mouthHeight, borderRadius: mouthRadius }}
          />
        </div>
      )}
    </div>
  );
}
