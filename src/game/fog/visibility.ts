import type { RectSnapshot } from '../../shared/types';

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const EPS = 1e-6;
const ANGLE_OFFSETS = [-0.0008, -0.00025, 0, 0.00025, 0.0008];
const ANGLE_MERGE = 0.0002;
const UNIFORM_RAY_COUNT = 96;

export function rectsToSegments(rects: RectSnapshot[]): Segment[] {
  const segments: Segment[] = [];
  for (const rect of rects) {
    if (rect.w <= 0 || rect.h <= 0) {
      continue;
    }
    const x2 = rect.x + rect.w;
    const y2 = rect.y + rect.h;
    segments.push(
      { x1: rect.x, y1: rect.y, x2, y2: rect.y },
      { x1: x2, y1: rect.y, x2, y2 },
      { x1: x2, y1: y2, x2: rect.x, y2 },
      { x1: rect.x, y1: y2, x2: rect.x, y2: rect.y },
    );
  }
  return segments;
}

/** Ray hit points in angular order (does not include the origin). */
export function computeVisibilityPolygon(
  originX: number,
  originY: number,
  segments: Segment[],
  maxRange: number,
  worldWidth?: number,
  worldHeight?: number,
): Point[] {
  const rawAngles: number[] = [];

  for (const corner of uniqueRectCorners(segments, originX, originY, maxRange + 80)) {
    addCornerAngles(rawAngles, originX, originY, corner.x, corner.y);
  }

  for (let i = 0; i < UNIFORM_RAY_COUNT; i += 1) {
    rawAngles.push((i / UNIFORM_RAY_COUNT) * Math.PI * 2);
  }

  const angles = mergeAngles(rawAngles.map(normalizeAngle).sort((a, b) => a - b));
  const polygon: Point[] = [];

  for (const angle of angles) {
    polygon.push(castRay(originX, originY, angle, segments, maxRange, worldWidth, worldHeight));
  }

  return dedupeAdjacentPoints(polygon);
}

/** True when a point lies inside a closed polygon ring. */
export function isPointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + EPS) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/** Visibility hits should form a simple fan around the origin (no bow-tie). */
export function isSimpleVisibilityPolygon(
  originX: number,
  originY: number,
  polygon: Point[],
): boolean {
  if (polygon.length < 3 || !isPointInPolygon(originX, originY, polygon)) {
    return false;
  }

  let winding = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross =
      (a.x - originX) * (b.y - originY) - (a.y - originY) * (b.x - originX);
    if (Math.abs(cross) < 0.01) {
      continue;
    }
    const sign = Math.sign(cross);
    if (winding === 0) {
      winding = sign;
    } else if (sign !== winding) {
      return false;
    }
  }

  return winding !== 0;
}

export function hasLineOfSight(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  segments: Segment[],
  maxRange: number,
): boolean {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const dist = Math.hypot(dx, dy);
  if (dist > maxRange + EPS) {
    return false;
  }
  if (dist <= 8) {
    return true;
  }

  const nx = dx / dist;
  const ny = dy / dist;
  const startPad = 6;
  const ax = originX + nx * startPad;
  const ay = originY + ny * startPad;
  const bx = targetX - nx * 2;
  const by = targetY - ny * 2;

  for (const segment of segments) {
    const hit = segmentIntersectionParameter(
      ax,
      ay,
      bx,
      by,
      segment.x1,
      segment.y1,
      segment.x2,
      segment.y2,
    );
    if (hit !== null && hit > 0.01 && hit < 0.99) {
      return false;
    }
  }

  return true;
}

function uniqueRectCorners(
  segments: Segment[],
  originX: number,
  originY: number,
  searchRadius: number,
): Point[] {
  const seen = new Set<string>();
  const corners: Point[] = [];

  for (const segment of segments) {
    for (const point of [
      { x: segment.x1, y: segment.y1 },
      { x: segment.x2, y: segment.y2 },
    ]) {
      if (Math.hypot(point.x - originX, point.y - originY) > searchRadius) {
        continue;
      }
      const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      corners.push(point);
    }
  }

  return corners;
}

function normalizeAngle(angle: number): number {
  let value = angle % (Math.PI * 2);
  if (value < 0) {
    value += Math.PI * 2;
  }
  return value;
}

function mergeAngles(sorted: number[]): number[] {
  if (sorted.length === 0) {
    return sorted;
  }

  const merged: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = merged[merged.length - 1];
    const next = sorted[i];
    if (next - prev > ANGLE_MERGE) {
      merged.push(next);
    }
  }

  const first = merged[0];
  const last = merged[merged.length - 1];
  if (first + Math.PI * 2 - last <= ANGLE_MERGE) {
    merged.pop();
  }

  return merged;
}

function addCornerAngles(
  angles: number[],
  originX: number,
  originY: number,
  cornerX: number,
  cornerY: number,
) {
  const base = Math.atan2(cornerY - originY, cornerX - originX);
  for (const offset of ANGLE_OFFSETS) {
    angles.push(normalizeAngle(base + offset));
  }
}

function castRay(
  originX: number,
  originY: number,
  angle: number,
  segments: Segment[],
  maxRange: number,
  worldWidth?: number,
  worldHeight?: number,
): Point {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let minDist = maxRange;

  for (const segment of segments) {
    const hit = raySegmentDistance(originX, originY, dx, dy, segment);
    if (hit !== null && hit > EPS && hit < minDist) {
      minDist = hit;
    }
  }

  if (worldWidth !== undefined && worldHeight !== undefined) {
    const boundsHit = rayWorldBoundsDistance(
      originX,
      originY,
      dx,
      dy,
      worldWidth,
      worldHeight,
    );
    if (boundsHit !== null && boundsHit > EPS && boundsHit < minDist) {
      minDist = boundsHit;
    }
  }

  return {
    x: originX + dx * minDist,
    y: originY + dy * minDist,
  };
}

function rayWorldBoundsDistance(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  width: number,
  height: number,
): number | null {
  let closest: number | null = null;

  const checks: Segment[] = [
    { x1: 0, y1: 0, x2: width, y2: 0 },
    { x1: width, y1: 0, x2: width, y2: height },
    { x1: width, y1: height, x2: 0, y2: height },
    { x1: 0, y1: height, x2: 0, y2: 0 },
  ];

  for (const edge of checks) {
    const hit = raySegmentDistance(originX, originY, dirX, dirY, edge);
    if (hit !== null && hit > EPS && (closest === null || hit < closest)) {
      closest = hit;
    }
  }

  return closest;
}

function raySegmentDistance(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  segment: Segment,
): number | null {
  const segDx = segment.x2 - segment.x1;
  const segDy = segment.y2 - segment.y1;
  const cross = dirX * segDy - dirY * segDx;
  if (Math.abs(cross) < EPS) {
    return null;
  }

  const ox = segment.x1 - originX;
  const oy = segment.y1 - originY;
  const t = (ox * segDy - oy * segDx) / cross;
  const u = (ox * dirY - oy * dirX) / cross;
  if (t >= 0 && u >= 0 && u <= 1) {
    return t;
  }
  return null;
}

function segmentIntersectionParameter(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number | null {
  const abx = bx - ax;
  const aby = by - ay;
  const cdx = dx - cx;
  const cdy = dy - cy;
  const denom = abx * cdy - aby * cdx;
  if (Math.abs(denom) < EPS) {
    return null;
  }

  const acx = cx - ax;
  const acy = cy - ay;
  const t = (acx * cdy - acy * cdx) / denom;
  const u = (acx * aby - acy * abx) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return t;
  }
  return null;
}

function dedupeAdjacentPoints(points: Point[]): Point[] {
  if (points.length === 0) {
    return points;
  }

  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = result[result.length - 1];
    const next = points[i];
    if (Math.hypot(next.x - prev.x, next.y - prev.y) > 0.35) {
      result.push(next);
    }
  }

  if (result.length > 2) {
    const first = result[0];
    const last = result[result.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= 0.35) {
      result.pop();
    }
  }

  return result.length >= 3 ? result : points;
}
