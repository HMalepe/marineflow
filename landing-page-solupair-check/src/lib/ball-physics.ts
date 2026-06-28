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

export type BasketballConfig = {
  gravity: number;
  restitution: number;
  wallRestitution: number;
  airFriction: number;
  floorFriction: number;
  maxSpeed: number;
  sleepSpeed: number;
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

export const BASKETBALL_PHYSICS: BasketballConfig = {
  gravity: 2400,
  restitution: 0.74,
  wallRestitution: 0.62,
  airFriction: 0.997,
  floorFriction: 0.9,
  maxSpeed: 4200,
  sleepSpeed: 14,
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

export type BasketballStepResult = PhysicsBallState & { sleeping: boolean };

/** Viewport basketball — gravity, floor/wall bounce, friction, sleep on floor. */
export function stepBasketballPhysics(
  state: PhysicsBallState,
  config: BasketballConfig,
  bounds: PhysicsBounds,
  dtMs: number,
  options: { isDragging?: boolean; dragX?: number; dragY?: number } = {},
): BasketballStepResult {
  const dt = clamp(dtMs / 1000, 0.001, 0.032);
  let { x, y, vx, vy } = state;

  if (options.isDragging && options.dragX !== undefined && options.dragY !== undefined) {
    const prevX = x;
    const prevY = y;
    x = clamp(options.dragX, bounds.minX, bounds.maxX);
    y = clamp(options.dragY, bounds.minY, bounds.maxY);
    vx = (x - prevX) / dt;
    vy = (y - prevY) / dt;
    return { x, y, vx, vy, sleeping: false };
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

  [x, vx] = bounceAxis(x, vx, bounds.minX, bounds.maxX, config.wallRestitution);
  [y, vy] = bounceAxis(y, vy, bounds.minY, bounds.maxY, config.restitution);

  const onFloor = y >= bounds.maxY - 1;
  if (onFloor) {
    y = bounds.maxY;
    vx *= config.floorFriction;
    if (Math.abs(vy) < config.sleepSpeed * 1.5) {
      vy = 0;
    }
  }

  const sleeping =
    onFloor &&
    Math.abs(vx) < config.sleepSpeed &&
    Math.abs(vy) < config.sleepSpeed;

  if (sleeping) {
    return { x, y: bounds.maxY, vx: 0, vy: 0, sleeping: true };
  }

  return { x, y, vx, vy, sleeping: false };
}

export function getViewportBallBounds(radius: number, topInset = 8): PhysicsBounds {
  if (typeof window === "undefined") {
    return { minX: radius, maxX: radius, minY: radius, maxY: radius };
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const pad = Math.max(6, radius * 0.08);

  return {
    minX: radius + pad,
    maxX: w - radius - pad,
    minY: radius + topInset,
    maxY: h - radius - pad,
  };
}

/** Hero / section-local bounds — floor is the bottom of the blue hero panel. */
export function getSectionBallBounds(
  width: number,
  height: number,
  radius: number,
  topInset = 8,
): PhysicsBounds {
  const pad = Math.max(6, radius * 0.08);

  return {
    minX: radius + pad,
    maxX: Math.max(radius + pad, width - radius - pad),
    minY: radius + topInset,
    maxY: Math.max(radius + topInset, height - radius - pad),
  };
}

export function clientToSectionLocal(
  clientX: number,
  clientY: number,
  sectionRect: DOMRect,
): { x: number; y: number } {
  return {
    x: clientX - sectionRect.left,
    y: clientY - sectionRect.top,
  };
}
