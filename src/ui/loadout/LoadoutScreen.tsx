import { getCharacter } from '../character';
import { EditableName } from '../components/EditableName';
import type { SessionKind } from '../navigation';
import { CharacterGrid } from './CharacterGrid';
import { WeaponPicker } from './WeaponPicker';

export type LoadoutMode = 'pregame' | 'session';

export function LoadoutScreen({
  mode,
  sessionKind,
  playerName,
  selectedCharacterId,
  selectedWeaponId,
  isBusy,
  error,
  onNameChange,
  onCharacterChange,
  onWeaponChange,
  onBack,
  onContinue,
}: {
  mode: LoadoutMode;
  sessionKind: SessionKind;
  playerName: string;
  selectedCharacterId: string;
  selectedWeaponId: string;
  isBusy: boolean;
  error: string | null;
  onNameChange: (name: string) => void;
  onCharacterChange: (id: string) => void;
  onWeaponChange: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const character = getCharacter(selectedCharacterId);
  const isHost = sessionKind === 'host';
  const inSession = mode === 'session';

  let continueLabel = isHost ? 'Enter Lobby' : 'Join Lobby';
  if (inSession) {
    continueLabel = isBusy ? 'Saving…' : 'Save Loadout';
  } else if (isBusy) {
    continueLabel = isHost ? 'Hosting…' : 'Joining…';
  }

  return (
    <div className="loadout-shell">
      <header className="loadout-header">
        <div className="loadout-heading">
          <p className="screen-kicker">
            {inSession ? 'Loadout' : `${isHost ? 'Host' : 'Join'} · Loadout`}
          </p>
          <h2 className="loadout-title">Gear Up</h2>
          <p className="loadout-subtitle">
            {inSession
              ? 'Class changes on your next death. Weapon swaps immediately.'
              : 'Choose mate and weapon before the lobby.'}
          </p>
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
              <span>
                {character.name} · {character.abilityName}
              </span>
            </header>
            <div className="loadout-character-scroll lobby-settings-scroll">
              <CharacterGrid
                selectedCharacterId={selectedCharacterId}
                onSelect={onCharacterChange}
              />
            </div>
          </section>

          <section className="loadout-section loadout-section-weapon">
            <header className="panel-heading">
              <h3>Weapon</h3>
              <span>{inSession ? 'Swaps on save' : 'Your starting weapon'}</span>
            </header>
            <WeaponPicker selectedWeaponId={selectedWeaponId} onSelect={onWeaponChange} />
          </section>
        </div>

        <p className="loadout-cosmetics-note">
          <strong>Cosmetics</strong> coming soon — skins, trails, and emotes.
        </p>
      </div>

      {error && <p className="error-text loadout-error">{error}</p>}

      <footer className="loadout-footer">
        <button type="button" className="ghost-button" onClick={onBack} disabled={isBusy}>
          Back
        </button>
        <button type="button" className="primary-action" onClick={onContinue} disabled={isBusy}>
          {continueLabel}
        </button>
      </footer>
    </div>
  );
}
