import type { ServerInfo } from '../../shared/types';
import { ServerSelect } from './ServerSelect';

export function ServerSelectScreen({
  servers,
  joinIp,
  isScanning,
  scanMessage,
  isBusy,
  localIp,
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
  localIp?: string | null;
  onJoinIpChange: (value: string) => void;
  onScan: () => void;
  onBack: () => void;
  onContinue: (ip: string) => void;
}) {
  return (
    <>
      <div className="brand-panel join-brand">
        <p className="eyebrow">Join Game</p>
        <h1>
          Find
          <span>Your Host</span>
        </h1>
        <p className="tagline">Hop on a mate&apos;s LAN game or punch in their IP if school WiFi blocks discovery.</p>
        <ul className="join-tips">
          <li>
            <span className="join-tip-label">Scan</span>
            <span>Broadcasts on UDP 5554 — works on home networks</span>
          </li>
          <li>
            <span className="join-tip-label">Manual</span>
            <span>Use the host&apos;s IP from their lobby screen</span>
          </li>
          {localIp && (
            <li>
              <span className="join-tip-label">You</span>
              <span className="join-tip-ip">{localIp}</span>
            </li>
          )}
        </ul>
      </div>

      <div className="screen-card join-card">
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
