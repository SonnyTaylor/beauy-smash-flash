import { useState } from 'react';
import type { GameSettings } from '../../shared/types';
import { SettingRow } from '../components/CycleControl';

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
  const volumePercent = Math.round(draft.masterVolume * 100);

  return (
    <>
      <div className="brand-panel settings-brand">
        <p className="eyebrow">Preferences</p>
        <h1>
          Your
          <span>Setup</span>
        </h1>
        <p className="tagline">Saved on this device only — nothing leaves your LAN.</p>
        <ul className="join-tips">
          <li>
            <span className="join-tip-label">Host</span>
            <span>Default server name pre-fills when you create a lobby</span>
          </li>
          <li>
            <span className="join-tip-label">Audio</span>
            <span>Master volume controls combat sounds; toggle music separately below</span>
          </li>
          <li>
            <span className="join-tip-label">HUD</span>
            <span>Control hints show at the bottom of the screen in matches</span>
          </li>
        </ul>
      </div>

      <div className="screen-card settings-card">
        <section className="settings-panel">
          <header className="panel-heading">
            <h2>Settings</h2>
            <span>Stored on this device</span>
          </header>

          <div className="settings-form">
            <div className="settings-group">
              <SettingRow label="Default Server Name">
                <input
                  type="text"
                  className="settings-text-input"
                  maxLength={32}
                  value={draft.serverName}
                  onChange={(event) => setDraft({ ...draft, serverName: event.target.value })}
                  placeholder="LAN Game"
                />
              </SettingRow>
              <p className="setting-hint">Used when you host; changeable in the lobby.</p>
            </div>

            <div className="settings-group">
              <SettingRow label="Music">
                <button
                  type="button"
                  className={`toggle-pill ${draft.musicEnabled ? 'on' : 'off'}`}
                  onClick={() => setDraft({ ...draft, musicEnabled: !draft.musicEnabled })}
                >
                  {draft.musicEnabled ? 'On' : 'Off'}
                </button>
              </SettingRow>
              <p className="setting-hint">Menu, lobby, and match background music.</p>
            </div>

            <div className="settings-group">
              <div className="setting-row settings-volume-row">
                <span className="setting-label">Master Volume</span>
                <div className="setting-control settings-volume-control">
                  <input
                    type="range"
                    className="settings-volume-slider"
                    min={0}
                    max={100}
                    value={volumePercent}
                    onChange={(event) =>
                      setDraft({ ...draft, masterVolume: Number(event.target.value) / 100 })
                    }
                  />
                  <span className="settings-volume-value">{volumePercent}%</span>
                </div>
              </div>
              <p className="setting-hint">Gunfire, hits, abilities, and UI sounds.</p>
            </div>

            <div className="settings-group">
              <SettingRow label="Control Hints">
                <button
                  type="button"
                  className={`toggle-pill ${draft.showControlsHint ? 'on' : 'off'}`}
                  onClick={() =>
                    setDraft({ ...draft, showControlsHint: !draft.showControlsHint })
                  }
                >
                  {draft.showControlsHint ? 'On' : 'Off'}
                </button>
              </SettingRow>
              <p className="setting-hint">Show WASD / mouse controls at the bottom during matches.</p>
            </div>
          </div>

          <div className="settings-actions">
            <button type="button" className="ghost-button" onClick={onBack}>
              Back
            </button>
            <button type="button" className="primary-action" onClick={() => onSave(draft)}>
              Save
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
