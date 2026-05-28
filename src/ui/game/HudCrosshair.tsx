import { useEffect, useRef } from 'react';
import type { CharacterDefinition, WorldConfig } from '../../shared/types';
import { fitWorldToViewport } from '../../game/Viewport';
import { GAME_SAFE_AREA_INSETS } from '../../game/safeArea';
import { rgbCss } from '../character';

// Lightweight HTML crosshair that follows the mouse. We avoid React state
// here so we don't re-render every mouse move; the DOM transform is poked
// directly via the ref.
export function HudCrosshair({
  character,
  reloading,
  empty,
  hacked,
  playerWorld,
  world,
}: {
  character: CharacterDefinition;
  reloading: boolean;
  empty: boolean;
  hacked: boolean;
  playerWorld: { x: number; y: number } | null;
  world: WorldConfig | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hackedRef = useRef(hacked);
  const playerRef = useRef(playerWorld);
  const worldRef = useRef(world);

  hackedRef.current = hacked;
  playerRef.current = playerWorld;
  worldRef.current = world;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onMove = (event: MouseEvent) => {
      let x = event.clientX;
      let y = event.clientY;

      if (hackedRef.current && playerRef.current && worldRef.current) {
        const transform = fitWorldToViewport(
          worldRef.current,
          window.innerWidth,
          window.innerHeight,
          GAME_SAFE_AREA_INSETS,
        );
        const originX = transform.offsetX + playerRef.current.x * transform.scale;
        const originY = transform.offsetY + playerRef.current.y * transform.scale;
        x = originX - (x - originX);
        y = originY - (y - originY);
      }

      node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div
      ref={ref}
      className={`hud-crosshair ${reloading ? 'is-reloading' : ''} ${empty ? 'is-empty' : ''} ${hacked ? 'is-hacked' : ''}`}
      style={{ '--accent': rgbCss(character.color) } as React.CSSProperties}
      aria-hidden
    >
      <span className="hud-crosshair-dot" />
      <span className="hud-crosshair-tick hud-crosshair-tick-up" />
      <span className="hud-crosshair-tick hud-crosshair-tick-down" />
      <span className="hud-crosshair-tick hud-crosshair-tick-left" />
      <span className="hud-crosshair-tick hud-crosshair-tick-right" />
    </div>
  );
}
