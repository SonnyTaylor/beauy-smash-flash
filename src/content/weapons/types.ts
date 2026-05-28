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

export interface WeaponDefinition {
  id: string;
  name: string;
  meta: WeaponMeta;
  tagline: string;
}
