/** Top-down Finn dinghy sprite (side-view art, rotated with aim). */
export const FINN_BOAT = {
  sprite: 'boat.png',
  width: 1000,
  height: 1001,
  /** Bow points right in source art; scale to ~1.6× player diameter. */
  displayScale: 0.084,
  pivot: { x: 0.48, y: 0.62 },
} as const;

export function finnBoatAssetUrl(): string {
  return `/assets/${FINN_BOAT.sprite}`;
}
