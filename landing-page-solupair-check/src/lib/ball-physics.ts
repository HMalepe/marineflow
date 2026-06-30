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
  gravity: 2600,
  restitution: 0.72,
  wallRestitution: 0.68,
  airFriction: 0.9982,
  floorFriction: 0.88,
  maxSpeed: 5600,
  sleepSpeed: 12,
};

export type PointerSample = { x: number; y: number; t: number };

/** Flick velocity from recent pointer trail (section-local px/s). */
export function computeThrowVelocity(
  samples: PointerSample[],
  maxSpeed: number,
  throwBoost = 1.25,
): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 };

  const windowMs = 140;
  const last = samples[samples.length - 1];
  const recent = samples.filter((s) => last.t - s.t <= windowMs);
  const track = recent.length >= 2 ? recent : samples.slice(-2);

  const first = track[0];
  const end = track[track.length - 1];
  const dt = Math.max((end.t - first.t) / 1000, 0.006);

  let vx = ((end.x - first.x) / dt) * throwBoost;
  let vy = ((end.y - first.y) / dt) * throwBoost;

  const speed = Math.hypot(vx, vy);
  if (speed > maxSpeed) {
    vx = (vx / speed) * maxSpeed;
    vy = (vy / speed) * maxSpeed;
  }

  return { vx, vy };
}

function clampSpeed(vx: number, vy: number, maxSpeed: number) {
  const speed = Math.hypot(vx, vy);
  if (speed <= maxSpeed) return { vx, vy };
  return { vx: (vx / speed) * maxSpeed, vy: (vy / speed) * maxSpeed };
}

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

/** Rolling-sphere lighting — disc stays round; highlight moves like a real 3D ball. */
export function getSphereLighting(rollAngle: number, compact = false) {
  const a = rollAngle;
  const hx = 34 + Math.sin(a) * 24 + Math.sin(a * 0.5) * 8;
  const hy = 28 + Math.cos(a * 0.92) * 20 + Math.sin(a * 1.3) * 6;
  const rimAngle = a + Math.PI * 0.72;

  const background = `radial-gradient(circle at ${hx.toFixed(1)}% ${hy.toFixed(1)}%, oklch(0.78 0.16 275) 0%, oklch(0.58 0.24 275) 28%, oklch(0.44 0.26 275) 52%, oklch(0.30 0.22 275) 78%, oklch(0.18 0.16 275) 100%)`;

  const rimGradient = `linear-gradient(${((rimAngle * 180) / Math.PI).toFixed(1)}deg, oklch(0 0 0 / 0.42) 0%, oklch(0 0 0 / 0) 38%, oklch(1 0 0 / 0.08) 62%, oklch(0 0 0 / 0.35) 100%)`;

  const specular = {
    x: `${(hx * 0.88).toFixed(1)}%`,
    y: `${(hy * 0.82).toFixed(1)}%`,
    w: compact ? "22%" : "20%",
    h: compact ? "14%" : "12%",
    opacity: 0.55 + Math.max(0, Math.cos(a)) * 0.25,
  };

  const insetDepth = compact ? 20 : 40;
  const dropDepth = compact ? 16 : 40;
  const boxShadow = [
    `inset ${(-insetDepth + Math.sin(a) * 10).toFixed(0)}px ${(-insetDepth * 1.2 + Math.cos(a) * 8).toFixed(0)}px ${insetDepth * 2}px oklch(0 0 0 / 0.42)`,
    `inset ${(insetDepth * 0.4 + Math.cos(a) * 6).toFixed(0)}px ${(insetDepth * 0.35 + Math.sin(a) * 5).toFixed(0)}px ${insetDepth}px oklch(0.9 0.06 275 / 0.12)`,
    `0 ${dropDepth}px ${dropDepth * 2}px oklch(0 0 0 / 0.28)`,
  ].join(", ");

  return { background, boxShadow, rimGradient, specular };
}

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

function resolveWallCollisions(
  x: number,
  y: number,
  vx: number,
  vy: number,
  bounds: PhysicsBounds,
  config: BasketballConfig,
): { x: number; y: number; vx: number; vy: number; onFloor: boolean } {
  let px = x;
  let py = y;
  let pvx = vx;
  let pvy = vy;
  let onFloor = false;

  if (px < bounds.minX) {
    px = bounds.minX;
    pvx = Math.abs(pvx) * config.wallRestitution;
  } else if (px > bounds.maxX) {
    px = bounds.maxX;
    pvx = -Math.abs(pvx) * config.wallRestitution;
  }

  if (py < bounds.minY) {
    py = bounds.minY;
    pvy = Math.abs(pvy) * config.wallRestitution;
  } else if (py > bounds.maxY) {
    py = bounds.maxY;
    pvy = -Math.abs(pvy) * config.restitution;
    pvx *= config.floorFriction;
    onFloor = true;
    if (Math.abs(pvy) < config.sleepSpeed * 1.5) {
      pvy = 0;
    }
  }

  return { x: px, y: py, vx: pvx, vy: pvy, onFloor };
}

/** Section basketball — gravity, four-wall bounce, friction, sleep on floor. */
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
    const dragVel = clampSpeed((x - prevX) / dt, (y - prevY) / dt, config.maxSpeed);
    return { x, y, vx: dragVel.vx, vy: dragVel.vy, sleeping: false };
  }

  const travel = Math.hypot(vx, vy) * dt;
  const substeps = Math.min(14, Math.max(1, Math.ceil(travel / 10)));
  const subDt = dt / substeps;
  let onFloor = false;

  for (let i = 0; i < substeps; i += 1) {
    vy += config.gravity * subDt;

    const friction = Math.pow(config.airFriction, subDt * 60);
    vx *= friction;
    vy *= friction;

    ({ vx, vy } = clampSpeed(vx, vy, config.maxSpeed));

    x += vx * subDt;
    y += vy * subDt;

    const resolved = resolveWallCollisions(x, y, vx, vy, bounds, config);
    x = resolved.x;
    y = resolved.y;
    vx = resolved.vx;
    vy = resolved.vy;
    onFloor = onFloor || resolved.onFloor;
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
  topInset = 4,
): PhysicsBounds {
  const pad = Math.max(4, radius * 0.05);

  return {
    minX: radius + pad,
    maxX: Math.max(radius + pad, width - radius - pad),
    minY: radius + topInset,
    maxY: Math.max(radius + topInset, height - radius - Math.max(4, pad * 0.5)),
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
