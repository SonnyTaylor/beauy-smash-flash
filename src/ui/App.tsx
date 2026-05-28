import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS } from '../content/characters';
import { ArenaRenderer } from '../game/ArenaRenderer';
import { InputController } from '../input/InputController';
import { TauriGameClient } from '../net/TauriGameClient';
import type {
  CharacterDefinition,
  LobbySnapshot,
  ServerInfo,
  SessionInfo,
  StateSnapshot,
} from '../shared/types';

type Screen = 'main-menu' | 'server-select' | 'character-select' | 'lobby' | 'game';
type SessionKind = 'host' | 'join';
type FloatingHeadPosition = {
  x: number;
  y: number;
  size: number;
  delay: number;
  drift: number;
  vx: number;
  vy: number;
};

export function App() {
  const client = useMemo(() => new TauriGameClient(), []);
  const renderer = useMemo(() => new ArenaRenderer(), []);
  const input = useMemo(() => new InputController(), []);
  const gameContainerRef = useRef<HTMLDivElement | null>(null);
  const inputTimerRef = useRef<number | null>(null);
  const latestStateRef = useRef<StateSnapshot | null>(null);
  const sessionInfoRef = useRef<SessionInfo | null>(null);
  const myIdRef = useRef(0);

  const [screen, setScreen] = useState<Screen>('main-menu');
  const [sessionKind, setSessionKind] = useState<SessionKind>('host');
  const [playerName, setPlayerName] = useState('Sonny');
  const [joinIp, setJoinIp] = useState('127.0.0.1');
  const [selectedCharacterId, setSelectedCharacterId] = useState(CHARACTERS[0].id);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('Broadcast discovery works only when the WiFi allows peer UDP.');
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
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
    client.listenForLobby((nextLobby) => {
      setLobby(nextLobby);
    });
    client.listenForMatchStarted((state) => {
      latestStateRef.current = state;
      setLatestState(state);
      void enterGame(state);
    });

    return () => {
      client.dispose();
      input.detach();
      if (inputTimerRef.current !== null) {
        window.clearInterval(inputTimerRef.current);
      }
    };
  }, [client, input, renderer]);

  async function scanForServers() {
    setIsScanning(true);
    setScanMessage('Scanning LAN broadcast on UDP 5554...');
    try {
      const found = await client.scanServers();
      setServers(found);
      setScanMessage(
        found.length
          ? `Found ${found.length} host${found.length === 1 ? '' : 's'}.`
          : 'No hosts found. School WiFi may block broadcast or peer-to-peer traffic; manual IP may still work.',
      );
    } catch (caught) {
      setScanMessage(`Scan failed: ${String(caught)}. Manual IP is still available.`);
    } finally {
      setIsScanning(false);
    }
  }

  async function createLobbySession() {
    setIsBusy(true);
    setError(null);
    try {
      const session =
        sessionKind === 'host'
          ? await client.host(playerName, selectedCharacterId)
          : await client.join(joinIp.trim() || '127.0.0.1', playerName, selectedCharacterId);
      setSessionInfo(session);
      sessionInfoRef.current = session;
      setMyId(session.player_id);
      myIdRef.current = session.player_id;
      setIsReady(sessionKind === 'host');
      setScreen('lobby');
      await client.setReady(sessionKind === 'host');
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function updateReady(nextReady: boolean) {
    setIsReady(nextReady);
    await client.setReady(nextReady);
  }

  async function updateCharacter(characterId: string) {
    setSelectedCharacterId(characterId);
    if (sessionInfo) {
      await client.selectCharacter(characterId);
    }
  }

  async function startMatch() {
    setIsBusy(true);
    setError(null);
    try {
      await client.startMatch();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function enterGame(initialState: StateSnapshot) {
    const container = gameContainerRef.current;
    if (!container) return;
    if (inputTimerRef.current !== null) {
      window.clearInterval(inputTimerRef.current);
    }
    const playerId = sessionInfoRef.current?.player_id ?? myIdRef.current;
    setScreen('game');
    await renderer.mount(container, initialState.world, playerId);
    renderer.applyState(initialState);
    input.attach(renderer.app.canvas, initialState.world);
    inputTimerRef.current = window.setInterval(async () => {
      const player = latestStateRef.current?.players.find((candidate) => candidate.id === playerId) ?? null;
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
        <div className={`screen-backdrop ${screen === 'main-menu' ? 'landing-screen' : 'flow-screen'}`}>
          {screen === 'main-menu' ? (
            <>
              <FloatingHeads />
              <div className="landing-card">
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
              </div>
            </>
          ) : (
            <>
              <div className="brand-panel">
                <p className="eyebrow">Beauy Smash Flash</p>
                <h1>
                  LAN
                  <span>Party</span>
                </h1>
                <p className="tagline">Pick your mate, ready up, and get everyone onto the same WiFi.</p>
              </div>

              <div className="screen-card">
                {screen === 'server-select' && (
                  <ServerSelect
                    servers={servers}
                    joinIp={joinIp}
                    isScanning={isScanning}
                    scanMessage={scanMessage}
                    onJoinIpChange={setJoinIp}
                    onScan={scanForServers}
                    onBack={() => setScreen('main-menu')}
                    onContinue={() => setScreen('character-select')}
                  />
                )}

                {screen === 'character-select' && (
                  <CharacterSelect
                    selectedCharacter={selectedCharacter}
                    selectedCharacterId={selectedCharacterId}
                    onSelect={(id) => void updateCharacter(id)}
                    onBack={() => setScreen(sessionKind === 'join' ? 'server-select' : 'main-menu')}
                    onContinue={createLobbySession}
                    isBusy={isBusy}
                  />
                )}

                {screen === 'lobby' && (
                  <Lobby
                    sessionKind={sessionKind}
                    selectedCharacter={selectedCharacter}
                    lobby={lobby}
                    fallbackPlayers={players}
                    isReady={isReady}
                    isBusy={isBusy}
                    error={error}
                    myId={myId}
                    networkNote={lobby?.network_note}
                    onReadyChange={(ready) => void updateReady(ready)}
                    onBack={() => setScreen('character-select')}
                    onStart={startMatch}
                  />
                )}
              </div>
            </>
          )}
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
    <section className="main-menu-panel">
      <div className="title-stack">
        <p className="eyebrow">Same WiFi. No accounts. Just chaos.</p>
        <h1>Beauy Smash Flash</h1>
        <p className="tagline">Shoot your mates. Pick a ridiculous power. Keep it local.</p>
      </div>

      <label className="field-label">
        Your name
        <input value={playerName} onChange={(event) => onPlayerNameChange(event.currentTarget.value)} />
      </label>

      <div className="button-grid menu-actions">
        <button className="primary-action" onClick={onHost}>
          Host Game
        </button>
        <button className="secondary-button" onClick={onJoin}>
          Join Game
        </button>
      </div>

      <div className="quick-note">
        <span>LAN discovery</span>
        <span>Manual IP fallback</span>
      </div>
    </section>
  );
}

function FloatingHeads() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ index: number; pointerId: number; lastX: number; lastY: number; lastTime: number } | null>(null);
  const positionsRef = useRef<FloatingHeadPosition[]>([]);
  const initialPositions = useMemo(
    () => CHARACTERS.map((_, index) => createFloatingHeadPosition(index)),
    [],
  );
  const [positions, setPositions] = useState(initialPositions);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useEffect(() => {
    positionsRef.current = initialPositions;
    let frame = 0;
    let lastTime = performance.now();

    function tick(now: number) {
      const bounds = containerRef.current?.getBoundingClientRect();
      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;

      if (bounds) {
        const cardBounds = document.querySelector('.landing-card')?.getBoundingClientRect() ?? null;
        positionsRef.current = positionsRef.current.map((position, index) =>
          dragRef.current?.index === index ? position : stepFloatingHead(position, bounds, cardBounds, dt),
        );
        setPositions([...positionsRef.current]);
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [initialPositions]);

  function moveHead(index: number, clientX: number, clientY: number) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const x = clamp(((clientX - bounds.left) / bounds.width) * 100, 7, 93);
    const y = clamp(((clientY - bounds.top) / bounds.height) * 100, 9, 91);
    const drag = dragRef.current;
    const now = performance.now();
    const elapsed = drag ? Math.max((now - drag.lastTime) / 1000, 0.016) : 0.016;
    const nextPosition = positionsRef.current[index] ?? positions[index] ?? initialPositions[index];
    const vx = drag ? (((clientX - drag.lastX) / bounds.width) * 100) / elapsed : nextPosition.vx;
    const vy = drag ? (((clientY - drag.lastY) / bounds.height) * 100) / elapsed : nextPosition.vy;

    positionsRef.current = positionsRef.current.map((position, positionIndex) =>
      positionIndex === index
        ? {
            ...position,
            x,
            y,
            vx: clamp(vx, -34, 34),
            vy: clamp(vy, -34, 34),
          }
        : position,
    );
    setPositions([...positionsRef.current]);

    if (drag) {
      drag.lastX = clientX;
      drag.lastY = clientY;
      drag.lastTime = now;
    }
  }

  return (
    <div ref={containerRef} className="floating-heads" aria-label="Floating character heads">
      {CHARACTERS.map((character, index) => {
        const position = positions[index] ?? initialPositions[index];
        return (
          <div
            key={character.id}
            className={`floating-head ${draggingIndex === index ? 'dragging' : ''}`}
            style={
              {
                '--accent': rgbCss(character.color),
                '--delay': `${position.delay}s`,
                '--drift': `${position.drift}px`,
                left: `${position.x}%`,
                top: `${position.y}%`,
                width: `${position.size}px`,
                height: `${position.size}px`,
              } as CSSProperties & Record<string, string>
            }
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              index,
              pointerId: event.pointerId,
              lastX: event.clientX,
              lastY: event.clientY,
              lastTime: performance.now(),
            };
              setDraggingIndex(index);
              moveHead(index, event.clientX, event.clientY);
            }}
            onPointerMove={(event) => {
              if (dragRef.current?.index !== index || dragRef.current.pointerId !== event.pointerId) return;
              moveHead(index, event.clientX, event.clientY);
            }}
            onPointerUp={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) {
                dragRef.current = null;
                setDraggingIndex(null);
              }
            }}
            onPointerCancel={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) {
                dragRef.current = null;
                setDraggingIndex(null);
              }
            }}
          >
            <span className="floating-head-body">
              <span className="float-ring" />
              <span className="float-ring offset" />
              <span className="float-avatar">
                <img
                  src={`/assets/${character.sprite}`}
                  alt=""
                  draggable={false}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
                <span>{character.initials}</span>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function createFloatingHeadPosition(index: number): FloatingHeadPosition {
  const safeZones = [
    { x: [8, 18], y: [13, 27] },
    { x: [82, 92], y: [13, 27] },
    { x: [7, 17], y: [42, 58] },
    { x: [83, 93], y: [42, 58] },
    { x: [9, 20], y: [72, 88] },
    { x: [80, 91], y: [72, 88] },
  ] as const;
  const zone = safeZones[index % safeZones.length];

  return {
    x: randomBetween(zone.x[0], zone.x[1]),
    y: randomBetween(zone.y[0], zone.y[1]),
    size: randomBetween(72, 118),
    delay: randomBetween(-6, 0),
    drift: randomBetween(7, 16),
    vx: randomSignedBetween(5, 13),
    vy: randomSignedBetween(4, 10),
  };
}

function stepFloatingHead(
  position: FloatingHeadPosition,
  bounds: DOMRect,
  cardBounds: DOMRect | null,
  dt: number,
): FloatingHeadPosition {
  const marginX = (position.size / bounds.width) * 50;
  const marginY = (position.size / bounds.height) * 50;
  let x = position.x + position.vx * dt;
  let y = position.y + position.vy * dt;
  let vx = position.vx;
  let vy = position.vy;

  if (x < marginX || x > 100 - marginX) {
    x = clamp(x, marginX, 100 - marginX);
    vx *= -1;
  }

  if (y < marginY || y > 100 - marginY) {
    y = clamp(y, marginY, 100 - marginY);
    vy *= -1;
  }

  if (cardBounds) {
    const radiusX = (position.size / bounds.width) * 50;
    const radiusY = (position.size / bounds.height) * 50;
    const cardZone = {
      left: ((cardBounds.left - bounds.left) / bounds.width) * 100 - radiusX,
      right: ((cardBounds.right - bounds.left) / bounds.width) * 100 + radiusX,
      top: ((cardBounds.top - bounds.top) / bounds.height) * 100 - radiusY,
      bottom: ((cardBounds.bottom - bounds.top) / bounds.height) * 100 + radiusY,
    };
    const insideCardZone = x > cardZone.left && x < cardZone.right && y > cardZone.top && y < cardZone.bottom;

    if (insideCardZone) {
      const distances = [
        { side: 'left', value: Math.abs(x - cardZone.left) },
        { side: 'right', value: Math.abs(cardZone.right - x) },
        { side: 'top', value: Math.abs(y - cardZone.top) },
        { side: 'bottom', value: Math.abs(cardZone.bottom - y) },
      ] as const;
      const nearest = distances.reduce((closest, candidate) =>
        candidate.value < closest.value ? candidate : closest,
      );

      if (nearest.side === 'left' || nearest.side === 'right') {
        x = nearest.side === 'left' ? cardZone.left : cardZone.right;
        vx = Math.abs(vx) * (nearest.side === 'left' ? -1 : 1);
      } else {
        y = nearest.side === 'top' ? cardZone.top : cardZone.bottom;
        vy = Math.abs(vy) * (nearest.side === 'top' ? -1 : 1);
      }
    }
  }

  return {
    ...position,
    x,
    y,
    vx: clamp(vx * 0.999, -18, 18),
    vy: clamp(vy * 0.999, -18, 18),
  };
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomSignedBetween(min: number, max: number) {
  const value = randomBetween(min, max);
  return Math.random() > 0.5 ? value : -value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ServerSelect({
  servers,
  joinIp,
  isScanning,
  scanMessage,
  onJoinIpChange,
  onScan,
  onBack,
  onContinue,
}: {
  servers: ServerInfo[];
  joinIp: string;
  isScanning: boolean;
  scanMessage: string;
  onJoinIpChange: (value: string) => void;
  onScan: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="flow-stack">
      <ScreenHeader kicker="Server Select" title="Pick a LAN host" />
      <div className="server-list">
        {servers.map((server) => (
          <button
            key={`${server.address}:${server.game_port}`}
            className="server-row"
            onClick={() => {
              onJoinIpChange(server.address);
              onContinue();
            }}
          >
            <span>
              <strong>{server.name}</strong>
              <small>
                {server.address}:{server.game_port}
              </small>
            </span>
            <span>
              {server.player_count}/{server.max_players}
            </span>
            <span>LAN</span>
          </button>
        ))}
        {!servers.length && <p className="network-note">{scanMessage}</p>}
      </div>
      <label className="field-label">
        Manual IP or IP:port
        <input value={joinIp} onChange={(event) => onJoinIpChange(event.currentTarget.value)} inputMode="decimal" />
      </label>
      <button className="secondary-button" onClick={onScan} disabled={isScanning}>
        {isScanning ? 'Scanning...' : 'Scan LAN'}
      </button>
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
  isBusy,
}: {
  selectedCharacter: CharacterDefinition;
  selectedCharacterId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
  isBusy: boolean;
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
            <span className="head-placeholder">
              <img
                src={`/assets/${character.sprite}`}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
              <span>{character.initials}</span>
            </span>
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
        <button onClick={onContinue} disabled={isBusy}>
          {isBusy ? 'Creating...' : 'Lock In'}
        </button>
      </div>
    </section>
  );
}

function Lobby({
  sessionKind,
  selectedCharacter,
  lobby,
  fallbackPlayers,
  isReady,
  isBusy,
  error,
  myId,
  networkNote,
  onReadyChange,
  onBack,
  onStart,
}: {
  sessionKind: SessionKind;
  selectedCharacter: CharacterDefinition;
  lobby: LobbySnapshot | null;
  fallbackPlayers: StateSnapshot['players'];
  isReady: boolean;
  isBusy: boolean;
  error: string | null;
  myId: number;
  networkNote: string | undefined;
  onReadyChange: (ready: boolean) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const lobbyPlayers =
    lobby?.players ??
    fallbackPlayers.map((player) => ({
      id: player.id,
      name: player.name,
      character_id: player.character_id,
      ready: player.id === myId,
      is_host: player.id === 0,
    }));
  const displayPlayers = lobbyPlayers.length
    ? lobbyPlayers
    : [{ id: myId, name: 'You', character_id: selectedCharacter.id, ready: isReady, is_host: sessionKind === 'host' }];

  return (
    <section className="flow-stack">
      <ScreenHeader kicker="Lobby" title={sessionKind === 'host' ? 'Host lobby' : 'Joined lobby'} />
      <div className="lobby-list">
        {displayPlayers.map((player) => {
          const character = getCharacter(player.character_id);
          return (
            <div key={player.id} className="lobby-player">
              <span className="status-dot" style={{ background: rgbCss(character.color) }} />
              <span>
                <strong>
                  {player.name} {player.is_host ? '(Host)' : ''}
                </strong>
                <small>{character.name}</small>
              </span>
              <em>{player.ready ? 'Ready' : 'Not ready'}</em>
            </div>
          );
        })}
      </div>
      {networkNote && <p className="network-note">{networkNote}</p>}
      {error && <p className="error-text">{error}</p>}
      <button className="secondary-button" onClick={() => onReadyChange(!isReady)}>
        {isReady ? 'Mark Not Ready' : 'Mark Ready'}
      </button>
      <div className="button-grid">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button onClick={onStart} disabled={isBusy || sessionKind !== 'host'}>
          {sessionKind !== 'host' ? 'Waiting for Host' : isBusy ? 'Starting...' : 'Start Match'}
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
