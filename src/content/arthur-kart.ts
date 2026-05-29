/** Top-down Arthur go-kart (source art faces right; rotates with aim). */
export const ARTHUR_KART = {
  sprite: 'arthur_kart.png',
  width: 991,
  height: 578,
  displayScale: 0.11,
  pivot: { x: 0.5, y: 0.58 },
} as const;

export function arthurKartAssetUrl(): string {
  return `/assets/${ARTHUR_KART.sprite}`;
}
