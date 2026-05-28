import meta from './glock.json';

export interface WeaponMeta {
  id: string;
  sprite: string;
  width: number;
  height: number;
  displayScale: number;
  orbitRadius: number;
  pivot: { x: number; y: number };
  muzzle: { x: number; y: number };
  defaultRotation: number;
}

export const GLOCK_WEAPON: WeaponMeta = meta;

export function weaponMuzzleWorldOffset(angle: number, scale: number): { x: number; y: number } {
  const w = GLOCK_WEAPON.width * scale;
  const h = GLOCK_WEAPON.height * scale;
  const localX = (GLOCK_WEAPON.muzzle.x - GLOCK_WEAPON.pivot.x) * w;
  const localY = (GLOCK_WEAPON.muzzle.y - GLOCK_WEAPON.pivot.y) * h;
  return {
    x: Math.cos(angle) * localX - Math.sin(angle) * localY,
    y: Math.sin(angle) * localX + Math.cos(angle) * localY,
  };
}

export function weaponOrbitPosition(angle: number): { x: number; y: number } {
  const r = GLOCK_WEAPON.orbitRadius;
  return {
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
  };
}
