/** Full-body Isaak meditation pose shown while channeling Chi Blast. */
export const ISAAK_ULT = {
  sprite: 'heads/isaak_ult.png',
  width: 433,
  height: 576,
  /** ~3× normal head size on arena */
  displayScale: 0.28,
  pivot: { x: 0.5, y: 0.88 },
} as const;

export function isaakUltAssetUrl(): string {
  return `/assets/${ISAAK_ULT.sprite}`;
}
