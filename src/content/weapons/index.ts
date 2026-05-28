import type { WeaponDefinition, WeaponMeta } from './types';
import { GLOCK_WEAPON } from './glock';
import { SCAR_WEAPON } from './scar';
import { SHOTGUN_WEAPON } from './shotgun';
import { RAYGUN_WEAPON } from './raygun';
import { LASER_GUN_WEAPON } from './laser_gun';
import { CHICKEN_BUCKET_WEAPON } from './chicken_bucket';
import { JARATE_WEAPON } from './jarate';
import { FECES_WEAPON } from './feces';
import { SWORD_WEAPON } from './sword';
import { YOGHURT_EFFECT_WEAPON } from './yoghurt_effect';

const GLOCK: WeaponDefinition = {
  id: 'glock',
  name: 'Glock',
  meta: GLOCK_WEAPON,
  tagline: 'Fast · reliable DPS',
};

const SCAR: WeaponDefinition = {
  id: 'scar',
  name: 'SCAR',
  meta: SCAR_WEAPON,
  tagline: 'Tap fire · steady AR',
};

const SHOTGUN: WeaponDefinition = {
  id: 'shotgun',
  name: 'Shotgun',
  meta: SHOTGUN_WEAPON,
  tagline: '6 pellets · knockback',
};

const RAYGUN: WeaponDefinition = {
  id: 'raygun',
  name: 'Ray Gun',
  meta: RAYGUN_WEAPON,
  tagline: 'Zaps · splash damage',
};

const LASER_GUN: WeaponDefinition = {
  id: 'laser_gun',
  name: 'Laser Gun',
  meta: LASER_GUN_WEAPON,
  tagline: 'Red beam · pin-point',
};

const CHICKEN_BUCKET: WeaponDefinition = {
  id: 'chicken_bucket',
  name: 'Chicken Bucket',
  meta: CHICKEN_BUCKET_WEAPON,
  tagline: 'Throws legs · greasy slow',
};

const JARATE: WeaponDefinition = {
  id: 'jarate',
  name: 'Jarate',
  meta: JARATE_WEAPON,
  tagline: 'Mark · +35% damage taken',
};

const FECES: WeaponDefinition = {
  id: 'feces',
  name: 'Tom Pearl\'s Shit',
  meta: FECES_WEAPON,
  tagline: 'Poisons · damage over time',
};

const SWORD: WeaponDefinition = {
  id: 'sword',
  name: 'Sword',
  meta: SWORD_WEAPON,
  tagline: 'Melee · big swing',
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
  [SCAR.id]: SCAR,
  [SHOTGUN.id]: SHOTGUN,
  [RAYGUN.id]: RAYGUN,
  [LASER_GUN.id]: LASER_GUN,
  [CHICKEN_BUCKET.id]: CHICKEN_BUCKET,
  [JARATE.id]: JARATE,
  [FECES.id]: FECES,
  [SWORD.id]: SWORD,
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
