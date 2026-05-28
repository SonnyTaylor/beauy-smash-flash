import { useEffect, useRef } from 'react';
import type { CharacterDefinition } from '../../shared/types';
import { rgbCss } from '../character';

// Lightweight HTML crosshair that follows the mouse. We avoid React state
// here so we don't re-render every mouse move; the DOM transform is poked
// directly via the ref.
export function HudCrosshair({
  character,
  reloading,
  empty,
}: {
  character: CharacterDefinition;
  reloading: boolean;
  empty: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onMove = (event: MouseEvent) => {
      node.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div
      ref={ref}
      className={`hud-crosshair ${reloading ? 'is-reloading' : ''} ${empty ? 'is-empty' : ''}`}
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
