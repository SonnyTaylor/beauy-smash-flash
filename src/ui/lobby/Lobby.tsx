import { type CSSProperties } from 'react';
import { CopyChip } from '../components/CopyChip';
import { DEFAULT_WEAPON_ID } from '../../content/weapons';
import {
  DEFAULT_LOBBY_CONFIG,
  type LobbyConfig,
  type LobbySnapshot,
  type StateSnapshot,
} from '../../shared/types';
import type { SessionKind } from '../navigation';
import { LobbySettingsPanel } from './LobbySettingsPanel';
import { PlayerSlot } from './PlayerSlot';
import type { LobbyPlayerView } from './types';

export function Lobby({
  sessionKind,
  lobby,
  fallbackPlayers,
  isReady,
  isBusy,
  error,
  myId,
  localIp,
  playerName,
  onReadyChange,
  onNameChange,
  onConfigChange,
  onLeave,
  onChangeLoadout,
  onStart,
}: {
  sessionKind: SessionKind;
  lobby: LobbySnapshot | null;
  fallbackPlayers: StateSnapshot['players'];
  isReady: boolean;
  isBusy: boolean;
  error: string | null;
  myId: number;
  localIp: string | null;
  playerName: string;
  onReadyChange: (ready: boolean) => void;
  onNameChange: (name: string) => void;
  onConfigChange: (config: LobbyConfig) => void;
  onLeave: () => void;
  onChangeLoadout: () => void;
  onStart: () => void;
}) {
  const isHost = sessionKind === 'host';
  const config = lobby?.config ?? DEFAULT_LOBBY_CONFIG;

  const lobbyPlayers: LobbyPlayerView[] = (lobby?.players ?? [
    {
      id: myId,
      name: playerName,
      character_id: 'sonny',
      primary_weapon_id: 'glock',
      ready: isReady,
      is_host: isHost,
    },
    ...fallbackPlayers
      .filter((player) => player.id !== myId)
      .map((player) => ({
        id: player.id,
        name: player.name,
        character_id: player.character_id,
        primary_weapon_id: player.active_weapon ?? 'glock',
        ready: false,
        is_host: player.id === 0,
      })),
  ]).map((player) => ({
    ...player,
    primary_weapon_id: player.primary_weapon_id ?? DEFAULT_WEAPON_ID,
    is_bot: player.is_bot ?? false,
  }));

  const notReadyCount = lobbyPlayers.filter((player) => !player.ready).length;
  const allReady = lobbyPlayers.length >= 1 && notReadyCount === 0;
  const emptySlotCount = Math.max(0, config.max_players - lobbyPlayers.length);

  let startLabel: string;
  if (isHost) {
    if (isBusy) startLabel = 'Starting…';
    else if (!allReady)
      startLabel =
        lobbyPlayers.length === 1
          ? 'Ready up to start'
          : `Waiting on ${notReadyCount} mate${notReadyCount === 1 ? '' : 's'}`;
    else startLabel = 'Start Match';
  } else {
    startLabel = allReady ? 'Waiting for host…' : 'Ready up to start';
  }

  return (
    <div className="lobby-shell">
      <header className="lobby-header">
        <div>
          <p className="screen-kicker">{isHost ? 'Hosting' : 'Joined'}</p>
          <h2 className="lobby-title">{config.server_name || 'LAN Game'}</h2>
        </div>
        <div className="lobby-meta">
          {isHost && localIp && <CopyChip label="Share IP" value={localIp} />}
          <span
            className={`meta-chip ${lobbyPlayers.length < config.max_players ? 'meta-chip-open' : ''}`}
          >
            <span className="meta-label">Mates</span>
            <strong>
              {lobbyPlayers.length}/{config.max_players}
            </strong>
          </span>
        </div>
      </header>

      <div className="lobby-body">
        <LobbySettingsPanel
          config={config}
          isHost={isHost}
          playerCount={lobbyPlayers.length}
          onConfigChange={onConfigChange}
        />

        <section className="lobby-slots">
          <header className="panel-heading">
            <h3>Mates</h3>
            <span>Change loadout below to swap character or weapon</span>
          </header>
          <div className="slot-list">
            {lobbyPlayers.map((player) => (
              <PlayerSlot
                key={player.id}
                player={player}
                isMe={player.id === myId}
                onNameSubmit={(next) => onNameChange(next)}
                onReadyToggle={() => onReadyChange(!isReady)}
              />
            ))}
            {Array.from({ length: emptySlotCount }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="slot slot-empty"
                style={{ '--slot-delay': `${index * 0.45}s` } as CSSProperties}
              >
                <span className="slot-empty-signal" aria-hidden="true">
                  <span className="slot-empty-ring" />
                  <span className="slot-empty-ring delay" />
                  <span className="slot-empty-core" />
                </span>
                <span className="slot-empty-label">
                  Waiting for a mate
                  <span className="waiting-dots" aria-hidden="true">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {error && <p className="error-text lobby-error">{error}</p>}

      <footer className="lobby-footer">
        <button type="button" className="ghost-button" onClick={onLeave}>
          Leave
        </button>
        <button type="button" className="secondary-button" onClick={onChangeLoadout}>
          Change Loadout
        </button>
        {isHost ? (
          <button
            className={`primary-action ${!allReady && !isBusy ? 'lobby-action-waiting' : ''}`}
            onClick={onStart}
            disabled={isBusy || !allReady}
          >
            {startLabel}
          </button>
        ) : (
          <button className="primary-action" disabled>
            {startLabel}
          </button>
        )}
      </footer>
    </div>
  );
}
