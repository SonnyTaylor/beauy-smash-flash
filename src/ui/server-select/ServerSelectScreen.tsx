import type { ServerInfo } from '../../shared/types';
import { ServerSelect } from './ServerSelect';

export function ServerSelectScreen({
  servers,
  joinIp,
  isScanning,
  scanMessage,
  isBusy,
  onJoinIpChange,
  onScan,
  onBack,
  onContinue,
}: {
  servers: ServerInfo[];
  joinIp: string;
  isScanning: boolean;
  scanMessage: string;
  isBusy: boolean;
  onJoinIpChange: (value: string) => void;
  onScan: () => void;
  onBack: () => void;
  onContinue: (ip: string) => void;
}) {
  return (
    <>
      <div className="brand-panel">
        <p className="eyebrow">Join LAN</p>
        <h1>
          Pick
          <span>A Host</span>
        </h1>
        <p className="tagline">Scan the LAN for hosts, or punch in an IP directly.</p>
      </div>

      <div className="screen-card">
        <ServerSelect
          servers={servers}
          joinIp={joinIp}
          isScanning={isScanning}
          scanMessage={scanMessage}
          isBusy={isBusy}
          onJoinIpChange={onJoinIpChange}
          onScan={onScan}
          onBack={onBack}
          onContinue={onContinue}
        />
      </div>
    </>
  );
}
