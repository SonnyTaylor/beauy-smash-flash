import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioManager } from '../../audio/AudioManager';
import { GameAudio } from '../../audio/GameAudio';
import { ArenaRenderer } from '../../game/ArenaRenderer';
import { InputController } from '../../input/InputController';
import { TauriGameClient } from '../../net/TauriGameClient';
import type {
  GameSettings,
  LobbyConfig,
  LobbySnapshot,
  ServerInfo,
  SessionInfo,
  StateSnapshot,
} from '../../shared/types';
import { getCharacter } from '../character';
import type { Screen, SessionKind } from '../navigation';
import {
  readGameSettings,
  readStoredCharacterId,
  readStoredName,
  readStoredPrimaryWeaponId,
  writeGameSettings,
  writeStoredCharacterId,
  writeStoredName,
  writeStoredPrimaryWeaponId,
} from '../storage';
import { DEFAULT_LOBBY_CONFIG } from '../../shared/types';
import { closeApplicationWindow } from '../appClose';

export function useGameSession() {
  const client = useMemo(() => new TauriGameClient(), []);
  const renderer = useMemo(() => new ArenaRenderer(), []);
  const audio = useMemo(() => new AudioManager(), []);
  const gameAudio = useMemo(() => new GameAudio(audio), [audio]);
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
  const [selectedPrimaryWeaponId, setSelectedPrimaryWeaponId] = useState(readStoredPrimaryWeaponId);
  const pendingJoinIpRef = useRef<string | null>(null);
  const loadoutReturnScreenRef = useRef<Screen | null>(null);
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
  const [arenaLoading, setArenaLoading] = useState(false);
  const [gameSettings, setGameSettings] = useState(readGameSettings);
  const pausedRef = useRef(false);
  const matchEndedRef = useRef(false);
  const gameSettingsRef = useRef(gameSettings);

  const selectedCharacter = getCharacter(selectedCharacterId);
  const players = latestState?.players ?? [];

  useEffect(() => {
    if (screen !== 'server-select') return;
    void scanForServers();
  }, [screen]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    matchEndedRef.current = matchEnded;
  }, [matchEnded]);

  function releaseGamePointer() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  function setPausedWithSync(next: boolean) {
    setPaused(next);
    if (next) {
      releaseGamePointer();
    }
  }

  useEffect(() => {
    if (screen !== 'game' || sessionKind !== 'host' || !sessionInfo) {
      return;
    }
    void client.setMatchPaused(paused).catch(() => {
      /* host pause sync is best-effort */
    });
  }, [client, paused, screen, sessionKind, sessionInfo]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    gameSettingsRef.current = gameSettings;
    audio.setMasterVolume(gameSettings.masterVolume);
    audio.setMusicEnabled(gameSettings.musicEnabled);
  }, [audio, gameSettings]);

  useEffect(() => {
    const unlockAudio = () => {
      void audio.ensureReady().then(() => audio.onUnlocked());
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [audio]);

  useEffect(() => {
    if (!gameSettings.musicEnabled) {
      audio.setMusicMode('off');
      return;
    }
    audio.setPaused(paused && screen === 'game');
    if (screen === 'main-menu' || screen === 'settings') {
      audio.setMusicMode('menu');
      return;
    }
    if (screen === 'lobby' || screen === 'server-select' || screen === 'loadout') {
      audio.setMusicMode('lobby');
      return;
    }
    if (screen === 'game') {
      audio.setMusicMode(matchEnded ? 'lobby' : 'match');
    }
  }, [audio, gameSettings.musicEnabled, matchEnded, paused, screen]);

  useEffect(() => {
    input.setEnabled(!paused && !matchEnded);
  }, [input, matchEnded, paused]);

  useEffect(() => {
    client.listenForState((state) => {
      latestStateRef.current = state;
      setLatestState(state);
      setMatchEnded(state.match_ended);
      if (state.match_ended) {
        releaseGamePointer();
      }
      input.setWorld(state.world);
      if (screenRef.current === 'game') {
        renderer.applyState(state);
        gameAudio.applyState(state, myIdRef.current);
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
      if (screenRef.current === 'game' && renderer.isMounted) {
        gameAudio.resetMatch();
        renderer.prepareRematch();
        renderer.applyState(state);
        void client.signalArenaReady();
        return;
      }
      void enterGame(state);
    });
    client.listenForMatchEnded((state) => {
      latestStateRef.current = state;
      setLatestState(state);
      setMatchEnded(true);
      setPaused(false);
      releaseGamePointer();
      renderer.applyState(state);
      gameAudio.applyState(state, myIdRef.current);
    });
    client.listenForSessionLost((message) => {
      setError(message);
      void leaveLobby();
    });

    return () => {
      client.dispose();
      input.detach();
      gameAudio.resetMatch();
      audio.dispose();
      if (inputTimerRef.current !== null) {
        window.clearInterval(inputTimerRef.current);
      }
    };
  }, [audio, client, gameAudio, input, renderer]);

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

  useEffect(() => {
    writeStoredPrimaryWeaponId(selectedPrimaryWeaponId);
  }, [selectedPrimaryWeaponId]);

  async function scanForServers() {
    setIsScanning(true);
    setScanMessage('Scanning LAN (broadcast + multicast on UDP 5554)...');
    try {
      const found = await client.scanServers();
      setServers(found);
      setScanMessage(
        found.length
          ? `Found ${found.length} host${found.length === 1 ? '' : 's'}.`
          : 'No hosts found. School WiFi often blocks LAN discovery — use manual IP from the host lobby.',
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
      const joinAddress = (ip ?? pendingJoinIpRef.current ?? joinIp).trim() || '127.0.0.1';
      const session =
        kind === 'host'
          ? await client.host(
              playerName,
              selectedCharacterId,
              selectedPrimaryWeaponId,
              gameSettingsRef.current.serverName,
            )
          : await client.join(
              joinAddress,
              playerName,
              selectedCharacterId,
              selectedPrimaryWeaponId,
            );
      pendingJoinIpRef.current = null;
      setSessionInfo(session);
      sessionInfoRef.current = session;
      setMyId(session.player_id);
      myIdRef.current = session.player_id;
      setIsReady(false);
      setMatchEnded(false);
      setScreen('lobby');
      await client.setReady(false);
      if (kind === 'host') {
        await client.updateLobbyConfig({
          ...DEFAULT_LOBBY_CONFIG,
          server_name: gameSettingsRef.current.serverName,
        });
      }
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

  async function kickPlayer(playerId: number) {
    setIsBusy(true);
    setError(null);
    try {
      await client.kickPlayer(playerId);
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsBusy(false);
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

  async function setPlayerTeam(playerId: number, team: number) {
    try {
      await client.setPlayerTeam(playerId, team);
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
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (inputTimerRef.current !== null) {
      window.clearInterval(inputTimerRef.current);
      inputTimerRef.current = null;
    }
    input.detach();
    input.setEnabled(true);
    renderer.destroy();
    gameAudio.resetMatch();
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

  async function exitGame() {
    try {
      await client.stopSession();
    } catch {
      // Still try to close the app.
    }
    teardownGameRuntime();
    setSessionInfo(null);
    sessionInfoRef.current = null;
    setLobby(null);
    setIsReady(false);
    setError(null);
    setLatestState(null);
    latestStateRef.current = null;

    const closed = await closeApplicationWindow();
    if (!closed) {
      setScreen('main-menu');
    }
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
      if (renderer.isMounted && latestStateRef.current) {
        gameAudio.resetMatch();
        renderer.prepareRematch();
        renderer.applyState(latestStateRef.current);
      }
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function enterGame(initialState: StateSnapshot) {
    const container = gameContainerRef.current;
    if (!container) return;
    const playerId = sessionInfoRef.current?.player_id ?? myIdRef.current;
    const state = latestStateRef.current ?? initialState;

    if (!renderer.isMounted) {
      if (inputTimerRef.current !== null) {
        window.clearInterval(inputTimerRef.current);
        inputTimerRef.current = null;
      }
      input.detach();
      setArenaLoading(true);
      try {
        await renderer.mount(container, state.world, playerId);
      } finally {
        setArenaLoading(false);
      }
      input.attach(renderer.canvas, state.world);
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      inputTimerRef.current = window.setInterval(async () => {
        if (pausedRef.current || matchEndedRef.current || latestStateRef.current?.match_ended) {
          return;
        }
        const player =
          latestStateRef.current?.players.find((candidate) => candidate.id === playerId) ?? null;
        try {
          await client.sendInput(input.sample(player));
        } catch {
          // Best-effort UDP input should not break the UI.
        }
      }, 1000 / 60);
    }

    setScreen('game');
    void audio.ensureReady();
    gameAudio.resetMatch();
    renderer.applyState(state);
    gameAudio.applyState(state, playerId);
    try {
      await client.signalArenaReady();
    } catch {
      // Best-effort; host unpauses when all peers report ready.
    }
  }

  function saveGameSettings(next: GameSettings) {
    setGameSettings(next);
    writeGameSettings(next);
  }

  function openSettings() {
    setScreen('settings');
  }

  function goToServerSelect() {
    setSessionKind('join');
    setScreen('server-select');
  }

  function goToLoadout(kind: SessionKind, joinIpAddress?: string) {
    loadoutReturnScreenRef.current = null;
    setSessionKind(kind);
    if (joinIpAddress) {
      pendingJoinIpRef.current = joinIpAddress;
      setJoinIp(joinIpAddress);
    }
    setError(null);
    setScreen('loadout');
  }

  function openLoadoutFromSession() {
    const current = screenRef.current;
    loadoutReturnScreenRef.current = current === 'game' ? 'game' : 'lobby';
    if (current === 'game') {
      setPaused(true);
      const me = latestStateRef.current?.players.find(
        (player) => player.id === myIdRef.current,
      );
      if (me) {
        setSelectedCharacterId(me.pending_character_id ?? me.character_id);
        const weaponId =
          me.primary_weapon?.weapon_id ?? me.active_weapon ?? readStoredPrimaryWeaponId();
        if (weaponId) {
          setSelectedPrimaryWeaponId(weaponId);
        }
      }
    } else {
      const me = lobby?.players.find((player) => player.id === myIdRef.current);
      if (me) {
        setSelectedCharacterId(me.character_id);
        setSelectedPrimaryWeaponId(me.primary_weapon_id ?? readStoredPrimaryWeaponId());
      }
    }
    setError(null);
    setScreen('loadout');
  }

  function leaveLoadout() {
    const returnTo = loadoutReturnScreenRef.current;
    loadoutReturnScreenRef.current = null;
    setError(null);
    if (returnTo) {
      setScreen(returnTo);
      if (returnTo === 'game') {
        setPaused(false);
      }
      return;
    }
    if (sessionKind === 'join' && !sessionInfoRef.current) {
      setScreen('server-select');
      return;
    }
    setScreen('main-menu');
  }

  async function applyLoadout() {
    if (!sessionInfoRef.current) {
      await createLobbySession(sessionKind);
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      await client.updateLoadout(selectedCharacterId, selectedPrimaryWeaponId);
      const returnTo = loadoutReturnScreenRef.current ?? 'lobby';
      loadoutReturnScreenRef.current = null;
      if (returnTo === 'lobby' && isReady) {
        setIsReady(false);
        await client.setReady(false);
      }
      setScreen(returnTo);
      if (returnTo === 'game') {
        setPaused(false);
      }
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  function testSound(volume: number) {
    audio.setMasterVolume(volume);
    void audio.ensureReady().then(() => audio.playGunshot({ isOwnShot: true }));
  }

  function backdropClass(): string {
    if (screen === 'main-menu') return 'landing-screen';
    if (screen === 'lobby') return 'lobby-screen';
    if (screen === 'loadout') return 'loadout-screen';
    if (screen === 'server-select') return 'flow-screen join-screen';
    if (screen === 'settings') return 'flow-screen settings-flow';
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
    selectedPrimaryWeaponId,
    setSelectedCharacterId,
    setSelectedPrimaryWeaponId,
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
    setPaused: setPausedWithSync,
    arenaLoading,
    backdropClass,
    scanForServers,
    createLobbySession,
    updateReady,
    updateName,
    updateLobbyConfig,
    kickPlayer,
    setPlayerTeam,
    startMatch,
    leaveLobby,
    leaveGame: leaveLobby,
    exitGame,
    returnToLobby,
    rematch,
    goToServerSelect,
    goToLoadout,
    openLoadoutFromSession,
    leaveLoadout,
    applyLoadout,
    loadoutMode: sessionInfo ? ('session' as const) : ('pregame' as const),
    openSettings,
    gameSettings,
    saveGameSettings,
    testSound,
    setScreen,
  };
}
