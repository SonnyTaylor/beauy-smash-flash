import { useEffect, useMemo, useRef, useState } from 'react';
import { ArenaRenderer } from '../../game/ArenaRenderer';
import { InputController } from '../../input/InputController';
import { TauriGameClient } from '../../net/TauriGameClient';
import type {
  LobbyConfig,
  LobbySnapshot,
  ServerInfo,
  SessionInfo,
  StateSnapshot,
} from '../../shared/types';
import { getCharacter } from '../character';
import type { Screen, SessionKind } from '../navigation';
import {
  readStoredCharacterId,
  readStoredName,
  writeStoredCharacterId,
  writeStoredName,
} from '../storage';

export function useGameSession() {
  const client = useMemo(() => new TauriGameClient(), []);
  const renderer = useMemo(() => new ArenaRenderer(), []);
  const input = useMemo(() => new InputController(), []);
  const gameContainerRef = useRef<HTMLDivElement | null>(null);
  const inputTimerRef = useRef<number | null>(null);
  const latestStateRef = useRef<StateSnapshot | null>(null);
  const sessionInfoRef = useRef<SessionInfo | null>(null);
  const myIdRef = useRef(0);
  const screenRef = useRef<Screen>('main-menu');

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
  const [paused, setPaused] = useState(false);
  const [matchEnded, setMatchEnded] = useState(false);
  const pausedRef = useRef(false);
  const matchEndedRef = useRef(false);

  const selectedCharacter = getCharacter(selectedCharacterId);
  const players = latestState?.players ?? [];

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    matchEndedRef.current = matchEnded;
  }, [matchEnded]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    input.setEnabled(!paused && !matchEnded);
  }, [input, matchEnded, paused]);

  useEffect(() => {
    client.listenForState((state) => {
      latestStateRef.current = state;
      setLatestState(state);
      setMatchEnded(state.match_ended);
      input.setWorld(state.world);
      if (screenRef.current === 'game') {
        renderer.applyState(state);
      }
    });
    client.listenForLobby((nextLobby) => {
      setLobby(nextLobby);
      if (!nextLobby.match_started && screenRef.current === 'game') {
        void leaveLobbyToLobbyScreen();
      }
    });
    client.listenForMatchStarted((state) => {
      latestStateRef.current = state;
      setLatestState(state);
      setMatchEnded(false);
      setPaused(false);
      void enterGame(state);
    });
    client.listenForMatchEnded((state) => {
      latestStateRef.current = state;
      setLatestState(state);
      setMatchEnded(true);
      setPaused(false);
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
      setMatchEnded(false);
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

  function teardownGameRuntime() {
    if (inputTimerRef.current !== null) {
      window.clearInterval(inputTimerRef.current);
      inputTimerRef.current = null;
    }
    input.detach();
    input.setEnabled(true);
    renderer.destroy();
    if (gameContainerRef.current) {
      gameContainerRef.current.replaceChildren();
    }
    setPaused(false);
    setMatchEnded(false);
  }

  async function leaveLobby() {
    try {
      await client.stopSession();
    } catch {
      // Still navigate away if teardown fails.
    }
    teardownGameRuntime();
    setScreen('main-menu');
    setSessionInfo(null);
    sessionInfoRef.current = null;
    setLobby(null);
    setIsReady(false);
    setError(null);
    setLatestState(null);
    latestStateRef.current = null;
  }

  async function leaveLobbyToLobbyScreen() {
    teardownGameRuntime();
    setScreen('lobby');
    setIsReady(false);
    setMatchEnded(false);
    setLatestState(null);
    latestStateRef.current = null;
    setError(null);
  }

  async function returnToLobby() {
    setIsBusy(true);
    setError(null);
    try {
      if (sessionKind === 'host') {
        await client.returnToLobby();
      }
      await leaveLobbyToLobbyScreen();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function rematch() {
    setIsBusy(true);
    setError(null);
    try {
      if (sessionKind === 'host') {
        await client.rematch();
      }
      setMatchEnded(false);
      setPaused(false);
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function enterGame(initialState: StateSnapshot) {
    const container = gameContainerRef.current;
    if (!container) return;
    teardownGameRuntime();
    const playerId = sessionInfoRef.current?.player_id ?? myIdRef.current;
    await renderer.mount(container, initialState.world, playerId);
    setScreen('game');
    const state = latestStateRef.current ?? initialState;
    renderer.applyState(state);
    input.attach(renderer.canvas, state.world);
    inputTimerRef.current = window.setInterval(async () => {
      if (pausedRef.current || matchEndedRef.current || latestStateRef.current?.match_ended) {
        return;
      }
      const player = latestStateRef.current?.players.find((candidate) => candidate.id === playerId) ?? null;
      try {
        await client.sendInput(input.sample(player));
      } catch {
        // Best-effort UDP input should not break the UI.
      }
    }, 1000 / 60);
  }

  function goToServerSelect() {
    setSessionKind('join');
    setScreen('server-select');
  }

  function backdropClass(): string {
    if (screen === 'main-menu') return 'landing-screen';
    if (screen === 'lobby') return 'lobby-screen';
    if (screen === 'server-select') return 'flow-screen join-screen';
    return 'flow-screen';
  }

  return {
    gameContainerRef,
    screen,
    sessionKind,
    playerName,
    joinIp,
    setJoinIp,
    selectedCharacter,
    selectedCharacterId,
    isReady,
    servers,
    isScanning,
    scanMessage,
    lobby,
    isBusy,
    error,
    myId,
    latestState,
    localIp,
    players,
    paused,
    setPaused,
    backdropClass,
    scanForServers,
    createLobbySession,
    updateReady,
    updateCharacter,
    updateName,
    updateLobbyConfig,
    startMatch,
    leaveLobby,
    leaveGame: leaveLobby,
    returnToLobby,
    rematch,
    goToServerSelect,
    setScreen,
  };
}
