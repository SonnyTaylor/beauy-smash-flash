import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compileMap } from '../maps/compile';
import { renderMapSvg } from '../maps/preview';
import type { MapDefinition } from '../maps/types';
import { validateMapDefinition } from '../maps/validate';

const root = resolve(import.meta.dir, '..');
const mapsDir = join(root, 'content', 'maps');
const previewDir = join(mapsDir, 'previews');
const publicPreviewDir = join(root, 'public', 'maps', 'previews');

function loadMaps(): MapDefinition[] {
  return readdirSync(mapsDir)
    .filter((name) => name.endsWith('.map.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(mapsDir, name), 'utf8')) as MapDefinition);
}

const command = process.argv[2] ?? 'validate';
const targetId = process.argv[3];

if (command === 'validate') {
  const maps = loadMaps();
  let failed = false;

  for (const map of maps) {
    const issues = validateMapDefinition(map);
    const errors = issues.filter((issue) => issue.level === 'error');
    const warnings = issues.filter((issue) => issue.level === 'warn');

    if (errors.length === 0 && warnings.length === 0) {
      console.log(`OK  ${map.id}`);
      continue;
    }

    for (const issue of errors) {
      failed = true;
      console.error(`ERR ${map.id}: ${issue.message}`);
    }
    for (const issue of warnings) {
      console.warn(`WRN ${map.id}: ${issue.message}`);
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log(`Validated ${maps.length} maps.`);
}

if (command === 'preview') {
  mkdirSync(previewDir, { recursive: true });
  mkdirSync(publicPreviewDir, { recursive: true });
  const maps = loadMaps().filter((map) => !targetId || map.id === targetId);

  if (maps.length === 0) {
    console.error(`No maps matched "${targetId ?? '*'}".`);
    process.exit(1);
  }

  for (const map of maps) {
    const svg = renderMapSvg(map);
    const paths = [
      join(previewDir, `${map.id}.svg`),
      join(publicPreviewDir, `${map.id}.svg`),
    ];
    for (const outPath of paths) {
      writeFileSync(outPath, svg, 'utf8');
      console.log(`Wrote ${outPath}`);
    }
  }
}

if (command === 'list') {
  for (const map of loadMaps()) {
    const compiled = compileMap(map);
    console.log(`${map.id}\t${map.name}\t${compiled.walls.length} walls\t${compiled.spawns.length} spawns`);
  }
}

if (!['validate', 'preview', 'list'].includes(command)) {
  console.error('Usage: bun run maps:validate | maps:preview [id] | maps:list');
  process.exit(1);
}
