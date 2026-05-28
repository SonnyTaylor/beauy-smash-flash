import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS } from '../content/characters';
import { MAPS } from '../content/maps';
import { ArenaRenderer } from '../game/ArenaRenderer';
import { InputController } from '../input/InputController';
import { TauriGameClient } from '../net/TauriGameClient';
import type { CharacterDefinition, SessionInfo, StateSnapshot } from '../shared/types';

type Screen = 'main-menu' | 'server-select' | 'character-select' | 'lobby' | 'game';
type SessionKind = 'host' | 'join';

const MOCK_SERVERS = [
  { id: 'local', name: "Sonny's Laptop", address: '127.0.0.1', players: '1/12', ping: 'LAN' },
  { id: 'manual', name: 'Manual IP', address: '127.0.0.1', players: '?', ping: '--' },
];

export function App() {
  const client = useMemo(() => new TauriGameClient(), []);
  const renderer = useMemo(() => new ArenaRenderer(), []);
  const input = useMemo(() => new InputController(), []);
  const gameContainerRef = useRef<HTMLDivElement | null>(null);
  const inputTimerRef = useRef<number | null>(null);
  const latestStateRef = useRef<StateSnapshot | null>(null);

  const [screen, setScreen] = useState<Screen>('main-menu');
  const [sessionKind, setSessionKind] = useState<SessionKind>('host');
  const [playerName, setPlayerName] = useState('Sonny');
  const [joinIp, setJoinIp] = useState('127.0.0.1');
  const [selectedCharacterId, setSelectedCharacterId] = useState(CHARACTERS[0].id);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState(0);
  const [latestState, setLatestState] = useState<StateSnapshot | null>(null);

  const selectedCharacter = getCharacter(selectedCharacterId);
  const players = latestState?.players ?? [];

  useEffect(() => {
    client.listenForState((state) => {
      latestStateRef.current = state;
      setLatestState(state);
      input.setWorld(state.world);
      renderer.applyState(state);
    });

    return () => {
      client.dispose();
      input.detach();
      if (inputTimerRef.current !== null) {
        window.clearInterval(inputTimerRef.current);
      }
    };
  }, [client, input, renderer]);

  async function startSession() {
    setIsBusy(true);
    setError(null);
    try {
      const session =
        sessionKind === 'host'
          ? await client.host(playerName, selectedCharacterId)
          : await client.join(joinIp.trim() || '127.0.0.1', playerName, selectedCharacterId);
      await enterGame(session);
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function enterGame(session: SessionInfo) {
    const container = gameContainerRef.current;
    if (!container) return;
    setMyId(session.player_id);
    setScreen('game');
    await renderer.mount(container, session.world, session.player_id);
    input.attach(renderer.app.canvas, session.world);
    inputTimerRef.current = window.setInterval(async () => {
      const player = latestStateRef.current?.players.find((candidate) => candidate.id === session.player_id) ?? null;
      try {
        await client.sendInput(input.sample(player));
      } catch {
        // Best-effort UDP input should not break the UI.
      }
    }, 1000 / 60);
  }

  return (
    <div className="app-shell">
      <div ref={gameContainerRef} className="game-container" />

      {screen !== 'game' && (
        <div className="screen-backdrop">
          <div className="brand-panel">
            <p className="eyebrow">Beaumaris LAN Combat Test</p>
            <h1>Beauy Smash Flash</h1>
            <p className="tagline">Your friends as playable gremlins. Same WiFi. No accounts. Maximum chaos.</p>
          </div>

          <div className="screen-card">
            {screen === 'main-menu' && (
              <MainMenu
                playerName={playerName}
                onPlayerNameChange={setPlayerName}
                onHost={() => {
                  setSessionKind('host');
                  setScreen('character-select');
                }}
                onJoin={() => {
                  setSessionKind('join');
                  setScreen('server-select');
                }}
              />
            )}

            {screen === 'server-select' && (
              <ServerSelect
                joinIp={joinIp}
                onJoinIpChange={setJoinIp}
                onBack={() => setScreen('main-menu')}
                onContinue={() => setScreen('character-select')}
              />
            )}

            {screen === 'character-select' && (
              <CharacterSelect
                selectedCharacter={selectedCharacter}
                selectedCharacterId={selectedCharacterId}
                onSelect={setSelectedCharacterId}
                onBack={() => setScreen(sessionKind === 'join' ? 'server-select' : 'main-menu')}
                onContinue={() => setScreen('lobby')}
              />
            )}

            {screen === 'lobby' && (
              <Lobby
                sessionKind={sessionKind}
                selectedCharacter={selectedCharacter}
                players={players}
                isBusy={isBusy}
                error={error}
                onBack={() => setScreen('character-select')}
                onStart={startSession}
              />
            )}
          </div>
        </div>
      )}

      {screen === 'game' && (
        <GameOverlay
          state={latestState}
          myId={myId}
          selectedCharacter={selectedCharacter}
          onMockLobby={() => setScreen('lobby')}
        />
      )}
    </div>
  );
}

function MainMenu({
  playerName,
  onPlayerNameChange,
  onHost,
  onJoin,
}: {
  playerName: string;
  onPlayerNameChange: (value: string) => void;
  onHost: () => void;
  onJoin: () => void;
}) {
  return (
    <section className="flow-stack">
      <ScreenHeader kicker="Main Menu" title="Who is entering the arena?" />
      <label className="field-label">
        Display name
        <input value={playerName} onChange={(event) => onPlayerNameChange(event.currentTarget.value)} />
      </label>
      <div className="button-grid">
        <button onClick={onHost}>Host Game</button>
        <button className="secondary-button" onClick={onJoin}>
          Find Server
        </button>
      </div>
    </section>
  );
}

function ServerSelect({
  joinIp,
  onJoinIpChange,
  onBack,
  onContinue,
}: {
  joinIp: string;
  onJoinIpChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="flow-stack">
      <ScreenHeader kicker="Server Select" title="Pick a LAN host" />
      <div className="server-list">
        {MOCK_SERVERS.map((server) => (
          <button
            key={server.id}
            className="server-row"
            onClick={() => {
              onJoinIpChange(server.address);
              onContinue();
            }}
          >
            <span>
              <strong>{server.name}</strong>
              <small>{server.address}</small>
            </span>
            <span>{server.players}</span>
            <span>{server.ping}</span>
          </button>
        ))}
      </div>
      <label className="field-label">
        Manual IP
        <input value={joinIp} onChange={(event) => onJoinIpChange(event.currentTarget.value)} inputMode="decimal" />
      </label>
      <div className="button-grid">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button onClick={onContinue}>Continue</button>
      </div>
    </section>
  );
}

function CharacterSelect({
  selectedCharacter,
  selectedCharacterId,
  onSelect,
  onBack,
  onContinue,
}: {
  selectedCharacter: CharacterDefinition;
  selectedCharacterId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="flow-stack">
      <ScreenHeader kicker="Character Select" title="Choose your mate" />
      <div className="character-grid">
        {CHARACTERS.map((character) => (
          <button
            key={character.id}
            className={`character-card ${character.id === selectedCharacterId ? 'selected' : ''}`}
            style={{ '--accent': rgbCss(character.color) } as CSSProperties & Record<'--accent', string>}
            onClick={() => onSelect(character.id)}
          >
            <span className="head-placeholder">{character.initials}</span>
            <strong>{character.name}</strong>
            <small>{character.abilityName}</small>
          </button>
        ))}
      </div>
      <aside className="ability-preview">
        <strong>{selectedCharacter.abilityName}</strong>
        <p>{selectedCharacter.abilityDescription}</p>
      </aside>
      <div className="button-grid">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button onClick={onContinue}>Lock In</button>
      </div>
    </section>
  );
}

function Lobby({
  sessionKind,
  selectedCharacter,
  players,
  isBusy,
  error,
  onBack,
  onStart,
}: {
  sessionKind: SessionKind;
  selectedCharacter: CharacterDefinition;
  players: StateSnapshot['players'];
  isBusy: boolean;
  error: string | null;
  onBack: () => void;
  onStart: () => void;
}) {
  const mockPlayers = players.length
    ? players
    : [{ id: 0, name: 'You', character_id: selectedCharacter.id, color: selectedCharacter.color, x: 0, y: 0, angle: 0 }];

  return (
    <section className="flow-stack">
      <ScreenHeader kicker="Lobby" title={sessionKind === 'host' ? 'Ready to host' : 'Ready to join'} />
      <div className="lobby-list">
        {mockPlayers.map((player) => (
          <div key={player.id} className="lobby-player">
            <span className="status-dot" style={{ background: rgbCss(player.color) }} />
            <span>
              <strong>{player.name}</strong>
              <small>{getCharacter(player.character_id).name}</small>
            </span>
            <em>Ready</em>
          </div>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="button-grid">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button onClick={onStart} disabled={isBusy}>
          {isBusy ? 'Starting...' : sessionKind === 'host' ? 'Start Host' : 'Join Game'}
        </button>
      </div>
    </section>
  );
}

function GameOverlay({
  state,
  myId,
  selectedCharacter,
  onMockLobby,
}: {
  state: StateSnapshot | null;
  myId: number;
  selectedCharacter: CharacterDefinition;
  onMockLobby: () => void;
}) {
  const me = state?.players.find((player) => player.id === myId);
  return (
    <div className="game-overlay">
      <div className="hud-pill">
        <strong>{me?.name || 'Player'}</strong>
        <span>{getCharacter(me?.character_id ?? selectedCharacter.id).abilityName}</span>
      </div>
      <div className="hud-pill">
        <span>Players {state?.players.length ?? 0}</span>
        <span>Tick {state?.tick ?? 0}</span>
      </div>
      <button className="tiny-button" onClick={onMockLobby}>
        Lobby mock
      </button>
    </div>
  );
}

function ScreenHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header>
      <p className="screen-kicker">{kicker}</p>
      <h2>{title}</h2>
    </header>
  );
}

function getCharacter(id: string): CharacterDefinition {
  return CHARACTERS.find((character) => character.id === id) ?? CHARACTERS[0];
}

function rgbCss([r, g, b]: [number, number, number]) {
  return `rgb(${r} ${g} ${b})`;
}
