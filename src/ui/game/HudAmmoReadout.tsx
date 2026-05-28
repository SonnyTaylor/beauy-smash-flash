import { GLOCK_RELOAD_SECS } from '../constants';

export function HudAmmoReadout({
  ammo,
  maxAmmo,
  reloading,
  reloadRemaining,
}: {
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
  reloadRemaining: number;
}) {
  const isReloading = reloading || reloadRemaining > 0;
  const reloadRatio = isReloading
    ? Math.max(0, Math.min(1, 1 - reloadRemaining / GLOCK_RELOAD_SECS))
    : 0;
  const low = !isReloading && maxAmmo > 0 && ammo / maxAmmo <= 0.25;
  const empty = !isReloading && ammo <= 0;

  return (
    <div
      className={`hud-ammo ${isReloading ? 'is-reloading' : ''} ${low ? 'is-low' : ''} ${empty ? 'is-empty' : ''}`}
    >
      <div className="hud-ammo-num-row">
        <span className="hud-ammo-num">{isReloading ? '--' : ammo}</span>
        <span className="hud-ammo-max">/ {maxAmmo}</span>
      </div>
      <div className="hud-ammo-track">
        <div
          className="hud-ammo-fill"
          style={{ width: `${(isReloading ? reloadRatio : Math.max(0, Math.min(1, maxAmmo > 0 ? ammo / maxAmmo : 0))) * 100}%` }}
        />
      </div>
      <div className="hud-ammo-label">{isReloading ? 'Reloading' : empty ? 'Press R' : 'Ammo'}</div>
    </div>
  );
}
