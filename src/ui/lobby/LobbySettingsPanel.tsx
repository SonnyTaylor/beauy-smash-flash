import { MAPS } from '../../content/maps';
import type { Gamemode, LobbyConfig, WinCondition } from '../../shared/types';
import { Cycle, SettingRow } from '../components/CycleControl';
import {
  GAMEMODE_OPTIONS,
  MAX_PLAYERS_OPTIONS,
  SCORE_LIMIT_OPTIONS,
  TIME_LIMIT_OPTIONS,
  WIN_CONDITION_OPTIONS,
} from '../constants';
import { MapPreview } from './MapPreview';

export function LobbySettingsPanel({
  config,
  isHost,
  playerCount,
  onConfigChange,
}: {
  config: LobbyConfig;
  isHost: boolean;
  playerCount: number;
  onConfigChange: (config: LobbyConfig) => void;
}) {
  function patch(partial: Partial<LobbyConfig>) {
    onConfigChange({ ...config, ...partial });
  }

  function patchWinCondition(next: WinCondition) {
    const nextConfig: LobbyConfig = { ...config, win_condition: next };
    if (next !== 'kills' && nextConfig.time_limit_secs === 0) {
      nextConfig.time_limit_secs = 300;
    }
    onConfigChange(nextConfig);
  }

  const mapName = MAPS.find((map) => map.id === config.map_id)?.name ?? config.map_id;
  const gamemodeName =
    GAMEMODE_OPTIONS.find((option) => option.id === config.gamemode)?.label ?? config.gamemode;
  const winCondition =
    WIN_CONDITION_OPTIONS.find((option) => option.id === config.win_condition) ??
    WIN_CONDITION_OPTIONS[0];
  const timeLimitLabel =
    TIME_LIMIT_OPTIONS.find((option) => option.secs === config.time_limit_secs)?.label ??
    (config.time_limit_secs === 0 ? 'Off' : `${Math.round(config.time_limit_secs / 60)} min`);
  const showScoreLimit = config.win_condition !== 'time';
  const showTimeLimit = config.win_condition !== 'kills';

  return (
    <section className="lobby-settings">
      <header className="panel-heading">
        <h3>Server Settings</h3>
        <span>{isHost ? 'Host-only — changes broadcast live' : 'Set by the host'}</span>
      </header>

      <div className="lobby-settings-scroll">
        <SettingRow label="Server Name">
          <input
            type="text"
            className="settings-text-input"
            maxLength={32}
            value={config.server_name}
            disabled={!isHost}
            onChange={(event) => patch({ server_name: event.target.value })}
          />
        </SettingRow>

        <div className="map-setting-block">
          <SettingRow label="Map">
            <Cycle
              value={config.map_id}
              values={MAPS.map((map) => ({ id: map.id, label: map.name }))}
              disabled={!isHost || MAPS.length <= 1}
              onChange={(id) => patch({ map_id: id })}
              fallback={mapName}
            />
          </SettingRow>
          <MapPreview mapId={config.map_id} compact />
        </div>

        <SettingRow label="Gamemode">
          <Cycle
            value={config.gamemode}
            values={GAMEMODE_OPTIONS.map((option) => ({
              id: option.id,
              label: option.available ? option.label : `${option.label} (Soon)`,
              disabled: !option.available,
            }))}
            disabled={!isHost || GAMEMODE_OPTIONS.filter((option) => option.available).length <= 1}
            onChange={(id) => patch({ gamemode: id as Gamemode })}
            fallback={gamemodeName}
          />
        </SettingRow>
        {config.gamemode === 'last_mate_standing' && (
          <p className="setting-hint">No respawns — last player standing wins.</p>
        )}

        <SettingRow label="Win Condition">
          <Cycle
            value={config.win_condition}
            values={WIN_CONDITION_OPTIONS.map((option) => ({
              id: option.id,
              label: option.label,
            }))}
            disabled={!isHost}
            onChange={(id) => patchWinCondition(id as WinCondition)}
            fallback={winCondition.label}
          />
        </SettingRow>
        <p className="setting-hint">{winCondition.hint}</p>

        <SettingRow label="Max Players">
          <Cycle
            value={String(config.max_players)}
            values={MAX_PLAYERS_OPTIONS.filter((count) => count >= playerCount).map((count) => ({
              id: String(count),
              label: String(count),
            }))}
            disabled={!isHost}
            onChange={(id) => patch({ max_players: Number(id) })}
            fallback={String(config.max_players)}
          />
        </SettingRow>

        {showScoreLimit && (
          <SettingRow label="Score Limit">
            <Cycle
              value={String(config.score_limit)}
              values={SCORE_LIMIT_OPTIONS.map((value) => ({
                id: String(value),
                label: `${value} kills`,
              }))}
              disabled={!isHost}
              onChange={(id) => patch({ score_limit: Number(id) })}
              fallback={`${config.score_limit} kills`}
            />
          </SettingRow>
        )}

        {showTimeLimit && (
          <SettingRow label="Time Limit">
            <Cycle
              value={String(config.time_limit_secs)}
              values={TIME_LIMIT_OPTIONS.filter(
                (option) => option.secs > 0 || config.win_condition === 'either',
              ).map((option) => ({
                id: String(option.secs),
                label: option.label,
              }))}
              disabled={!isHost}
              onChange={(id) => patch({ time_limit_secs: Number(id) })}
              fallback={timeLimitLabel}
            />
          </SettingRow>
        )}

        <SettingRow label="Fog of War">
          <button
            type="button"
            className={`toggle-pill ${config.fog_of_war ? 'on' : 'off'}`}
            disabled={!isHost}
            onClick={() => patch({ fog_of_war: !config.fog_of_war })}
          >
            {config.fog_of_war ? 'On' : 'Off'}
          </button>
        </SettingRow>
        <p className="setting-hint">
          {config.fog_of_war
            ? 'Players only see enemies and shots within their vision radius.'
            : 'Full arena visibility — everyone sees the whole map.'}
        </p>

        <SettingRow label="Friendly Fire">
          <button
            type="button"
            className={`toggle-pill ${config.friendly_fire ? 'on' : 'off'}`}
            disabled={!isHost}
            onClick={() => patch({ friendly_fire: !config.friendly_fire })}
          >
            {config.friendly_fire ? 'On' : 'Off'}
          </button>
        </SettingRow>
        <p className="setting-hint">
          {config.friendly_fire
            ? 'Bullets damage other players.'
            : 'Bullets hit walls only — no player damage.'}
        </p>
      </div>
    </section>
  );
}
