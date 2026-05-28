import type { WeaponDefinition, WeaponMeta } from './types';
import { GLOCK_WEAPON } from './glock';
import { YOGHURT_EFFECT_WEAPON } from './yoghurt_effect';

const GLOCK: WeaponDefinition = {
  id: 'glock',
  name: 'Glock',
  meta: GLOCK_WEAPON,
  tagline: 'Fast · reliable DPS',
};

const YOGHURT_EFFECT: WeaponDefinition = {
  id: 'yoghurt_effect',
  name: 'Yoghurt Effect',
  meta: YOGHURT_EFFECT_WEAPON,
  tagline: 'Goo · slows on hit',
};

/** Add new weapons here once PNG + JSON metadata exist. */
export const WEAPONS: Record<string, WeaponDefinition> = {
  [GLOCK.id]: GLOCK,
  [YOGHURT_EFFECT.id]: YOGHURT_EFFECT,
};

export const DEFAULT_WEAPON_ID = 'glock';

export function getWeapon(id: string | undefined | null): WeaponDefinition {
  if (id && WEAPONS[id]) {
    return WEAPONS[id];
  }
  return GLOCK;
}

export function listWeapons(): WeaponDefinition[] {
  return Object.values(WEAPONS);
}

export function weaponOrbitPosition(meta: WeaponMeta, angle: number): { x: number; y: number } {
  const r = meta.orbitRadius;
  return {
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
  };
}

export function weaponMuzzleWorldOffset(
  meta: WeaponMeta,
  angle: number,
  scale = meta.displayScale,
): { x: number; y: number } {
  const w = meta.width * scale;
  const h = meta.height * scale;
  const localX = (meta.muzzle.x - meta.pivot.x) * w;
  const localY = (meta.muzzle.y - meta.pivot.y) * h;
  return {
    x: Math.cos(angle) * localX - Math.sin(angle) * localY,
    y: Math.sin(angle) * localX + Math.cos(angle) * localY,
  };
}
