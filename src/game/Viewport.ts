import type { WorldConfig } from '../shared/types';
import type { SafeAreaInsets } from './safeArea';

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function fitWorldToViewport(
  world: WorldConfig,
  viewportWidth: number,
  viewportHeight: number,
  insets?: SafeAreaInsets,
): ViewportTransform {
  const top = insets?.top ?? 0;
  const right = insets?.right ?? 0;
  const bottom = insets?.bottom ?? 0;
  const left = insets?.left ?? 0;

  const innerWidth = Math.max(1, viewportWidth - left - right);
  const innerHeight = Math.max(1, viewportHeight - top - bottom);

  const scale = Math.min(innerWidth / world.width, innerHeight / world.height);

  return {
    scale,
    offsetX: left + (innerWidth - world.width * scale) / 2,
    offsetY: top + (innerHeight - world.height * scale) / 2,
  };
}

export interface MapScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

/** Screen-space bounds of the letterboxed arena (matches Pixi root placement). */
export function mapScreenRect(
  world: WorldConfig,
  viewportWidth: number,
  viewportHeight: number,
  insets?: SafeAreaInsets,
): MapScreenRect {
  const transform = fitWorldToViewport(world, viewportWidth, viewportHeight, insets);
  return {
    left: transform.offsetX,
    top: transform.offsetY,
    width: world.width * transform.scale,
    height: world.height * transform.scale,
    scale: transform.scale,
  };
}

/** Map arena world coordinates to screen pixels (matches Pixi root placement). */
export function worldToScreen(
  worldX: number,
  worldY: number,
  world: WorldConfig,
  viewportWidth: number,
  viewportHeight: number,
  insets?: SafeAreaInsets,
): { x: number; y: number } {
  const transform = fitWorldToViewport(world, viewportWidth, viewportHeight, insets);
  return {
    x: transform.offsetX + worldX * transform.scale,
    y: transform.offsetY + worldY * transform.scale,
  };
}
