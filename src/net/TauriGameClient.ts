import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  InputSnapshot,
  LobbyConfig,
  LobbySnapshot,
  ServerInfo,
  SessionInfo,
  StateSnapshot,
} from '../shared/types';

type StateHandler = (state: StateSnapshot) => void;
type LobbyHandler = (lobby: LobbySnapshot) => void;
type MatchStartedHandler = (state: StateSnapshot) => void;
type MatchEndedHandler = (state: StateSnapshot) => void;

export class TauriGameClient {
  private unlistenState: UnlistenFn | null = null;
  private unlistenLobby: UnlistenFn | null = null;
  private unlistenMatchStarted: UnlistenFn | null = null;
  private unlistenMatchEnded: UnlistenFn | null = null;

  async listenForState(handler: StateHandler) {
    this.unlistenState?.();
    this.unlistenState = await listen<StateSnapshot>('state', (event) => {
      handler(event.payload);
    });
  }

  async host(playerName: string, characterId: string): Promise<SessionInfo> {
    return invoke<SessionInfo>('start_host', { playerName, characterId });
  }

  async join(ip: string, playerName: string, characterId: string): Promise<SessionInfo> {
    return invoke<SessionInfo>('join_game', { ip, playerName, characterId });
  }

  async sendInput(input: InputSnapshot): Promise<void> {
    await invoke('send_input', { input });
  }

  async listenForLobby(handler: LobbyHandler) {
    this.unlistenLobby?.();
    this.unlistenLobby = await listen<LobbySnapshot>('lobby', (event) => {
      handler(event.payload);
    });
  }

  async listenForMatchStarted(handler: MatchStartedHandler) {
    this.unlistenMatchStarted?.();
    this.unlistenMatchStarted = await listen<StateSnapshot>('match_started', (event) => {
      handler(event.payload);
    });
  }

  async listenForMatchEnded(handler: MatchEndedHandler) {
    this.unlistenMatchEnded?.();
    this.unlistenMatchEnded = await listen<StateSnapshot>('match_ended', (event) => {
      handler(event.payload);
    });
  }

  async scanServers(timeoutMs = 900): Promise<ServerInfo[]> {
    return invoke<ServerInfo[]>('scan_servers', { timeoutMs });
  }

  async localIp(): Promise<string> {
    return invoke<string>('local_ip');
  }

  async setReady(ready: boolean): Promise<void> {
    await invoke('set_ready', { ready });
  }

  async selectCharacter(characterId: string): Promise<void> {
    await invoke('select_character', { characterId });
  }

  async setName(name: string): Promise<void> {
    await invoke('set_name', { name });
  }

  async updateLobbyConfig(config: LobbyConfig): Promise<void> {
    await invoke('update_lobby_config', { config });
  }

  async startMatch(): Promise<void> {
    await invoke('start_match');
  }

  async returnToLobby(): Promise<void> {
    await invoke('return_to_lobby');
  }

  async stopSession(): Promise<void> {
    await invoke('stop_session');
  }

  dispose() {
    this.unlistenState?.();
    this.unlistenLobby?.();
    this.unlistenMatchStarted?.();
    this.unlistenMatchEnded?.();
    this.unlistenState = null;
    this.unlistenLobby = null;
    this.unlistenMatchStarted = null;
    this.unlistenMatchEnded = null;
  }
}
