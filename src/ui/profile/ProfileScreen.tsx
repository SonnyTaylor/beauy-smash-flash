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
    <>
      <div className="brand-panel profile-brand">
        <p className="eyebrow">Player Profile</p>
        <h1>
          Your
          <span>Mate</span>
        </h1>
        <p className="tagline">Set your defaults — name, character, and weapon.</p>
        <ul className="join-tips">
          <li>
            <span className="join-tip-label">Name</span>
            <span>Shown in lobbies, scoreboards, and kill feeds</span>
          </li>
          <li>
            <span className="join-tip-label">Character</span>
            <span>Each mate has a unique ability and personality</span>
          </li>
          <li>
            <span className="join-tip-label">Weapon</span>
            <span>Your default starting gun when joining a match</span>
          </li>
        </ul>
      </div>

      <div className="screen-card profile-card">
        <section className="settings-panel profile-panel">
          <header className="panel-heading">
            <h2>Profile</h2>
            <span>Stored on this device</span>
          </header>

          <div className="profile-form">
            <div className="settings-group profile-name-chip">
              <div className="setting-row" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                <span className="setting-label">Display Name</span>
                <EditableName value={playerName} onSubmit={onNameChange} />
              </div>
              <p className="setting-hint">Max 24 characters. Used everywhere your name appears.</p>
            </div>

            <div className="settings-group">
              <div className="profile-character-focus" style={{ '--accent': rgbCss(character.color) } as CSSProperties}>
                <span className="profile-focus-portrait" aria-hidden="true">
                  <img
                    src={`/assets/${character.sprite}`}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                  <span>{character.initials}</span>
                </span>
                <span className="profile-focus-copy">
                  <span className="profile-focus-label">Default character</span>
                  <strong>{character.name}</strong>
                  <span className="ability-name">{character.abilityName}</span>
                  <span className="ability-desc">{character.abilityDescription}</span>
                </span>
              </div>
              <div className="profile-character-scroll lobby-settings-scroll">
                <CharacterGrid
                  selectedCharacterId={selectedCharacterId}
                  onSelect={onCharacterChange}
                />
              </div>
            </div>

            <div className="settings-group">
              <header className="panel-heading panel-heading-inline">
                <h3>Default Weapon</h3>
                <span>{isLuca ? 'Not for Luca' : character.name}</span>
              </header>
              {isLuca ? (
                <p className="setting-hint loadout-luca-weapon-note">
                  Luca cannot equip weapons. You will spawn unarmed with 1 HP and reduced speed.
                </p>
              ) : (
                <div className="profile-weapon-picker">
                  <WeaponPicker selectedWeaponId={selectedWeaponId} onSelect={onWeaponChange} />
                </div>
              )}
            </div>

            <div className="settings-group profile-cosmetics-group">
              <header className="panel-heading panel-heading-inline">
                <h3>Cosmetics</h3>
                <span>Coming soon</span>
              </header>
              <div className="profile-cosmetics-placeholder">
                <p className="setting-hint">
                  Skins, weapon charms, trails, and emotes are on the roadmap.
                </p>
              </div>
            </div>
          </div>

          <div className="settings-actions">
            <button type="button" className="ghost-button" onClick={onBack}>
              Back
            </button>
            <button type="button" className="primary-action" onClick={onBack}>
              Save Settings
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
