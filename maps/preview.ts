import { compileMap } from './compile';
import { CELL_SIZE, GRID_COLS, GRID_ROWS, LOGICAL_HEIGHT, LOGICAL_WIDTH, type MapDefinition } from './types';

export function renderMapSvg(definition: MapDefinition): string {
  const compiled = compileMap(definition);
  const padding = 24;
  const width = LOGICAL_WIDTH + padding * 2;
  const height = LOGICAL_HEIGHT + padding * 2;
  const theme = compiled.theme;

  const gridLines: string[] = [];
  for (let x = 0; x <= GRID_COLS; x += 1) {
    const px = padding + x * CELL_SIZE;
    gridLines.push(
      `<line x1="${px}" y1="${padding}" x2="${px}" y2="${padding + LOGICAL_HEIGHT}" stroke="${theme.grid}" stroke-width="1" opacity="0.35"/>`,
    );
  }
  for (let y = 0; y <= GRID_ROWS; y += 1) {
    const py = padding + y * CELL_SIZE;
    gridLines.push(
      `<line x1="${padding}" y1="${py}" x2="${padding + LOGICAL_WIDTH}" y2="${py}" stroke="${theme.grid}" stroke-width="1" opacity="0.35"/>`,
    );
  }

  const walls = compiled.walls
    .map(
      (wall) =>
        `<rect x="${padding + wall.x}" y="${padding + wall.y}" width="${wall.w}" height="${wall.h}" rx="4" fill="${theme.walls}" stroke="${theme.wallStroke}" stroke-width="2"/>`,
    )
    .join('\n');

  const spawns = compiled.spawns
    .map(
      (spawn, index) =>
        `<g><circle cx="${padding + spawn[0]}" cy="${padding + spawn[1]}" r="18" fill="${theme.accent}" opacity="0.85"/><text x="${padding + spawn[0]}" y="${padding + spawn[1] + 5}" text-anchor="middle" fill="#041018" font-family="Impact, sans-serif" font-size="16">${index + 1}</text></g>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#060810"/>
  <rect x="${padding}" y="${padding}" width="${LOGICAL_WIDTH}" height="${LOGICAL_HEIGHT}" fill="${theme.floor}" stroke="${theme.wallStroke}" stroke-width="4"/>
  ${gridLines.join('\n')}
  ${walls}
  ${spawns}
  <text x="${padding}" y="18" fill="#9aa3c7" font-family="Segoe UI, sans-serif" font-size="14">${compiled.name} (${compiled.id})</text>
</svg>`;
}
