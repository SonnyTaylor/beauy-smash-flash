import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compileMap } from '../maps/compile';
import { validateCompiledMap } from '../maps/validate';
import type { MapDefinition } from '../maps/types';

const COLS = 32;
const ROWS = 18;

function blank(): string[] {
  return Array.from({ length: ROWS }, () => '.'.repeat(COLS));
}

function setChar(row: string, col: number, value: string): string {
  return `${row.slice(0, col)}${value}${row.slice(col + 1)}`;
}

function border(rows: string[]): string[] {
  const next = [...rows];
  for (let col = 0; col < COLS; col += 1) {
    next[0] = setChar(next[0], col, '#');
    next[ROWS - 1] = setChar(next[ROWS - 1], col, '#');
  }
  for (let row = 0; row < ROWS; row += 1) {
    next[row] = setChar(next[row], 0, '#');
    next[row] = setChar(next[row], COLS - 1, '#');
  }
  return next;
}

function fillRect(rows: string[], x: number, y: number, w: number, h: number): string[] {
  const next = [...rows];
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      next[row] = setChar(next[row], col, '#');
    }
  }
  return next;
}

function placeSpawns(solid: string[], points: Array<[number, number]>): string[] {
  const spawn = blank();
  let next = spawn;
  points.forEach(([col, row], index) => {
    if (solid[row][col] === '#') {
      throw new Error(`Spawn ${index + 1} at (${col}, ${row}) is inside a wall`);
    }
    next = next.map((line, rowIndex) =>
      rowIndex === row ? setChar(line, col, String(index + 1)) : line,
    );
  });
  return next;
}

function assertRows(label: string, rows: string[]) {
  if (rows.length !== ROWS) throw new Error(`${label} must have ${ROWS} rows`);
  for (const [index, row] of rows.entries()) {
    if (row.length !== COLS) {
      throw new Error(`${label} row ${index} has width ${row.length}, expected ${COLS}`);
    }
  }
}

function writeMap(definition: MapDefinition) {
  assertRows(`${definition.id} solid`, definition.grid!.solid);
  assertRows(`${definition.id} spawn`, definition.grid!.spawn);
  const compiled = compileMap(definition);
  const issues = validateCompiledMap(compiled).filter((issue) => issue.level === 'error');
  if (issues.length > 0) {
    throw new Error(`${definition.id}: ${issues.map((issue) => issue.message).join('; ')}`);
  }
  const outPath = join(resolve(import.meta.dir, '..', 'content', 'maps'), `${definition.id}.map.json`);
  writeFileSync(outPath, `${JSON.stringify(definition, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outPath}`);
}

function publish(definition: MapDefinition) {
  writeMap(definition);
}

let solid = border(blank());
// Vertical spine with a mid choke gap — true left/right lanes
solid = fillRect(solid, 15, 2, 2, 4);
solid = fillRect(solid, 15, 11, 2, 4);
solid = fillRect(solid, 6, 7, 7, 2);
solid = fillRect(solid, 19, 7, 7, 2);
// Lane cover strips (not corner boxes)
solid = fillRect(solid, 4, 3, 4, 2);
solid = fillRect(solid, 4, 13, 4, 2);
solid = fillRect(solid, 7, 5, 2, 5);
solid = fillRect(solid, 24, 3, 4, 2);
solid = fillRect(solid, 24, 13, 4, 2);
solid = fillRect(solid, 23, 5, 2, 5);
publish({
  id: 'split',
  name: 'Split',
  tags: ['vertical', 'two-lane', 'symmetric'],
  theme: {
    floor: '#0a1018',
    grid: '#182030',
    walls: '#1a2438',
    wallStroke: '#4a6888',
    accent: '#46e9ff',
  },
  grid: {
    cols: COLS,
    rows: ROWS,
    cell: 40,
    solid,
    spawn: placeSpawns(solid, [
      [2, 2],
      [29, 2],
      [2, 15],
      [29, 15],
      [10, 10],
      [21, 10],
    ]),
  },
});

solid = border(blank());
// Broken horizontal midline — top and bottom zones linked by wide side + center lanes
solid = fillRect(solid, 8, 8, 4, 2);
solid = fillRect(solid, 20, 8, 4, 2);
solid = fillRect(solid, 7, 3, 4, 2);
solid = fillRect(solid, 21, 3, 4, 2);
solid = fillRect(solid, 7, 13, 4, 2);
solid = fillRect(solid, 21, 13, 4, 2);
solid = fillRect(solid, 14, 3, 4, 2);
solid = fillRect(solid, 14, 13, 4, 2);
publish({
  id: 'midline',
  name: 'Midline',
  tags: ['horizontal', 'north-south', 'symmetric'],
  theme: {
    floor: '#100a14',
    grid: '#241830',
    walls: '#22182c',
    wallStroke: '#684878',
    accent: '#ff4da6',
  },
  grid: {
    cols: COLS,
    rows: ROWS,
    cell: 40,
    solid,
    spawn: placeSpawns(solid, [
      [2, 2],
      [29, 2],
      [16, 7],
      [3, 14],
      [28, 14],
      [16, 11],
    ]),
  },
});

solid = border(blank());
solid = fillRect(solid, 8, 4, 16, 10);
publish({
  id: 'rings',
  name: 'Rings',
  tags: ['rotation', 'perimeter', 'medium'],
  theme: {
    floor: '#081210',
    grid: '#142420',
    walls: '#162820',
    wallStroke: '#3f7858',
    accent: '#50ff88',
  },
  grid: {
    cols: COLS,
    rows: ROWS,
    cell: 40,
    solid,
    spawn: placeSpawns(solid, [
      [4, 4],
      [27, 4],
      [4, 13],
      [27, 13],
      [15, 2],
      [15, 15],
    ]),
  },
});

solid = border(blank());
// Three routes converging on an open central hub
solid = fillRect(solid, 13, 4, 6, 2);
solid = fillRect(solid, 10, 6, 2, 4);
solid = fillRect(solid, 20, 6, 2, 4);
solid = fillRect(solid, 5, 11, 3, 2);
solid = fillRect(solid, 24, 11, 3, 2);
solid = fillRect(solid, 13, 12, 6, 2);
solid = fillRect(solid, 8, 11, 2, 3);
solid = fillRect(solid, 22, 11, 2, 3);
solid = fillRect(solid, 3, 4, 2, 4);
solid = fillRect(solid, 27, 4, 2, 4);
publish({
  id: 'fork',
  name: 'Fork',
  tags: ['three-way', 'hub', 'ambush'],
  theme: {
    floor: '#120c08',
    grid: '#302018',
    walls: '#2a1c14',
    wallStroke: '#886040',
    accent: '#ffb347',
  },
  grid: {
    cols: COLS,
    rows: ROWS,
    cell: 40,
    solid,
    spawn: placeSpawns(solid, [
      [16, 2],
      [7, 15],
      [25, 15],
      [2, 8],
      [29, 8],
      [16, 15],
    ]),
  },
});
