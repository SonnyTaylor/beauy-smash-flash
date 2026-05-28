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
