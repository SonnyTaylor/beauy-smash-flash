import { compileMap } from './compile';
import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  MIN_SPAWN_SPREAD,
  PLAYER_RADIUS,
  type CompiledMap,
  type MapDefinition,
} from './types';

export interface MapValidationIssue {
  level: 'error' | 'warn';
  message: string;
}

function circleHitsRect(x: number, y: number, radius: number, rect: { x: number; y: number; w: number; h: number }) {
  const closestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function isWalkable(x: number, y: number, walls: CompiledMap['walls']) {
  if (x < PLAYER_RADIUS || y < PLAYER_RADIUS || x > LOGICAL_WIDTH - PLAYER_RADIUS || y > LOGICAL_HEIGHT - PLAYER_RADIUS) {
    return false;
  }
  return !walls.some((wall) => circleHitsRect(x, y, PLAYER_RADIUS, wall));
}

function floodReachable(start: [number, number], walls: CompiledMap['walls']) {
  const visited = new Set<string>();
  const queue: [number, number][] = [start];

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = `${Math.round(x)}:${Math.round(y)}`;
    if (visited.has(key)) continue;
    visited.add(key);

    for (const [dx, dy] of [
      [40, 0],
      [-40, 0],
      [0, 40],
      [0, -40],
    ] as const) {
      const next: [number, number] = [x + dx, y + dy];
      if (isWalkable(next[0], next[1], walls)) {
        queue.push(next);
      }
    }
  }

  return visited;
}

export function validateCompiledMap(map: CompiledMap): MapValidationIssue[] {
  const issues: MapValidationIssue[] = [];

  if (map.spawns.length < 2) {
    issues.push({ level: 'error', message: 'Need at least 2 spawn points' });
  }

  for (const [index, spawn] of map.spawns.entries()) {
    if (!isWalkable(spawn[0], spawn[1], map.walls)) {
      issues.push({ level: 'error', message: `Spawn ${index + 1} overlaps a wall or border` });
    }
  }

  for (let i = 0; i < map.spawns.length; i += 1) {
    for (let j = i + 1; j < map.spawns.length; j += 1) {
      const a = map.spawns[i];
      const b = map.spawns[j];
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dist = Math.hypot(dx, dy);
      if (dist < MIN_SPAWN_SPREAD) {
        issues.push({
          level: 'warn',
          message: `Spawns ${i + 1} and ${j + 1} are only ${Math.round(dist)}px apart (min spread ${MIN_SPAWN_SPREAD})`,
        });
      }
    }
  }

  const reachable = floodReachable(map.spawns[0], map.walls);
  for (const [index, spawn] of map.spawns.entries()) {
    const key = `${Math.round(spawn[0])}:${Math.round(spawn[1])}`;
    if (!reachable.has(key)) {
      issues.push({ level: 'error', message: `Spawn ${index + 1} is unreachable from spawn 1` });
    }
  }

  return issues;
}

export function validateMapDefinition(definition: MapDefinition): MapValidationIssue[] {
  const issues: MapValidationIssue[] = [];

  if (!definition.id.trim()) {
    issues.push({ level: 'error', message: 'Map id is required' });
  }
  if (!definition.name.trim()) {
    issues.push({ level: 'error', message: 'Map name is required' });
  }

  try {
    const compiled = compileMap(definition);
    issues.push(...validateCompiledMap(compiled));
  } catch (error) {
    issues.push({ level: 'error', message: String(error) });
  }

  return issues;
}

export function assertValidMapDefinition(definition: MapDefinition) {
  const issues = validateMapDefinition(definition).filter((issue) => issue.level === 'error');
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join('; '));
  }
}
