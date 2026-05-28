import type { ServerInfo } from '../../shared/types';
import { ScreenHeader } from '../components/ScreenHeader';

export function ServerSelect({
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
    <section className="flow-stack">
      <ScreenHeader kicker="Server Select" title="Pick a LAN host" />
      <div className="server-list">
        {servers.map((server) => (
          <button
            key={`${server.address}:${server.game_port}`}
            className="server-row"
            onClick={() => {
              onJoinIpChange(server.address);
              onContinue(server.address);
            }}
          >
            <span>
              <strong>{server.name}</strong>
              <small>
                {server.address}:{server.game_port}
              </small>
            </span>
            <span>
              {server.player_count}/{server.max_players}
            </span>
            <span>LAN</span>
          </button>
        ))}
        {!servers.length && <p className="network-note">{scanMessage}</p>}
      </div>
      <label className="field-label">
        Manual IP or IP:port
        <input value={joinIp} onChange={(event) => onJoinIpChange(event.currentTarget.value)} inputMode="decimal" />
      </label>
      <button className="secondary-button" onClick={onScan} disabled={isScanning}>
        {isScanning ? 'Scanning…' : 'Scan LAN'}
      </button>
      <div className="button-grid">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button onClick={() => onContinue(joinIp)} disabled={isBusy}>
          {isBusy ? 'Joining…' : 'Join'}
        </button>
      </div>
    </section>
  );
}
