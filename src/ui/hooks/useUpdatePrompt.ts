import { useCallback, useEffect, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdatePromptState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; update: Update; notes: string }
  | { status: 'downloading'; progress: number }
  | { status: 'error'; message: string };

function releaseNotes(update: Update): string {
  return update.body?.trim() || 'Bug fixes and improvements.';
}

export function useUpdatePrompt(enabled: boolean) {
  const [state, setState] = useState<UpdatePromptState>({ status: 'idle' });
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    if (!enabled) return;
    setState({ status: 'checking' });
    try {
      const update = await check();
      if (!update) {
        setState({ status: 'idle' });
        return;
      }
      if (dismissedVersion === update.version) {
        setState({ status: 'idle' });
        return;
      }
      setState({ status: 'available', update, notes: releaseNotes(update) });
    } catch {
      setState({ status: 'idle' });
    }
  }, [dismissedVersion, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void checkForUpdates();
  }, [checkForUpdates, enabled]);

  async function installUpdate() {
    if (state.status !== 'available') return;
    const { update } = state;
    setState({ status: 'downloading', progress: 0 });
    try {
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          const progress = total > 0 ? Math.min(1, downloaded / total) : 0;
          setState({ status: 'downloading', progress });
        }
      });
      await relaunch();
    } catch (error) {
      setState({ status: 'error', message: String(error) });
    }
  }

  function dismissUpdate() {
    if (state.status === 'available') {
      setDismissedVersion(state.update.version);
    }
    setState({ status: 'idle' });
  }

  return {
    state,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
  };
}
