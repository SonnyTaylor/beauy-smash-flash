import split from '../../content/maps/split.map.json';
import midline from '../../content/maps/midline.map.json';
import rings from '../../content/maps/rings.map.json';
import fork from '../../content/maps/fork.map.json';
import { compileMap, scaleCompiledMap } from '../../maps/compile';
import type { MapDefinition, MapTheme } from '../../maps/types';
import { DEFAULT_THEME } from '../../maps/types';
import type { MapSnapshot } from '../shared/types';

const MAP_DEFINITIONS = [split, midline, rings, fork] as MapDefinition[];

export interface MapCatalogEntry extends MapSnapshot {
  theme: MapTheme;
  tags: string[];
}

function toCatalogEntry(definition: MapDefinition): MapCatalogEntry {
  const compiled = scaleCompiledMap(compileMap(definition));
  return {
    id: compiled.id,
    name: compiled.name,
    tags: compiled.tags,
    theme: compiled.theme,
    walls: compiled.walls.map((wall) => ({
      x: wall.x,
      y: wall.y,
      w: wall.w,
      h: wall.h,
    })),
  };
}

export const MAPS: MapCatalogEntry[] = MAP_DEFINITIONS.map(toCatalogEntry);

export function getMap(id: string | undefined): MapCatalogEntry {
  return MAPS.find((map) => map.id === id) ?? MAPS[0];
}

export function getMapTheme(id: string | undefined): MapTheme {
  return getMap(id).theme ?? DEFAULT_THEME;
}

export function getMapPreviewUrl(id: string): string {
  return `/maps/previews/${id}.svg`;
}

export const DEFAULT_MAP_ID = MAPS[0]?.id ?? 'split';
