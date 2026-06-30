import {
  getSectionBallBounds,
  type BasketballConfig,
  type PhysicsBallState,
} from "@/lib/ball-physics";

/** Hero ball is 30% smaller than the original sizing for wider travel room. */
export const HERO_BALL_SIZE_SCALE = 0.7;

/** Slower ping-pong feel — high bounce, gentle gravity, long rallies across the hero. */
export const HERO_BALL_PHYSICS: BasketballConfig = {
  gravity: 1850,
  restitution: 0.88,
  wallRestitution: 0.9,
  airFriction: 0.9976,
  floorFriction: 0.94,
  maxSpeed: 2600,
  sleepSpeed: 9,
};

/** Entrance uses the same family of tuning, slightly livelier on first wall hit. */
export const ENTRANCE_PHYSICS: BasketballConfig = {
  ...HERO_BALL_PHYSICS,
  restitution: 0.86,
  wallRestitution: 0.91,
  gravity: 1920,
  maxSpeed: 2400,
  sleepSpeed: 10,
};

export function getEntranceMaxDurationMs(isPhone: boolean) {
  return isPhone ? 14_000 : 17_000;
}

/** Launch from the left — slow roll right, wall bounce, then settle on the floor. */
export function getEntranceInitialState(
  width: number,
  height: number,
  radius: number,
): PhysicsBallState {
  const bounds = getSectionBallBounds(width, height, radius);
  const spanY = bounds.maxY - bounds.minY;

  const vx =
    width < 400 ? 980 : width < 640 ? 1150 : width < 1024 ? 1420 : 1680;
  const vy = -Math.min(185, spanY * 0.1);

  return {
    x: bounds.minX + radius * 0.08,
    y: bounds.minY + spanY * 0.22,
    vx,
    vy,
  };
}

/** Radians rolled from arc length — drives 360° sphere lighting. */
export function rollDeltaFromMotion(dx: number, dy: number, radius: number) {
  if (radius <= 0) return 0;
  return Math.hypot(dx, dy) / radius;
}

/** Subtle face peek while the ball is still rolling. */
export function faceHintFromRoll(rollAngle: number, settled: boolean) {
  if (settled) return 0;
  const facing = Math.max(0, Math.cos(rollAngle * 0.9));
  return Math.min(0.32, (1 - facing) * 0.38);
}
