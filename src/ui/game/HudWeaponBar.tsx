import { getWeapon } from '../../content/weapons';
import type { WeaponSlotSnapshot } from '../../shared/types';

function slotLabel(slot: WeaponSlotSnapshot | null | undefined, fallback: string): string {
  if (!slot) return 'Empty';
  return getWeapon(slot.weapon_id).name;
}

function WeaponIcon({ weaponId }: { weaponId: string }) {
  const weapon = getWeapon(weaponId);
  return (
    <span className="hud-weapon-icon" aria-hidden>
      <img
        src={`/assets/weapons/${weaponId}.png`}
        alt=""
        draggable={false}
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
      <span>{weapon.name.slice(0, 2).toUpperCase()}</span>
    </span>
  );
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
      <div className="hud-weapon-slots">
        <div className={`hud-weapon-slot ${activeSlot === 0 ? 'is-active' : ''}`}>
          <span className="hud-weapon-key">1</span>
          {primary ? <WeaponIcon weaponId={primary.weapon_id} /> : null}
          <span className="hud-weapon-name">{slotLabel(primary, active.name)}</span>
          {primary && (
            <span className="hud-weapon-ammo">
              {primary.ammo}/{primary.max_ammo}
            </span>
          )}
        </div>
        <div className={`hud-weapon-slot ${activeSlot === 1 ? 'is-active' : ''}`}>
          <span className="hud-weapon-key">2</span>
          {secondary ? <WeaponIcon weaponId={secondary.weapon_id} /> : null}
          <span className="hud-weapon-name">{slotLabel(secondary, 'Empty')}</span>
          {secondary && (
            <span className="hud-weapon-ammo">
              {secondary.ammo}/{secondary.max_ammo}
            </span>
          )}
        </div>
      </div>
      <div className="hud-weapon-hint" aria-label="Weapon controls">
        <span>
          <kbd>Q</kbd> swap
        </span>
        <span>
          <kbd>G</kbd> drop
        </span>
        <span>
          <kbd>F</kbd> pick up
        </span>
      </div>
    </div>
  );
}
