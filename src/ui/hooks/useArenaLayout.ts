import { useEffect, useState } from 'react';
import type { WorldConfig } from '../../shared/types';
import { mapScreenRect } from '../../game/Viewport';
import { GAME_SAFE_AREA_INSETS } from '../../game/safeArea';

export interface ArenaLayoutCssVars extends Record<string, string> {
  '--map-left': string;
  '--map-top': string;
  '--map-width': string;
  '--map-height': string;
  '--hud-score-left': string;
  '--hud-score-transform': string;
  '--hud-menu-left': string;
  '--hud-menu-transform': string;
}

const DEFAULT_VARS: ArenaLayoutCssVars = {
  '--map-left': '0px',
  '--map-top': '0px',
  '--map-width': '100vw',
  '--map-height': '100vh',
  '--hud-score-left': '12px',
  '--hud-score-transform': 'none',
  '--hud-menu-left': 'calc(100vw - 12px)',
  '--hud-menu-transform': 'translateX(-100%)',
};

const SIDE_GUTTER_MIN = 96;

export function useArenaLayout(world: WorldConfig | null | undefined): ArenaLayoutCssVars {
  const [vars, setVars] = useState<ArenaLayoutCssVars>(DEFAULT_VARS);

  useEffect(() => {
    if (!world) {
      setVars(DEFAULT_VARS);
      return;
    }

    const activeWorld = world;

    function measure() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const rect = mapScreenRect(activeWorld, width, height, GAME_SAFE_AREA_INSETS);
      const gutterLeft = rect.left;
      const gutterRight = width - rect.left - rect.width;
      const scoreInGutter = gutterLeft >= SIDE_GUTTER_MIN;
      const menuInGutter = gutterRight >= SIDE_GUTTER_MIN;

      setVars({
        '--map-left': `${rect.left}px`,
        '--map-top': `${rect.top}px`,
        '--map-width': `${rect.width}px`,
        '--map-height': `${rect.height}px`,
        '--hud-score-left': scoreInGutter ? `${rect.left - 12}px` : `${Math.max(12, rect.left + 8)}px`,
        '--hud-score-transform': scoreInGutter ? 'translateX(-100%)' : 'none',
        '--hud-menu-left': menuInGutter
          ? `${rect.left + rect.width + 12}px`
          : `${rect.left + rect.width - 8}px`,
        '--hud-menu-transform': menuInGutter ? 'none' : 'translateX(-100%)',
      });
    }

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [world?.width, world?.height]);

  return vars;
}
