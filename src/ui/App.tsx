import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS } from '../content/characters';
import { MAPS } from '../content/maps';
import { ArenaRenderer } from '../game/ArenaRenderer';
import { InputController } from '../input/InputController';
import { TauriGameClient } from '../net/TauriGameClient';
import {
  DEFAULT_LOBBY_CONFIG,
  type CharacterDefinition,
  type Gamemode,
  type LobbyConfig,
  type LobbySnapshot,
  type ServerInfo,
  type SessionInfo,
  type StateSnapshot,
} from '../shared/types';

type Screen = 'main-menu' | 'server-select' | 'lobby' | 'game';
type SessionKind = 'host' | 'join';

const GAMEMODE_OPTIONS: Array<{ id: Gamemode; label: string; available: boolean }> = [
  { id: 'deathmatch', label: 'Deathmatch', available: true },
  { id: 'team_deathmatch', label: 'Team Deathmatch', available: false },
  { id: 'last_mate_standing', label: 'Last Mate Standing', available: false },
];

const SCORE_LIMIT_OPTIONS = [10, 15, 20, 30, 50];
const MAX_PLAYERS_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];
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
  const [playerName, setPlayerName] = useState(readStoredName);
  const [joinIp, setJoinIp] = useState('127.0.0.1');
  const [selectedCharacterId, setSelectedCharacterId] = useState(readStoredCharacterId);
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
  const [localIp, setLocalIp] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    void client
      .localIp()
      .then((ip) => {
        if (!cancelled) setLocalIp(ip);
      })
      .catch(() => {
        if (!cancelled) setLocalIp(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    writeStoredName(playerName);
  }, [playerName]);

  useEffect(() => {
    writeStoredCharacterId(selectedCharacterId);
  }, [selectedCharacterId]);

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

  async function createLobbySession(kind: SessionKind, ip?: string) {
    setIsBusy(true);
    setError(null);
    setSessionKind(kind);
    try {
      const session =
        kind === 'host'
          ? await client.host(playerName, selectedCharacterId)
          : await client.join((ip ?? joinIp).trim() || '127.0.0.1', playerName, selectedCharacterId);
      setSessionInfo(session);
      sessionInfoRef.current = session;
      setMyId(session.player_id);
      myIdRef.current = session.player_id;
      setIsReady(false);
      setScreen('lobby');
      await client.setReady(false);
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function updateReady(nextReady: boolean) {
    setIsReady(nextReady);
    try {
      await client.setReady(nextReady);
    } catch (caught) {
      setError(String(caught));
    }
  }

  async function updateCharacter(characterId: string) {
    setSelectedCharacterId(characterId);
    if (sessionInfo) {
      await client.selectCharacter(characterId);
    }
  }

  async function updateName(nextName: string) {
    const trimmed = nextName.trim().slice(0, 24);
    if (!trimmed || trimmed === playerName) return;
    setPlayerName(trimmed);
    if (sessionInfo) {
      try {
        await client.setName(trimmed);
      } catch (caught) {
        setError(String(caught));
      }
    }
  }

  async function updateLobbyConfig(nextConfig: LobbyConfig) {
    if (sessionKind !== 'host') return;
    try {
      await client.updateLobbyConfig(nextConfig);
    } catch (caught) {
      setError(String(caught));
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

  function leaveLobby() {
    // The Rust session stays alive on the host machine; starting a new
    // host/join will reset its state on the next call. We just navigate the
    // UI back so the user can pick a different flow.
    setScreen('main-menu');
    setSessionInfo(null);
    sessionInfoRef.current = null;
    setLobby(null);
    setIsReady(false);
    setError(null);
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
        <div
          className={`screen-backdrop ${
            screen === 'main-menu'
              ? 'landing-screen'
              : screen === 'lobby'
                ? 'lobby-screen'
                : 'flow-screen'
          }`}
        >
          {screen === 'main-menu' && (
            <>
              <FloatingHeads />
              <MainMenu
                onHost={() => void createLobbySession('host')}
                onJoin={() => {
                  setSessionKind('join');
                  setScreen('server-select');
                }}
                isBusy={isBusy}
                error={error}
              />
              {localIp && <span className="lan-ip">Your IP: {localIp}</span>}
            </>
          )}

          {screen === 'server-select' && (
            <>
              <div className="brand-panel">
                <p className="eyebrow">Join LAN</p>
                <h1>
                  Pick
                  <span>A Host</span>
                </h1>
                <p className="tagline">Scan the LAN for hosts, or punch in an IP directly.</p>
              </div>

              <div className="screen-card">
                <ServerSelect
                  servers={servers}
                  joinIp={joinIp}
                  isScanning={isScanning}
                  scanMessage={scanMessage}
                  isBusy={isBusy}
                  onJoinIpChange={setJoinIp}
                  onScan={scanForServers}
                  onBack={() => setScreen('main-menu')}
                  onContinue={(ip) => void createLobbySession('join', ip)}
                />
              </div>
            </>
          )}

          {screen === 'lobby' && (
            <Lobby
              sessionKind={sessionKind}
              lobby={lobby}
              fallbackPlayers={players}
              isReady={isReady}
              isBusy={isBusy}
              error={error}
              myId={myId}
              localIp={localIp}
              playerName={playerName}
              selectedCharacterId={selectedCharacterId}
              onReadyChange={(ready) => void updateReady(ready)}
              onNameChange={(name) => void updateName(name)}
              onCharacterChange={(id) => void updateCharacter(id)}
              onConfigChange={(config) => void updateLobbyConfig(config)}
              onLeave={leaveLobby}
              onStart={() => void startMatch()}
            />
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
  onHost,
  onJoin,
  isBusy,
  error,
}: {
  onHost: () => void;
  onJoin: () => void;
  isBusy: boolean;
  error: string | null;
}) {
  return (
    <section className="menu-zone">
      <div className="title-stack">
        <h1 className="menu-title">Beauy Smash Flash</h1>
        <p className="tagline">Shoot your mates. No internet required.</p>
      </div>

      <div className="menu-actions">
        <button className="primary-action" onClick={onHost} disabled={isBusy}>
          {isBusy ? 'Starting…' : 'Host Game'}
        </button>
        <button className="secondary-button" onClick={onJoin} disabled={isBusy}>
          Join Game
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
    </section>
  );
}

function FloatingHeads() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ index: number; pointerId: number; lastX: number; lastY: number; lastTime: number } | null>(null);
  const positionsRef = useRef<FloatingHeadPosition[]>([]);
  const initialPositions = useMemo(
    () => createFloatingHeadPositions(CHARACTERS.length),
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
        const cardBounds = document.querySelector('.menu-zone')?.getBoundingClientRect() ?? null;
        positionsRef.current = positionsRef.current.map((position, index) =>
          dragRef.current?.index === index ? position : stepFloatingHead(position, bounds, cardBounds, dt),
        );
        positionsRef.current = resolveHeadCollisions(
          positionsRef.current,
          bounds,
          dragRef.current?.index ?? null,
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

function createFloatingHeadPositions(count: number): FloatingHeadPosition[] {
  if (count <= 0) return [];

  // Scale head size down as the roster grows so a dozen+ mates still fit
  // without overlapping the menu area.
  const baseSize = clamp(118 - count * 5, 56, 118);

  // Place each head on a jittered ring around the screen center. The ring
  // sits outside the menu zone so the title and buttons stay readable.
  const positions: FloatingHeadPosition[] = [];
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2 + randomBetween(-0.18, 0.18);
    const radius = randomBetween(34, 44);
    const cx = clamp(50 + Math.cos(angle) * radius, 7, 93);
    const cy = clamp(50 + Math.sin(angle) * radius * 0.7, 9, 91);

    positions.push({
      x: cx,
      y: cy,
      size: baseSize + randomBetween(-6, 6),
      delay: randomBetween(-6, 0),
      drift: randomBetween(6, 14),
      vx: randomSignedBetween(4, 10),
      vy: randomSignedBetween(3, 8),
    });
  }

  return positions;
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

  // Force velocity to point AWAY from the wall the head crossed, instead of
  // blindly flipping the sign. This avoids a flip-flop when something else
  // (like a head-to-head collision) has shoved a head past the wall margin
  // while its velocity already points back into the arena.
  if (x < marginX) {
    x = marginX;
    vx = Math.abs(vx);
  } else if (x > 100 - marginX) {
    x = 100 - marginX;
    vx = -Math.abs(vx);
  }

  if (y < marginY) {
    y = marginY;
    vy = Math.abs(vy);
  } else if (y > 100 - marginY) {
    y = 100 - marginY;
    vy = -Math.abs(vy);
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

// Resolve circle-circle overlap between every pair of heads so the balls
// knock each other around. A dragged head is treated as immovable so flicking
// one into the pack actually flings the rest.
function resolveHeadCollisions(
  positions: FloatingHeadPosition[],
  bounds: DOMRect,
  draggingIndex: number | null,
): FloatingHeadPosition[] {
  if (positions.length < 2) return positions;

  // Work in pixel space so radii and distances share units. Velocities are
  // stored as %-per-second, so we scale into px/sec for the bounce and back.
  const bodies = positions.map((position) => ({
    raw: position,
    px: (position.x / 100) * bounds.width,
    py: (position.y / 100) * bounds.height,
    pvx: (position.vx / 100) * bounds.width,
    pvy: (position.vy / 100) * bounds.height,
    r: position.size / 2,
  }));

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.px - a.px;
      const dy = b.py - a.py;
      let dist = Math.hypot(dx, dy);
      const minDist = a.r + b.r;
      if (dist >= minDist) continue;

      let nx: number;
      let ny: number;
      if (dist < 0.001) {
        const angle = Math.random() * Math.PI * 2;
        nx = Math.cos(angle);
        ny = Math.sin(angle);
        dist = 0.001;
      } else {
        nx = dx / dist;
        ny = dy / dist;
      }

      const overlap = minDist - dist;
      const aLocked = draggingIndex === i;
      const bLocked = draggingIndex === j;
      const aShare = aLocked ? 0 : bLocked ? 1 : 0.5;
      const bShare = bLocked ? 0 : aLocked ? 1 : 0.5;

      a.px -= nx * overlap * aShare;
      a.py -= ny * overlap * aShare;
      b.px += nx * overlap * bShare;
      b.py += ny * overlap * bShare;

      const rvx = b.pvx - a.pvx;
      const rvy = b.pvy - a.pvy;
      const velAlongNormal = rvx * nx + rvy * ny;
      if (velAlongNormal > 0) continue;

      const restitution = 0.9;
      const impulse = (-(1 + restitution) * velAlongNormal) / 2;
      const impulseX = impulse * nx;
      const impulseY = impulse * ny;

      if (!aLocked) {
        a.pvx -= impulseX;
        a.pvy -= impulseY;
      }
      if (!bLocked) {
        b.pvx += impulseX;
        b.pvy += impulseY;
      }
    }
  }

  // Clamp positions using each head's own wall margin so the resolver never
  // parks a head past the wall — otherwise stepFloatingHead would keep
  // re-flipping its velocity every frame and bleed the momentum away.
  return bodies.map(({ raw, px, py, pvx, pvy }) => {
    const marginX = (raw.size / bounds.width) * 50;
    const marginY = (raw.size / bounds.height) * 50;
    return {
      ...raw,
      x: clamp((px / bounds.width) * 100, marginX, 100 - marginX),
      y: clamp((py / bounds.height) * 100, marginY, 100 - marginY),
      vx: clamp((pvx / bounds.width) * 100, -30, 30),
      vy: clamp((pvy / bounds.height) * 100, -30, 30),
    };
  });
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
  isBusy,
  onJoinIpChange,
  onScan,
  onBack,
  onContinue,
}: {
  servers: ServerInfo[];
  joinIp: string;
  isScanning: boolean;
  scanMessage: string;
  isBusy: boolean;
  onJoinIpChange: (value: string) => void;
  onScan: () => void;
  onBack: () => void;
  onContinue: (ip: string) => void;
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
              onContinue(server.address);
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
        {isScanning ? 'Scanning…' : 'Scan LAN'}
      </button>
      <div className="button-grid">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button onClick={() => onContinue(joinIp)} disabled={isBusy}>
          {isBusy ? 'Joining…' : 'Join'}
        </button>
      </div>
    </section>
  );
}

type LobbyPlayerView = {
  id: number;
  name: string;
  character_id: string;
  ready: boolean;
  is_host: boolean;
};

function Lobby({
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
  const allReady = lobbyPlayers.length >= 2 && notReadyCount === 0;
  const emptySlotCount = Math.max(0, config.max_players - lobbyPlayers.length);

  let startLabel: string;
  if (isHost) {
    if (isBusy) startLabel = 'Starting…';
    else if (lobbyPlayers.length < 2) startLabel = 'Need 2+ mates';
    else if (!allReady) startLabel = `Waiting on ${notReadyCount} mate${notReadyCount === 1 ? '' : 's'}`;
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
              disabled={isBusy || !allReady || lobbyPlayers.length < 2}
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

function LobbySettingsPanel({
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

      <SettingRow label="Map">
        <Cycle
          value={config.map_id}
          values={MAPS.map((map) => ({ id: map.id, label: map.name }))}
          disabled={!isHost || MAPS.length <= 1}
          onChange={(id) => patch({ map_id: id })}
          fallback={mapName}
        />
      </SettingRow>

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
    </section>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <div className="setting-control">{children}</div>
    </div>
  );
}

function Cycle({
  value,
  values,
  disabled,
  onChange,
  fallback,
}: {
  value: string;
  values: Array<{ id: string; label: string }>;
  disabled?: boolean;
  onChange: (id: string) => void;
  fallback?: string;
}) {
  if (disabled || values.length <= 1) {
    const current = values.find((option) => option.id === value)?.label ?? fallback ?? value;
    return <span className="cycle-static">{current}</span>;
  }

  const currentIndex = Math.max(
    0,
    values.findIndex((option) => option.id === value),
  );

  function step(delta: number) {
    const nextIndex = (currentIndex + delta + values.length) % values.length;
    onChange(values[nextIndex].id);
  }

  return (
    <div className="cycle">
      <button type="button" className="cycle-arrow" onClick={() => step(-1)} aria-label="Previous">
        ‹
      </button>
      <span className="cycle-value">{values[currentIndex].label}</span>
      <button type="button" className="cycle-arrow" onClick={() => step(1)} aria-label="Next">
        ›
      </button>
    </div>
  );
}

function PlayerSlot({
  player,
  isMe,
  onCharacterClick,
  onNameSubmit,
  onReadyToggle,
}: {
  player: LobbyPlayerView;
  isMe: boolean;
  onCharacterClick: () => void;
  onNameSubmit: (name: string) => void;
  onReadyToggle: () => void;
}) {
  const character = getCharacter(player.character_id);
  const accent = rgbCss(character.color);

  return (
    <div
      className={`slot ${isMe ? 'slot-me' : ''} ${player.ready ? 'slot-ready' : ''}`}
      style={{ '--accent': accent } as CSSProperties & Record<'--accent', string>}
    >
      <button
        type="button"
        className="slot-avatar"
        onClick={onCharacterClick}
        disabled={!isMe}
        aria-label={isMe ? 'Change character' : `${player.name}'s character`}
      >
        <img
          src={`/assets/${character.sprite}`}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <span>{character.initials}</span>
        {isMe && <span className="slot-avatar-hint">Change</span>}
      </button>

      <div className="slot-text">
        {isMe ? (
          <EditableName value={player.name} onSubmit={onNameSubmit} />
        ) : (
          <strong className="slot-name">
            {player.name}
            {player.is_host ? <span className="host-tag">Host</span> : null}
          </strong>
        )}
        <span className="slot-ability">{character.abilityName}</span>
      </div>

      {isMe ? (
        <button
          type="button"
          className={`ready-toggle ${player.ready ? 'ready' : ''}`}
          onClick={onReadyToggle}
        >
          {player.ready ? 'Ready' : 'Ready Up'}
        </button>
      ) : (
        <span className={`ready-pill ${player.ready ? 'ready' : ''}`}>
          {player.ready ? 'Ready' : 'Not ready'}
        </span>
      )}
    </div>
  );
}

function EditableName({ value, onSubmit }: { value: string; onSubmit: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSubmit(trimmed);
    } else {
      setDraft(value);
    }
  }

  if (!editing) {
    return (
      <button type="button" className="slot-name-edit" onClick={() => setEditing(true)}>
        <strong className="slot-name">{value}</strong>
        <span className="edit-hint" aria-hidden>
          edit
        </span>
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      className="slot-name-input"
      value={draft}
      maxLength={24}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

function CharacterDrawer({
  open,
  selectedCharacterId,
  onSelect,
  onClose,
}: {
  open: boolean;
  selectedCharacterId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        className="drawer-panel"
        role="dialog"
        aria-label="Pick a character"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div>
            <p className="screen-kicker">Pick your mate</p>
            <h2>Character</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </header>
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
              <span className="ability-name">{character.abilityName}</span>
              <span className="ability-desc">{character.abilityDescription}</span>
              <span className="selected-tag">Selected</span>
            </button>
          ))}
        </div>
      </div>
    </div>
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

const STORAGE_KEY_NAME = 'beauy:name';
const STORAGE_KEY_CHARACTER = 'beauy:character';

function readStoredName(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY_NAME) ?? 'Sonny';
  } catch {
    return 'Sonny';
  }
}

function writeStoredName(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_NAME, value);
  } catch {
    /* localStorage unavailable */
  }
}

function readStoredCharacterId(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY_CHARACTER);
    if (stored && CHARACTERS.some((character) => character.id === stored)) {
      return stored;
    }
  } catch {
    /* localStorage unavailable */
  }
  return CHARACTERS[0].id;
}

function writeStoredCharacterId(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_CHARACTER, value);
  } catch {
    /* localStorage unavailable */
  }
}
