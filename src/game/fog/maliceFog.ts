/**
 * Connor MALICE Drop — line-of-sight blocking (client render).
 * Zone owner (Connor who placed it) sees through their own fog.
 */

export interface MaliceFogZone {
  id: number;
  x: number;
  y: number;
  radius: number;
  ownerId: number;
  /** 0–1 for VFX fade */
  lifeRatio: number;
}

/** Point inside a hostile fog disk (not your own). */
export function isInsideHostileMaliceFog(
  x: number,
  y: number,
  zones: MaliceFogZone[],
  viewerPlayerId: number,
): boolean {
  for (const zone of zones) {
    if (zone.ownerId === viewerPlayerId) {
      continue;
    }
    if (distance(x, y, zone.x, zone.y) <= zone.radius) {
      return true;
    }
  }
  return false;
}

/**
 * Segment from viewer to target blocked by hostile malice fog.
 * Targets inside the fog are hidden. Line-of-sight is cut only when the viewer
 * is outside the zone (standing inside hostile fog no longer blacks out the map).
 */
export function isBlockedByMaliceFog(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  zones: MaliceFogZone[],
  viewerPlayerId: number,
): boolean {
  for (const zone of zones) {
    if (zone.ownerId === viewerPlayerId) {
      continue;
    }
    const originInside = distance(originX, originY, zone.x, zone.y) <= zone.radius;
    const targetInside = distance(targetX, targetY, zone.x, zone.y) <= zone.radius;

    if (targetInside) {
      return true;
    }

    if (
      !originInside &&
      segmentIntersectsCircle(originX, originY, targetX, targetY, zone.x, zone.y, zone.radius)
    ) {
      return true;
    }
  }
  return false;
}

function segmentIntersectsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    return distance(ax, ay, cx, cy) <= radius;
  }

  let t = ((cx - ax) * dx + (cy - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return distance(px, py, cx, cy) <= radius;
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.hypot(dx, dy);
}
