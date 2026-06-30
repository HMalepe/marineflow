export type EntrancePoint = { x: number; y: number; u: number };

const PHI = (1 + Math.sqrt(5)) / 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Ease-out quint — snooker ball decelerates into the pocket (center). */
export function easeEntrance(t: number) {
  return 1 - (1 - clamp(t, 0, 1)) ** 5;
}

/**
 * Fibonacci-scaled lemniscate (∞) with an off-screen top-left entry and
 * a final spiral into the hero center.
 */
export function buildHeroEntrancePath(
  width: number,
  height: number,
  radius: number,
  steps = 280,
): EntrancePoint[] {
  if (width <= 0 || height <= 0) return [];

  const endX = width / 2;
  const endY = height * 0.36;
  const startX = -radius * 0.35;
  const startY = -radius * 0.45;

  const cx = width * 0.48;
  const cy = height * 0.4;
  const ax = (width * 0.42) / PHI;
  const ay = (height * 0.3) / Math.sqrt(PHI);

  const points: EntrancePoint[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const u = i / steps;
    const loopT = u * Math.PI * 2.35;
    const st = Math.sin(loopT);
    const ct = Math.cos(loopT);
    const denom = 1 + st * st;

    let x = cx + (ax * ct) / denom;
    let y = cy + (ay * st * ct) / denom;

    if (u < 0.1) {
      const blend = u / 0.1;
      const ease = blend * blend;
      x = startX + (x - startX) * ease;
      y = startY + (y - startY) * ease;
    }

    if (u > 0.78) {
      const blend = (u - 0.78) / 0.22;
      const ease = 1 - (1 - blend) ** 3;
      x += (endX - x) * ease;
      y += (endY - y) * ease;
    }

    points.push({
      x: clamp(x, radius * 0.6, width - radius * 0.6),
      y: clamp(y, radius * 0.6, height - radius * 0.6),
      u,
    });
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

/** Rolling spin (rad) from frame displacement — circumference = 2πr. */
export function rollDeltaFromMotion(dx: number, dy: number, radius: number) {
  const dist = Math.hypot(dx, dy);
  if (radius <= 0 || dist < 0.001) return { rollZ: 0, rollY: 0, rollX: 0 };
  const rollZ = dist / radius;
  const rollY = (dx / radius) * 0.85;
  const rollX = (-dy / radius) * 0.55;
  return { rollZ, rollY, rollX };
}

export function getEntranceDurationMs(isPhone: boolean) {
  return isPhone ? 4400 : 5600;
}

/** Face reveal ramps only in the final approach. */
export function faceRevealFromProgress(progress: number) {
  if (progress < 0.72) return 0;
  const t = (progress - 0.72) / 0.28;
  return clamp(t ** 2.2, 0, 1);
}

/** Hints peek when the ball tumbles — not a full face. */
export function faceHintFromRoll(rollY: number, rollX: number, progress: number) {
  if (progress > 0.85) return 0;
  const tumble = Math.abs(Math.sin(rollY * 1.4)) * Math.abs(Math.cos(rollX * 0.9));
  return clamp(tumble * 0.38 * (1 - progress * 0.5), 0, 0.32);
}
