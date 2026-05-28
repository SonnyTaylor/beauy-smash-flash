import { useState } from 'react';
import {
  DEFAULT_LOBBY_CONFIG,
  type LobbyConfig,
  type LobbySnapshot,
  type StateSnapshot,
} from '../../shared/types';
import type { SessionKind } from '../navigation';
import { CharacterDrawer } from './CharacterDrawer';
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
  selectedCharacterId,
  onReadyChange,
  onNameChange,
  onCharacterChange,
  onConfigChange,
  onLeave,
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
  selectedCharacterId: string;
  onReadyChange: (ready: boolean) => void;
  onNameChange: (name: string) => void;
  onCharacterChange: (characterId: string) => void;
  onConfigChange: (config: LobbyConfig) => void;
  onLeave: () => void;
  onStart: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isHost = sessionKind === 'host';
  const config = lobby?.config ?? DEFAULT_LOBBY_CONFIG;

  const lobbyPlayers: LobbyPlayerView[] = lobby?.players ?? [
    {
      id: myId,
      name: playerName,
      character_id: selectedCharacterId,
      ready: isReady,
      is_host: isHost,
    },
    ...fallbackPlayers
      .filter((player) => player.id !== myId)
      .map((player) => ({
        id: player.id,
        name: player.name,
        character_id: player.character_id,
        ready: false,
        is_host: player.id === 0,
      })),
  ];

  const me = lobbyPlayers.find((player) => player.id === myId);
  const myCharacterId = me?.character_id ?? selectedCharacterId;
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
    <>
      <div className="lobby-shell">
        <header className="lobby-header">
          <div>
            <p className="screen-kicker">{isHost ? 'Hosting' : 'Joined'}</p>
            <h2 className="lobby-title">{isHost ? `${playerName}'s Game` : 'LAN Game'}</h2>
          </div>
          <div className="lobby-meta">
            {isHost && localIp && (
              <span className="meta-chip">
                <span className="meta-label">Share IP</span>
                <strong>{localIp}</strong>
              </span>
            )}
            <span className="meta-chip">
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
              <span>Click your slot to change character or name</span>
            </header>
            <div className="slot-list">
              {lobbyPlayers.map((player) => (
                <PlayerSlot
                  key={player.id}
                  player={player}
                  isMe={player.id === myId}
                  onCharacterClick={() => setDrawerOpen(true)}
                  onNameSubmit={(next) => onNameChange(next)}
                  onReadyToggle={() => onReadyChange(!isReady)}
                />
              ))}
              {Array.from({ length: emptySlotCount }).map((_, index) => (
                <div key={`empty-${index}`} className="slot slot-empty">
                  <span className="slot-empty-dot" />
                  <span>Waiting for a mate…</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {error && <p className="error-text lobby-error">{error}</p>}

        <footer className="lobby-footer">
          <button className="ghost-button" onClick={onLeave}>
            Leave
          </button>
          {isHost ? (
            <button
              className="primary-action"
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

      <CharacterDrawer
        open={drawerOpen}
        selectedCharacterId={myCharacterId}
        onSelect={(id) => {
          onCharacterChange(id);
          setDrawerOpen(false);
        }}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
