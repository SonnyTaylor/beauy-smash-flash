import { CopyChip } from '../components/CopyChip';
import { UpdatePrompt } from '../components/UpdatePrompt';
import { VersionUpdatePanel } from '../components/VersionUpdatePanel';
import { useAppInfo } from '../hooks/useAppInfo';
import { useUpdatePrompt } from '../hooks/useUpdatePrompt';
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
  const updatePrompt = useUpdatePrompt(updatesEnabled, appInfo.app_version);

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
      <VersionUpdatePanel
        appInfo={appInfo}
        status={updatePrompt.status}
        onCheck={() => void updatePrompt.checkForUpdates({ manual: true })}
        onInstall={() => void updatePrompt.installUpdate()}
      />
      {localIp && (
        <div className="lan-ip">
          <CopyChip label="Your IP" value={localIp} className="meta-chip lan-ip-chip" />
        </div>
      )}
      {updatePrompt.status.showPrompt && (
        <UpdatePrompt
          state={updatePrompt.status.promptState}
          onInstall={() => void updatePrompt.installUpdate()}
          onDismiss={updatePrompt.dismissUpdate}
          onRetry={() => void updatePrompt.checkForUpdates({ manual: true })}
          onDismissError={updatePrompt.dismissError}
        />
      )}
    </>
  );
}
