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
      {localIp && <span className="lan-ip">Your IP: {localIp}</span>}
    </>
  );
}
