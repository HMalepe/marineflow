import { motion, type MotionValue } from "framer-motion";
import { getSphereLighting } from "@/lib/ball-physics";

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
          background: getSphereLighting(0).background,
        }}
      />
    </div>
  );
}

type BallSphereProps = {
  showFace?: boolean;
  faceReveal?: number;
  faceHint?: number;
  rollAngle?: number;
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
  rollAngle = 0,
  lidScale,
  mouthRadius,
  mouthHeight,
  mouthWidth,
  compact = false,
}: BallSphereProps) {
  const reveal = showFace ? faceReveal : 0;
  const hint = showFace ? 0 : faceHint;
  const lighting = getSphereLighting(rollAngle, compact);

  return (
    <div
      className="@container relative h-full w-full overflow-hidden rounded-full"
      style={{
        background: lighting.background,
        boxShadow: lighting.boxShadow,
      }}
    >
      <div
        className="pointer-events-none absolute rounded-full bg-white/30 blur-[2px]"
        style={{
          width: lighting.specular.w,
          height: lighting.specular.h,
          left: lighting.specular.x,
          top: lighting.specular.y,
          transform: "translate(-50%, -50%)",
          opacity: lighting.specular.opacity,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background: lighting.rimGradient,
          opacity: 0.85,
        }}
        aria-hidden
      />

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
