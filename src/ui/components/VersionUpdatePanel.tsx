import type { AppInfo } from '../../shared/types';
import type { UpdateStatus } from '../hooks/useUpdatePrompt';

function formatVersion(version: string): string {
  return version.startsWith('v') ? version : `v${version}`;
}

export function VersionUpdatePanel({
  appInfo,
  status,
  onCheck,
  onInstall,
}: {
  appInfo: AppInfo;
  status: UpdateStatus;
  onCheck: () => void;
  onInstall: () => void;
}) {
  const currentLabel = formatVersion(status.currentVersion);
  const latestLabel = status.latestVersion ? formatVersion(status.latestVersion) : null;
  const downloading = status.promptState.status === 'downloading';
  const downloadProgress =
    status.promptState.status === 'downloading' ? status.promptState.progress : 0;
  const downloadPercent = Math.round(downloadProgress * 100);

  let latestStatus: 'pending' | 'checking' | 'current' | 'available' | 'unknown' = 'unknown';
  if (status.checking) {
    latestStatus = 'checking';
  } else if (status.hasUpdate) {
    latestStatus = 'available';
  } else if (status.upToDate) {
    latestStatus = 'current';
  } else if (!status.checked) {
    latestStatus = 'pending';
  }

  return (
    <aside className="version-update-panel" aria-label="Game version and updates">
      <div className="version-update-header">
        <span className="meta-label">Version</span>
        {status.hasUpdate && <span className="version-update-badge">Update ready</span>}
      </div>

      <div className="version-update-rows">
        <div className="version-update-row">
          <span className="version-update-label">Installed</span>
          <strong>{currentLabel}</strong>
        </div>
        <div className={`version-update-row ${latestStatus === 'available' ? 'is-highlight' : ''}`}>
          <span className="version-update-label">Latest</span>
          <strong
            className={
              latestStatus === 'available'
                ? 'is-new'
                : latestStatus === 'current'
                  ? 'is-current'
                  : undefined
            }
          >
            {latestStatus === 'checking'
              ? 'Checking…'
              : latestStatus === 'pending'
                ? '—'
                : latestLabel ?? currentLabel}
          </strong>
        </div>
        <div className="version-update-row is-muted">
          <span className="version-update-label">Protocol</span>
          <strong>{appInfo.protocol_version}</strong>
        </div>
      </div>

      {status.enabled ? (
        <div className="version-update-actions">
          {downloading ? (
            <div className="version-update-download">
              <div className="update-progress" aria-hidden>
                <span style={{ width: `${downloadPercent}%` }} />
              </div>
              <p className="version-update-hint">Downloading {downloadPercent}%</p>
            </div>
          ) : status.hasUpdate ? (
            <button type="button" className="primary-action version-update-button" onClick={onInstall}>
              Install {latestLabel}
            </button>
          ) : (
            <button
              type="button"
              className="ghost-button version-update-button"
              onClick={onCheck}
              disabled={status.checking}
            >
              {status.checking ? 'Checking…' : status.checked ? 'Check again' : 'Check for updates'}
            </button>
          )}
        </div>
      ) : (
        <p className="version-update-hint">Auto-updates run in the desktop app.</p>
      )}

      {status.error && <p className="version-update-error">{status.error}</p>}

      {status.enabled && status.checked && status.upToDate && !status.checking && !status.error && (
        <p className="version-update-hint is-success">You&apos;re on the latest version.</p>
      )}

      {status.hasUpdate && status.notes && !downloading && (
        <p className="version-update-notes">{status.notes}</p>
      )}
    </aside>
  );
}
