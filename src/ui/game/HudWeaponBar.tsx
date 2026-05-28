import { getWeapon } from '../../content/weapons';
import type { WeaponSlotSnapshot } from '../../shared/types';

function slotLabel(slot: WeaponSlotSnapshot | null | undefined, fallback: string): string {
  if (!slot) return 'Empty';
  return getWeapon(slot.weapon_id).name;
}

export function HudWeaponBar({
  activeWeapon,
  activeSlot,
  primary,
  secondary,
}: {
  activeWeapon: string;
  activeSlot: number;
  primary?: WeaponSlotSnapshot | null;
  secondary?: WeaponSlotSnapshot | null;
}) {
  const active = getWeapon(activeWeapon);

  return (
    <div className="hud-weapon-bar">
      <div className={`hud-weapon-slot ${activeSlot === 0 ? 'is-active' : ''}`}>
        <span className="hud-weapon-key">1</span>
        <span className="hud-weapon-name">{slotLabel(primary, active.name)}</span>
        {primary && (
          <span className="hud-weapon-ammo">
            {primary.ammo}/{primary.max_ammo}
          </span>
        )}
      </div>
      <div className={`hud-weapon-slot ${activeSlot === 1 ? 'is-active' : ''}`}>
        <span className="hud-weapon-key">2</span>
        <span className="hud-weapon-name">{slotLabel(secondary, 'Empty')}</span>
        {secondary && (
          <span className="hud-weapon-ammo">
            {secondary.ammo}/{secondary.max_ammo}
          </span>
        )}
      </div>
      <div className="hud-weapon-hint">
        <kbd>Q</kbd> swap
        <span className="dot">·</span>
        <kbd>G</kbd> drop
        <span className="dot">·</span>
        <kbd>F</kbd> pick up
      </div>
    </div>
  );
}
