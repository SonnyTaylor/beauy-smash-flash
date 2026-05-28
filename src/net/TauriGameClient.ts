import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { InputSnapshot, SessionInfo, StateSnapshot } from '../shared/types';

type StateHandler = (state: StateSnapshot) => void;

export class TauriGameClient {
  private unlistenState: UnlistenFn | null = null;

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

  dispose() {
    this.unlistenState?.();
    this.unlistenState = null;
  }
}
