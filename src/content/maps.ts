import type { MapSnapshot } from '../shared/types';

export const MAPS: MapSnapshot[] = [
  {
    id: 'warehouse',
    name: 'Warehouse',
    walls: [
      { x: -150, y: -150, w: 2220, h: 150 },
      { x: -150, y: 1080, w: 2220, h: 150 },
      { x: -150, y: 0, w: 150, h: 1080 },
      { x: 1920, y: 0, w: 150, h: 1080 },
      { x: 240, y: 120, w: 240, h: 180 },
      { x: 1440, y: 120, w: 240, h: 180 },
      { x: 240, y: 780, w: 240, h: 180 },
      { x: 1440, y: 780, w: 240, h: 180 },
      { x: 660, y: 360, w: 600, h: 60 },
      { x: 660, y: 660, w: 600, h: 60 },
      { x: 120, y: 420, w: 60, h: 240 },
      { x: 1740, y: 420, w: 60, h: 240 },
    ],
  },
];

export function getMap(id: string | undefined): MapSnapshot {
  return MAPS.find((map) => map.id === id) ?? MAPS[0];
}
