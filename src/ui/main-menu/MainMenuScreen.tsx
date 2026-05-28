import { CopyChip } from '../components/CopyChip';
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
      {localIp && (
        <div className="lan-ip">
          <CopyChip label="Your IP" value={localIp} className="meta-chip lan-ip-chip" />
        </div>
      )}
    </>
  );
}
