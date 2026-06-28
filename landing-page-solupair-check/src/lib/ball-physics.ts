export type PhysicsBallState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type PhysicsBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type PhysicsConfig = {
  gravity: number;
  restitution: number;
  airFriction: number;
  springStiffness: number;
  springDamping: number;
  maxSpeed: number;
  returnToCenter: boolean;
};

export type DriftConfig = {
  amplitudeX: number;
  amplitudeY: number;
  frequencyX: number;
  frequencyY: number;
  phaseX: number;
  phaseY: number;
};

export const HERO_PHYSICS: PhysicsConfig = {
  gravity: 920,
  restitution: 0.64,
  airFriction: 0.988,
  springStiffness: 32,
  springDamping: 0.74,
  maxSpeed: 2200,
  returnToCenter: true,
};

export const VIEWPORT_PHYSICS: PhysicsConfig = {
  gravity: 380,
  restitution: 0.52,
  airFriction: 0.994,
  springStiffness: 0,
  springDamping: 0,
  maxSpeed: 140,
  returnToCenter: false,
};

export const BALL_SURFACE =
  "radial-gradient(circle at 32% 28%, oklch(0.72 0.18 275) 0%, oklch(0.48 0.26 275) 55%, oklch(0.32 0.22 275) 100%)";

export const BALL_SHADOW =
  "inset -40px -50px 80px oklch(0 0 0 / 0.35), 0 40px 80px oklch(0 0 0 / 0.25)";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function bounceAxis(
  value: number,
  velocity: number,
  min: number,
  max: number,
  restitution: number,
): [number, number] {
  if (value < min) return [min, Math.abs(velocity) * restitution];
  if (value > max) return [max, -Math.abs(velocity) * restitution];
  return [value, velocity];
}

export function stepBallPhysics(
  state: PhysicsBallState,
  config: PhysicsConfig,
  bounds: PhysicsBounds,
  dtMs: number,
  options: {
    isDragging?: boolean;
    dragX?: number;
    dragY?: number;
    drift?: DriftConfig;
    driftTime?: number;
    hoverNudge?: { x: number; y: number };
  } = {},
): PhysicsBallState {
  const dt = clamp(dtMs / 1000, 0.001, 0.032);
  let { x, y, vx, vy } = state;

  if (options.isDragging && options.dragX !== undefined && options.dragY !== undefined) {
    const dx = options.dragX - x;
    const dy = options.dragY - y;
    const follow = 22;
    vx = dx * follow;
    vy = dy * follow;
    x += vx * dt;
    y += vy * dt;
  } else {
    if (config.returnToCenter) {
      vx += -x * config.springStiffness * dt;
      vy += -y * config.springStiffness * dt;
      const damp = Math.pow(config.springDamping, dt * 60);
      vx *= damp;
      vy *= damp;
    }

    if (options.drift && options.driftTime !== undefined) {
      const t = options.driftTime;
      const d = options.drift;
      const targetX = Math.sin(t * d.frequencyX + d.phaseX) * d.amplitudeX;
      const targetY = Math.cos(t * d.frequencyY + d.phaseY) * d.amplitudeY;
      vx += (targetX - x) * 2.8 * dt;
      vy += (targetY - y) * 2.8 * dt;
    }

    if (options.hoverNudge) {
      vx += options.hoverNudge.x * 10 * dt;
      vy += options.hoverNudge.y * 10 * dt;
    }

    vy += config.gravity * dt;

    const friction = Math.pow(config.airFriction, dt * 60);
    vx *= friction;
    vy *= friction;

    const speed = Math.hypot(vx, vy);
    if (speed > config.maxSpeed) {
      vx = (vx / speed) * config.maxSpeed;
      vy = (vy / speed) * config.maxSpeed;
    }

    x += vx * dt;
    y += vy * dt;
  }

  [x, vx] = bounceAxis(x, vx, bounds.minX, bounds.maxX, config.restitution);
  [y, vy] = bounceAxis(y, vy, bounds.minY, bounds.maxY, config.restitution);

  if (y >= bounds.maxY - 0.5) {
    vx *= 0.94;
  }

  return { x, y, vx, vy };
}
