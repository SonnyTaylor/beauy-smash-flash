import type { WorldConfig } from '../shared/types';

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function fitWorldToViewport(world: WorldConfig, viewportWidth: number, viewportHeight: number): ViewportTransform {
  const scale = Math.min(viewportWidth / world.width, viewportHeight / world.height);
  return {
    scale,
    offsetX: (viewportWidth - world.width * scale) / 2,
    offsetY: (viewportHeight - world.height * scale) / 2,
  };
}
