import { MAPS } from '../../content/maps';
import type { Gamemode, LobbyConfig } from '../../shared/types';
import { Cycle, SettingRow } from '../components/CycleControl';
import { GAMEMODE_OPTIONS, MAX_PLAYERS_OPTIONS, SCORE_LIMIT_OPTIONS } from '../constants';
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

  const mapName = MAPS.find((map) => map.id === config.map_id)?.name ?? config.map_id;
  const gamemodeName =
    GAMEMODE_OPTIONS.find((option) => option.id === config.gamemode)?.label ?? config.gamemode;

  return (
    <section className="lobby-settings">
      <header className="panel-heading">
        <h3>Server Settings</h3>
        <span>{isHost ? 'Host-only — changes broadcast live' : 'Set by the host'}</span>
      </header>

      <div className="lobby-settings-scroll">
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
            values={GAMEMODE_OPTIONS.filter((option) => option.available).map((option) => ({
              id: option.id,
              label: option.label,
            }))}
            disabled={!isHost || GAMEMODE_OPTIONS.filter((option) => option.available).length <= 1}
            onChange={(id) => patch({ gamemode: id as Gamemode })}
            fallback={gamemodeName}
          />
        </SettingRow>

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
      </div>
    </section>
  );
}
