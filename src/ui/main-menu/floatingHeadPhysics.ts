import { clamp, randomBetween, randomSignedBetween } from '../math';

export type FloatingHeadPosition = {
  x: number;
  y: number;
  size: number;
  delay: number;
  drift: number;
  vx: number;
  vy: number;
};

/** Keep heads bouncing even after many collisions or float rounding. */
const MIN_SPEED = 3;

function enforceMinSpeed(vx: number, vy: number): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed >= MIN_SPEED) return { vx, vy };
  if (speed > 0.0001) {
    const scale = MIN_SPEED / speed;
    return { vx: vx * scale, vy: vy * scale };
  }
  const angle = Math.random() * Math.PI * 2;
  return { vx: Math.cos(angle) * MIN_SPEED, vy: Math.sin(angle) * MIN_SPEED };
}

export function createFloatingHeadPositions(count: number): FloatingHeadPosition[] {
  if (count <= 0) return [];

  const baseSize = clamp(118 - count * 5, 56, 118);
  const positions: FloatingHeadPosition[] = [];
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2 + randomBetween(-0.18, 0.18);
    const radius = randomBetween(34, 44);
    const cx = clamp(50 + Math.cos(angle) * radius, 7, 93);
    const cy = clamp(50 + Math.sin(angle) * radius * 0.7, 9, 91);

    positions.push({
      x: cx,
      y: cy,
      size: baseSize + randomBetween(-6, 6),
      delay: randomBetween(-6, 0),
      drift: randomBetween(6, 14),
      vx: randomSignedBetween(4, 10),
      vy: randomSignedBetween(3, 8),
    });
  }

  return positions;
}

export function stepFloatingHead(
  position: FloatingHeadPosition,
  bounds: DOMRect,
  cardBounds: DOMRect | null,
  dt: number,
): FloatingHeadPosition {
  const marginX = (position.size / bounds.width) * 50;
  const marginY = (position.size / bounds.height) * 50;
  let x = position.x + position.vx * dt;
  let y = position.y + position.vy * dt;
  let vx = position.vx;
  let vy = position.vy;

  if (x < marginX) {
    x = marginX;
    vx = Math.abs(vx);
  } else if (x > 100 - marginX) {
    x = 100 - marginX;
    vx = -Math.abs(vx);
  }

  if (y < marginY) {
    y = marginY;
    vy = Math.abs(vy);
  } else if (y > 100 - marginY) {
    y = 100 - marginY;
    vy = -Math.abs(vy);
  }

  if (cardBounds) {
    const radiusX = (position.size / bounds.width) * 50;
    const radiusY = (position.size / bounds.height) * 50;
    const cardZone = {
      left: ((cardBounds.left - bounds.left) / bounds.width) * 100 - radiusX,
      right: ((cardBounds.right - bounds.left) / bounds.width) * 100 + radiusX,
      top: ((cardBounds.top - bounds.top) / bounds.height) * 100 - radiusY,
      bottom: ((cardBounds.bottom - bounds.top) / bounds.height) * 100 + radiusY,
    };
    const insideCardZone = x > cardZone.left && x < cardZone.right && y > cardZone.top && y < cardZone.bottom;

    if (insideCardZone) {
      const distances = [
        { side: 'left' as const, value: Math.abs(x - cardZone.left) },
        { side: 'right' as const, value: Math.abs(cardZone.right - x) },
        { side: 'top' as const, value: Math.abs(y - cardZone.top) },
        { side: 'bottom' as const, value: Math.abs(cardZone.bottom - y) },
      ];
      const nearest = distances.reduce((closest, candidate) =>
        candidate.value < closest.value ? candidate : closest,
      );

      if (nearest.side === 'left' || nearest.side === 'right') {
        x = nearest.side === 'left' ? cardZone.left : cardZone.right;
        vx = Math.abs(vx) * (nearest.side === 'left' ? -1 : 1);
      } else {
        y = nearest.side === 'top' ? cardZone.top : cardZone.bottom;
        vy = Math.abs(vy) * (nearest.side === 'top' ? -1 : 1);
      }
    }
  }

  const { vx: nextVx, vy: nextVy } = enforceMinSpeed(vx, vy);

  return {
    ...position,
    x,
    y,
    vx: clamp(nextVx, -18, 18),
    vy: clamp(nextVy, -18, 18),
  };
}

export function resolveHeadCollisions(
  positions: FloatingHeadPosition[],
  bounds: DOMRect,
  draggingIndex: number | null,
): FloatingHeadPosition[] {
  if (positions.length < 2) return positions;

  const bodies = positions.map((position) => ({
    raw: position,
    px: (position.x / 100) * bounds.width,
    py: (position.y / 100) * bounds.height,
    pvx: (position.vx / 100) * bounds.width,
    pvy: (position.vy / 100) * bounds.height,
    r: position.size / 2,
  }));

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.px - a.px;
      const dy = b.py - a.py;
      let dist = Math.hypot(dx, dy);
      const minDist = a.r + b.r;
      if (dist >= minDist) continue;

      let nx: number;
      let ny: number;
      if (dist < 0.001) {
        const angle = Math.random() * Math.PI * 2;
        nx = Math.cos(angle);
        ny = Math.sin(angle);
        dist = 0.001;
      } else {
        nx = dx / dist;
        ny = dy / dist;
      }

      const overlap = minDist - dist;
      const aLocked = draggingIndex === i;
      const bLocked = draggingIndex === j;
      const aShare = aLocked ? 0 : bLocked ? 1 : 0.5;
      const bShare = bLocked ? 0 : aLocked ? 1 : 0.5;

      a.px -= nx * overlap * aShare;
      a.py -= ny * overlap * aShare;
      b.px += nx * overlap * bShare;
      b.py += ny * overlap * bShare;

      const rvx = b.pvx - a.pvx;
      const rvy = b.pvy - a.pvy;
      const velAlongNormal = rvx * nx + rvy * ny;
      if (velAlongNormal > 0) continue;

      const restitution = 1;
      const impulse = (-(1 + restitution) * velAlongNormal) / 2;
      const impulseX = impulse * nx;
      const impulseY = impulse * ny;

      if (!aLocked) {
        a.pvx -= impulseX;
        a.pvy -= impulseY;
      }
      if (!bLocked) {
        b.pvx += impulseX;
        b.pvy += impulseY;
      }
    }
  }

  return bodies.map(({ raw, px, py, pvx, pvy }) => {
    const marginX = (raw.size / bounds.width) * 50;
    const marginY = (raw.size / bounds.height) * 50;
    const vxPct = (pvx / bounds.width) * 100;
    const vyPct = (pvy / bounds.height) * 100;
    const { vx, vy } = enforceMinSpeed(vxPct, vyPct);
    return {
      ...raw,
      x: clamp((px / bounds.width) * 100, marginX, 100 - marginX),
      y: clamp((py / bounds.height) * 100, marginY, 100 - marginY),
      vx: clamp(vx, -30, 30),
      vy: clamp(vy, -30, 30),
    };
  });
}
