export const TAJ_REEL_COUNT = 5;
export const TAJ_SHIELD_DURATION_SECS = 5.5;

export const TAJ_REEL_SRC = [
  '/assets/reels/reel-0.mp4',
  '/assets/reels/reel-1.mp4',
  '/assets/reels/reel-2.mp4',
  '/assets/reels/reel-3.mp4',
  '/assets/reels/reel-4.mp4',
] as const;

export function tajReelSrc(index: number): string {
  return TAJ_REEL_SRC[((index % TAJ_REEL_COUNT) + TAJ_REEL_COUNT) % TAJ_REEL_COUNT];
}
