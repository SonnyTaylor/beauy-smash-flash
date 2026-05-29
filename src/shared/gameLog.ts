import { invoke } from '@tauri-apps/api/core';

export function logGameEvent(tag: string, message: string): void {
  void invoke('write_client_log', { tag, message }).catch(() => {
    // Logging should never break gameplay.
  });
}
