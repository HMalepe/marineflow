import type { BasketballConfig, PhysicsBallState, PhysicsBounds } from "@/lib/ball-physics";

/** Gentle hero drift — high damping so bounces decay smoothly before the dissolve. */
export const AMBIENT_PHYSICS: BasketballConfig = {
  gravity: 1580,
  restitution: 0.8,
  wallRestitution: 0.84,
  airFriction: 0.9991,
  floorFriction: 0.9,
  maxSpeed: 1500,
  sleepSpeed: 6,
};

export const AMBIENT_CYCLE = {
  restBeforeFadeMs: 1600,
  fadeOutMs: 3400,
  dormantMs: 2000,
  fadeInMs: 3800,
} as const;

export function pickAmbientSpawn(bounds: PhysicsBounds, width: number): Pick<PhysicsBallState, "x" | "y"> {
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;

  return {
    x: bounds.minX + spanX * (0.34 + Math.random() * 0.32),
    y: bounds.minY + spanY * (0.24 + Math.random() * 0.22),
  };
}

export function ambientRespawnImpulse(width: number): Pick<PhysicsBallState, "vx" | "vy"> {
  const lateral = width < 640 ? 260 : width < 1024 ? 340 : 420;
  const sign = Math.random() > 0.5 ? 1 : -1;

  return {
    vx: sign * lateral * (0.55 + Math.random() * 0.45),
    vy: -(118 + Math.random() * 90),
  };
}

export const BALL_PRESENCE_SPRING = { stiffness: 120, damping: 28, mass: 0.9 } as const;
export const BALL_POSITION_SPRING = { stiffness: 180, damping: 32, mass: 0.9 } as const;
