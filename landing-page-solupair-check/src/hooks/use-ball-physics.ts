import { useMotionValue } from "framer-motion";
import { useEffect, useRef } from "react";
import {
  stepBallPhysics,
  type DriftConfig,
  type PhysicsBallState,
  type PhysicsBounds,
  type PhysicsConfig,
} from "@/lib/ball-physics";

type UseBallPhysicsOptions = {
  enabled: boolean;
  config: PhysicsConfig;
  bounds: PhysicsBounds;
  drift?: DriftConfig;
  getHoverNudge?: () => { x: number; y: number } | undefined;
};

export function useBallPhysics({
  enabled,
  config,
  bounds,
  drift,
  getHoverNudge,
}: UseBallPhysicsOptions) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const stateRef = useRef<PhysicsBallState>({ x: 0, y: 0, vx: 0, vy: 0 });
  const draggingRef = useRef(false);
  const dragTargetRef = useRef({ x: 0, y: 0 });
  const driftTimeRef = useRef(0);
  const configRef = useRef(config);
  const boundsRef = useRef(bounds);
  const driftRef = useRef(drift);
  const hoverRef = useRef(getHoverNudge);

  configRef.current = config;
  boundsRef.current = bounds;
  driftRef.current = drift;
  hoverRef.current = getHoverNudge;

  useEffect(() => {
    if (!enabled) {
      stateRef.current = { x: 0, y: 0, vx: 0, vy: 0 };
      x.set(0);
      y.set(0);
      return;
    }

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      driftTimeRef.current += dt / 1000;

      const next = stepBallPhysics(stateRef.current, configRef.current, boundsRef.current, dt, {
        isDragging: draggingRef.current,
        dragX: dragTargetRef.current.x,
        dragY: dragTargetRef.current.y,
        drift: driftRef.current,
        driftTime: driftTimeRef.current,
        hoverNudge: hoverRef.current?.(),
      });

      stateRef.current = next;
      x.set(next.x);
      y.set(next.y);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, x, y]);

  const setDragTarget = (px: number, py: number) => {
    dragTargetRef.current = { x: px, y: py };
  };

  const setDragging = (value: boolean) => {
    draggingRef.current = value;
    if (!value) {
      const { x: px, y: py } = dragTargetRef.current;
      stateRef.current = {
        ...stateRef.current,
        x: px,
        y: py,
        vx: (px - stateRef.current.x) * 8,
        vy: (py - stateRef.current.y) * 8,
      };
    }
  };

  return { x, y, setDragTarget, setDragging };
}
