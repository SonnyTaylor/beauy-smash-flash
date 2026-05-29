import { useCallback, useEffect, useRef, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { isVersionNewer } from '../../shared/versionCompare';

export type UpdatePromptState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; update: Update; notes: string }
  | { status: 'downloading'; progress: number; version: string }
  | { status: 'error'; message: string };

export type UpdateStatus = {
  enabled: boolean;
  checking: boolean;
  checked: boolean;
  currentVersion: string;
  latestVersion: string | null;
  upToDate: boolean | null;
  hasUpdate: boolean;
  notes: string;
  error: string | null;
  showPrompt: boolean;
  promptState: UpdatePromptState;
};

function releaseNotes(update: Update): string {
  return update.body?.trim() || 'Bug fixes and improvements.';
}

export function useUpdatePrompt(enabled: boolean, currentVersion: string) {
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [upToDate, setUpToDate] = useState<boolean | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [notes, setNotes] = useState('');
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const dismissedVersionRef = useRef(dismissedVersion);
  dismissedVersionRef.current = dismissedVersion;
  const [promptState, setPromptState] = useState<UpdatePromptState>({ status: 'idle' });
  const [checkError, setCheckError] = useState<string | null>(null);

  const checkForUpdates = useCallback(
    async (options?: { manual?: boolean }) => {
      if (!enabled) return;
      setChecking(true);
      setCheckError(null);
      setPromptState({ status: 'checking' });
      try {
        const update = await check();
        setChecked(true);
        if (!update || !isVersionNewer(update.version, currentVersion)) {
          setLatestVersion(currentVersion);
          setUpToDate(true);
          setPendingUpdate(null);
          setNotes('');
          setPromptState({ status: 'idle' });
          return;
        }

        const nextNotes = releaseNotes(update);
        setLatestVersion(update.version);
        setUpToDate(false);
        setPendingUpdate(update);
        setNotes(nextNotes);
        if (dismissedVersionRef.current !== update.version) {
          setPromptState({ status: 'available', update, notes: nextNotes });
        } else {
          setPromptState({ status: 'idle' });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not reach the update server.';
        if (options?.manual) {
          setCheckError(message);
        }
        setPromptState({ status: 'idle' });
      } finally {
        setChecking(false);
      }
    },
    [currentVersion, enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    void checkForUpdates();
  }, [checkForUpdates, currentVersion, enabled]);

  async function installUpdate() {
    const update = pendingUpdate ?? (promptState.status === 'available' ? promptState.update : null);
    if (!update) return;

    setPromptState({ status: 'downloading', progress: 0, version: update.version });
    try {
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          const progress = total > 0 ? Math.min(1, downloaded / total) : 0;
          setPromptState({ status: 'downloading', progress, version: update.version });
        }
      });
      await relaunch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPromptState({ status: 'error', message });
    }
  }

  function dismissUpdate() {
    if (promptState.status === 'available') {
      setDismissedVersion(promptState.update.version);
    } else if (pendingUpdate) {
      setDismissedVersion(pendingUpdate.version);
    }
    setPromptState({ status: 'idle' });
  }

  function dismissError() {
    setCheckError(null);
    setPromptState({ status: 'idle' });
  }

  const hasUpdate = pendingUpdate != null;
  const showPrompt =
    promptState.status === 'available' ||
    promptState.status === 'downloading' ||
    promptState.status === 'error';

  const status: UpdateStatus = {
    enabled,
    checking,
    checked,
    currentVersion,
    latestVersion,
    upToDate,
    hasUpdate,
    notes,
    error: checkError,
    showPrompt,
    promptState,
  };

  return {
    status,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
    dismissError,
  };
}
