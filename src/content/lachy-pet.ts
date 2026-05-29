/** Andy's melee pet — Lachy the dog (side-view art, mirrored when moving left). */
export const LACHY_PET = {
  sprite: 'lachy.png',
  /** Trimmed source is 416×297 after `scripts/process-lachy.py`. */
  width: 416,
  height: 297,
  /** ~40px tall on arena — smaller than a player. */
  displayScale: 0.135,
  /** Feet on ground; art faces right. */
  pivot: { x: 0.5, y: 0.92 },
} as const;

export function lachyPetAssetUrl(): string {
  return `/assets/${LACHY_PET.sprite}`;
}
