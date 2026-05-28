import { useState } from 'react';
import type { GameSettings } from '../../shared/types';

export function SettingsScreen({
  settings,
  onSave,
  onBack,
}: {
  settings: GameSettings;
  onSave: (settings: GameSettings) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState(settings);

  return (
    <section className="settings-screen">
      <header className="panel-heading">
        <h2>Settings</h2>
        <span>Stored on this device</span>
      </header>

      <div className="settings-form">
        <label className="settings-field">
          <span>Default server name</span>
          <input
            type="text"
            maxLength={32}
            value={draft.serverName}
            onChange={(event) => setDraft({ ...draft, serverName: event.target.value })}
            placeholder="LAN Game"
          />
          <small>Used when you host; changeable in the lobby.</small>
        </label>

        <label className="settings-field">
          <span>Master volume</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(draft.masterVolume * 100)}
            onChange={(event) =>
              setDraft({ ...draft, masterVolume: Number(event.target.value) / 100 })
            }
          />
          <small>{Math.round(draft.masterVolume * 100)}% — audio coming soon</small>
        </label>

        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={draft.showControlsHint}
            onChange={(event) => setDraft({ ...draft, showControlsHint: event.target.checked })}
          />
          <span>Show control hints in-game</span>
        </label>
      </div>

      <div className="settings-actions">
        <button type="button" className="ghost-button" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="primary-action"
          onClick={() => onSave(draft)}
        >
          Save
        </button>
      </div>
    </section>
  );
}
