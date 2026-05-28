export const LOGICAL_WIDTH = 1280;
export const LOGICAL_HEIGHT = 720;
export const CELL_SIZE = 40;
export const GRID_COLS = 32;
export const GRID_ROWS = 18;
export const PLAYER_RADIUS = 24;
export const MIN_SPAWN_SPREAD = 160;

export interface MapTheme {
  floor: string;
  grid: string;
  walls: string;
  wallStroke: string;
  accent: string;
}

export interface MapWallDef {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapGridDef {
  cols: number;
  rows: number;
  cell: number;
  solid: string[];
  spawn: string[];
}

export interface MapDefinition {
  id: string;
  name: string;
  tags?: string[];
  theme?: MapTheme;
  grid?: MapGridDef;
  walls?: MapWallDef[];
  spawns?: [number, number][];
}

export interface CompiledMap {
  id: string;
  name: string;
  tags: string[];
  theme: MapTheme;
  walls: MapWallDef[];
  spawns: [number, number][];
}

export const DEFAULT_THEME: MapTheme = {
  floor: '#0a0c16',
  grid: '#1a2038',
  walls: '#1c1f32',
  wallStroke: '#4a5278',
  accent: '#46e9ff',
};
