// Safe-area insets reserved for HUD elements during gameplay.
//
// The Pixi arena is letterboxed inside these insets so no playable area
// sits behind a HUD element. The InputController uses the same insets
// when projecting mouse coordinates back into world space.
//
// Keep these numbers in rough sync with the HUD CSS in `styles.css`:
//   top    — match strip (top: 16 + ~52 height)
//   bottom — player card / ability button / ammo / controls hint
//   left/right — currently 0; bottom-corner pills sit inside the bottom band

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const GAME_SAFE_AREA_INSETS: SafeAreaInsets = {
  top: 72,
  right: 0,
  bottom: 138,
  left: 0,
};
