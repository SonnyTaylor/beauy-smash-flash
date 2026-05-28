import {
  CELL_SIZE,
  DEFAULT_THEME,
  GRID_COLS,
  GRID_ROWS,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  type CompiledMap,
  type MapDefinition,
  type MapGridDef,
  type MapWallDef,
} from './types';

function assertGridDimensions(grid: MapGridDef) {
  if (grid.cols !== GRID_COLS || grid.rows !== GRID_ROWS) {
    throw new Error(`Grid must be ${GRID_COLS}x${GRID_ROWS}, got ${grid.cols}x${grid.rows}`);
  }
  if (grid.cell !== CELL_SIZE) {
    throw new Error(`Grid cell size must be ${CELL_SIZE}, got ${grid.cell}`);
  }
  if (grid.solid.length !== grid.rows) {
    throw new Error(`Solid layer must have ${grid.rows} rows`);
  }
  if (grid.spawn.length !== grid.rows) {
    throw new Error(`Spawn layer must have ${grid.rows} rows`);
  }
  for (const row of grid.solid) {
    if (row.length !== grid.cols) {
      throw new Error(`Solid row width must be ${grid.cols}`);
    }
  }
  for (const row of grid.spawn) {
    if (row.length !== grid.cols) {
      throw new Error(`Spawn row width must be ${grid.cols}`);
    }
  }
}

function mergeWallRects(cells: boolean[][]): MapWallDef[] {
  const rects: MapWallDef[] = [];
  const cell = CELL_SIZE;

  for (let row = 0; row < cells.length; row += 1) {
    let col = 0;
    while (col < cells[row].length) {
      if (!cells[row][col]) {
        col += 1;
        continue;
      }

      let width = 1;
      while (col + width < cells[row].length && cells[row][col + width]) {
        width += 1;
      }

      let height = 1;
      let canGrow = true;
      while (canGrow && row + height < cells.length) {
        for (let probe = 0; probe < width; probe += 1) {
          if (!cells[row + height][col + probe]) {
            canGrow = false;
            break;
          }
        }
        if (canGrow) {
          height += 1;
        }
      }

      for (let y = row; y < row + height; y += 1) {
        for (let x = col; x < col + width; x += 1) {
          cells[y][x] = false;
        }
      }

      rects.push({
        id: `cell-${col}-${row}`,
        x: col * cell,
        y: row * cell,
        w: width * cell,
        h: height * cell,
      });

      col += width;
    }
  }

  return rects;
}

export function compileGrid(grid: MapGridDef): { walls: MapWallDef[]; spawns: [number, number][] } {
  assertGridDimensions(grid);

  const cells: boolean[][] = grid.solid.map((row) =>
    [...row].map((char) => char === '#' || char === '█'),
  );

  const walls = mergeWallRects(cells);
  const spawns: [number, number][] = [];

  for (let row = 0; row < grid.spawn.length; row += 1) {
    const line = grid.spawn[row];
    for (let col = 0; col < line.length; col += 1) {
      const char = line[col];
      if (char >= '1' && char <= '9') {
        spawns.push([col * grid.cell + grid.cell / 2, row * grid.cell + grid.cell / 2]);
      }
    }
  }

  spawns.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { walls, spawns };
}

export function compileMap(definition: MapDefinition): CompiledMap {
  let walls = definition.walls ?? [];
  let spawns = definition.spawns ?? [];

  if (definition.grid) {
    const compiled = compileGrid(definition.grid);
    walls = compiled.walls;
    spawns = compiled.spawns;
  }

  if (walls.length === 0) {
    throw new Error(`Map "${definition.id}" has no walls`);
  }
  if (spawns.length === 0) {
    throw new Error(`Map "${definition.id}" has no spawn points`);
  }

  return {
    id: definition.id,
    name: definition.name,
    tags: definition.tags ?? [],
    theme: definition.theme ?? DEFAULT_THEME,
    walls,
    spawns,
  };
}

export function scaleCompiledMap(map: CompiledMap, width = 1920, height = 1080): CompiledMap {
  const sx = width / LOGICAL_WIDTH;
  const sy = height / LOGICAL_HEIGHT;

  return {
    ...map,
    walls: map.walls.map((wall) => ({
      ...wall,
      x: wall.x * sx,
      y: wall.y * sy,
      w: wall.w * sx,
      h: wall.h * sy,
    })),
    spawns: map.spawns.map(([x, y]) => [x * sx, y * sy]),
  };
}
