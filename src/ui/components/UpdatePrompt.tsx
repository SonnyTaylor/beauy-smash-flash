import type { UpdatePromptState } from '../hooks/useUpdatePrompt';

export function UpdatePrompt({
  state,
  onInstall,
  onDismiss,
  onRetry,
}: {
  state: UpdatePromptState;
  onInstall: () => void;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  if (state.status === 'idle' || state.status === 'checking') {
    return null;
  }

  if (state.status === 'downloading') {
    const percent = Math.round(state.progress * 100);
    return (
      <div className="update-prompt-backdrop" role="dialog" aria-label="Installing update">
        <div className="update-prompt-panel">
          <p className="screen-kicker">Updating</p>
          <h2>Downloading…</h2>
          <div className="update-progress">
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className="setting-hint">{percent}%</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="update-prompt-backdrop" role="dialog" aria-label="Update error">
        <div className="update-prompt-panel">
          <p className="screen-kicker">Update</p>
          <h2>Couldn&apos;t check for updates</h2>
          <p className="setting-hint">{state.message}</p>
          <div className="update-prompt-actions">
            <button type="button" className="secondary-button" onClick={onRetry}>
              Try again
            </button>
            <button type="button" className="ghost-button" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="update-prompt-backdrop" role="dialog" aria-label="Update available">
      <div className="update-prompt-panel">
        <p className="screen-kicker">Update available</p>
        <h2>Version {state.update.version}</h2>
        <p className="update-prompt-notes">{state.notes}</p>
        <div className="update-prompt-actions">
          <button type="button" className="primary-action" onClick={() => void onInstall()}>
            Install update
          </button>
          <button type="button" className="ghost-button" onClick={onDismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
