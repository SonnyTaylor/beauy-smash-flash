import { type CSSProperties } from 'react';
import { getCharacter, rgbCss } from '../character';
import { isLucaCharacter } from '../../content/characters';
import { EditableName } from '../components/EditableName';
import { CharacterGrid } from '../loadout/CharacterGrid';
import { WeaponPicker } from '../loadout/WeaponPicker';

export function ProfileScreen({
  playerName,
  selectedCharacterId,
  selectedWeaponId,
  onNameChange,
  onCharacterChange,
  onWeaponChange,
  onBack,
}: {
  playerName: string;
  selectedCharacterId: string;
  selectedWeaponId: string;
  onNameChange: (name: string) => void;
  onCharacterChange: (id: string) => void;
  onWeaponChange: (id: string) => void;
  onBack: () => void;
}) {
  const character = getCharacter(selectedCharacterId);
  const isLuca = isLucaCharacter(selectedCharacterId);

  return (
    <div className="loadout-shell">
      <header className="loadout-header">
        <div className="loadout-heading">
          <p className="screen-kicker">Player Profile</p>
          <h2 className="loadout-title">Your Profile</h2>
          <p className="loadout-subtitle">Set your defaults — name, character, and weapon.</p>
        </div>
        <div className="loadout-name-chip">
          <span className="meta-label">Display name</span>
          <EditableName value={playerName} onSubmit={onNameChange} />
        </div>
      </header>

      <div className="loadout-sections lobby-settings-scroll">
        <div className="loadout-body">
          <section className="loadout-section loadout-section-character">
            <header className="panel-heading">
              <h3>Character</h3>
              <span>{character.name}</span>
            </header>
            <div
              className="loadout-character-focus"
              style={{ '--accent': rgbCss(character.color) } as CSSProperties}
            >
              <span className="loadout-focus-portrait" aria-hidden="true">
                <img
                  src={`/assets/${character.sprite}`}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
                <span>{character.initials}</span>
              </span>
              <span className="loadout-focus-copy">
                <span className="loadout-focus-label">Default character</span>
                <strong>{character.name}</strong>
                <span className="ability-name">{character.abilityName}</span>
                <span className="ability-desc">{character.abilityDescription}</span>
              </span>
            </div>
            <div className="loadout-character-scroll lobby-settings-scroll">
              <CharacterGrid
                selectedCharacterId={selectedCharacterId}
                onSelect={onCharacterChange}
              />
            </div>
          </section>

          <section className="loadout-section loadout-section-weapon">
            <header className="panel-heading">
              <h3>Default Weapon</h3>
              <span>{isLuca ? 'Not for Luca' : character.name}</span>
            </header>
            {isLuca ? (
              <p className="setting-hint loadout-luca-weapon-note">
                Luca cannot equip weapons. You will spawn unarmed with 1 HP and reduced speed.
              </p>
            ) : (
              <WeaponPicker selectedWeaponId={selectedWeaponId} onSelect={onWeaponChange} />
            )}
          </section>
        </div>

        <p className="loadout-cosmetics-note">Cosmetics coming later: skins, trails, emotes.</p>
      </div>

      <footer className="loadout-footer">
        <button type="button" className="ghost-button" onClick={onBack}>
          Back
        </button>
        <button type="button" className="primary-action" onClick={onBack}>
          Save Settings
        </button>
      </footer>
    </div>
  );
}
