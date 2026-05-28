import { listWeapons } from '../../content/weapons';

export function WeaponPicker({
  selectedWeaponId,
  onSelect,
}: {
  selectedWeaponId: string;
  onSelect: (id: string) => void;
}) {
  const weapons = listWeapons();

  return (
    <div className="weapon-picker">
      {weapons.map((weapon) => (
        <button
          key={weapon.id}
          type="button"
          className={`weapon-card ${weapon.id === selectedWeaponId ? 'selected' : ''}`}
          onClick={() => onSelect(weapon.id)}
        >
          <span className="weapon-card-art" aria-hidden>
            <img
              src={`/assets/weapons/${weapon.id}.png`}
              alt=""
              draggable={false}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </span>
          <span className="weapon-card-body">
            <strong>{weapon.name}</strong>
            <span className="weapon-card-hint">{weapon.tagline}</span>
          </span>
          <span className="selected-tag">Selected</span>
        </button>
      ))}
    </div>
  );
}
