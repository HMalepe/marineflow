export type EntrancePoint = { x: number; y: number; u: number };

const PHI = (1 + Math.sqrt(5)) / 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Ease-out quint — snooker ball decelerates into the pocket (center). */
export function easeEntrance(t: number) {
  return 1 - (1 - clamp(t, 0, 1)) ** 5;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Rolls in from off-screen LEFT, sweeps a Fibonacci-scaled ∞, settles center.
 * Points are NOT clamped — ball can start fully outside the hero bounds.
 */
export function buildHeroEntrancePath(
  width: number,
  height: number,
  radius: number,
  steps = 300,
): EntrancePoint[] {
  if (width <= 0 || height <= 0) return [];

  const endX = width / 2;
  const endY = height * 0.36;

  const startX = -radius * 3.2;
  const startY = height * 0.11;
  const entryEndX = width * 0.2;
  const entryEndY = height * 0.16;

  const cx = width * 0.5;
  const cy = height * 0.38;
  const ax = (width * 0.4) / PHI;
  const ay = (height * 0.26) / Math.sqrt(PHI);

  const points: EntrancePoint[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const u = i / steps;
    let x: number;
    let y: number;

    if (u < 0.2) {
      const blend = easeInOutCubic(u / 0.2);
      x = startX + (entryEndX - startX) * blend;
      y = startY + (entryEndY - startY) * blend;
    } else if (u < 0.8) {
      const loopU = (u - 0.2) / 0.6;
      const loopT = loopU * Math.PI * 2.1 + 0.35;
      const st = Math.sin(loopT);
      const ct = Math.cos(loopT);
      const denom = 1 + st * st;

      x = cx + (ax * ct) / denom;
      y = cy + (ay * st * ct) / denom;

      const enterBlend = Math.min(1, loopU * 4);
      x = entryEndX + (x - entryEndX) * enterBlend;
      y = entryEndY + (y - entryEndY) * enterBlend;
    } else {
      const loopT = Math.PI * 2.1 + 0.35;
      const st = Math.sin(loopT);
      const ct = Math.cos(loopT);
      const denom = 1 + st * st;
      const loopX = cx + (ax * ct) / denom;
      const loopY = cy + (ay * st * ct) / denom;

      const blend = (u - 0.8) / 0.2;
      const ease = 1 - (1 - blend) ** 3;
      x = loopX + (endX - loopX) * ease;
      y = loopY + (endY - loopY) * ease;
    }

    points.push({ x, y, u });
  }

  return points;
}

export function sampleEntrancePath(
  points: EntrancePoint[],
  easedProgress: number,
): { x: number; y: number; tangent: number; progress: number } {
  if (points.length === 0) {
    return { x: 0, y: 0, tangent: 0, progress: 0 };
  }

  const t = clamp(easedProgress, 0, 1);
  const idx = t * (points.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(i0 + 1, points.length - 1);
  const f = idx - i0;
  const p0 = points[i0];
  const p1 = points[i1];

  const x = p0.x + (p1.x - p0.x) * f;
  const y = p0.y + (p1.y - p0.y) * f;
  const tangent = Math.atan2(p1.y - p0.y, p1.x - p0.x);

  return { x, y, tangent, progress: t };
}

/** Radians rolled from arc length — drives highlight, not CSS skew. */
export function rollDeltaFromMotion(dx: number, dy: number, radius: number) {
  if (radius <= 0) return 0;
  return Math.hypot(dx, dy) / radius;
}

export function getEntranceDurationMs(isPhone: boolean) {
  return isPhone ? 4800 : 6000;
}

/** Face reveal ramps only in the final approach. */
export function faceRevealFromProgress(progress: number) {
  if (progress < 0.74) return 0;
  const t = (progress - 0.74) / 0.26;
  return clamp(t ** 2.2, 0, 1);
}

/** Hints peek when the lit hemisphere turns — not a full face. */
export function faceHintFromRoll(rollAngle: number, progress: number) {
  if (progress > 0.82) return 0;
  const facing = Math.max(0, Math.cos(rollAngle * 0.9));
  const peek = (1 - facing) * 0.45;
  return clamp(peek * (1 - progress * 0.4), 0, 0.34);
}
