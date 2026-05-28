import { CopyChip } from '../components/CopyChip';
import { UpdatePrompt } from '../components/UpdatePrompt';
import { useAppInfo } from '../hooks/useAppInfo';
import { useUpdatePrompt } from '../hooks/useUpdatePrompt';
import { formatAppVersionLabel } from '../../shared/compatibility';
import { FloatingHeads } from './FloatingHeads';
import { MainMenu } from './MainMenu';

export function MainMenuScreen({
  localIp,
  isBusy,
  error,
  onHost,
  onJoin,
  onSettings,
}: {
  localIp: string | null;
  isBusy: boolean;
  error: string | null;
  onHost: () => void;
  onJoin: () => void;
  onSettings: () => void;
}) {
  const appInfo = useAppInfo();
  const updatesEnabled = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const updatePrompt = useUpdatePrompt(updatesEnabled);

  return (
    <>
      <FloatingHeads />
      <MainMenu
        onHost={onHost}
        onJoin={onJoin}
        onSettings={onSettings}
        isBusy={isBusy}
        error={error}
      />
      <span className="app-version-chip">{formatAppVersionLabel(appInfo)}</span>
      {localIp && (
        <div className="lan-ip">
          <CopyChip label="Your IP" value={localIp} className="meta-chip lan-ip-chip" />
        </div>
      )}
      <UpdatePrompt
        state={updatePrompt.state}
        onInstall={() => void updatePrompt.installUpdate()}
        onDismiss={updatePrompt.dismissUpdate}
        onRetry={() => void updatePrompt.checkForUpdates()}
      />
    </>
  );
}
