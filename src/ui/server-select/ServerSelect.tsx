import type { AppInfo, ServerInfo } from '../../shared/types';
import { describeHostCompatibility } from '../../shared/compatibility';

function playerFillRatio(count: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(1, count / max);
}

export function ServerSelect({
  servers,
  joinIp,
  isScanning,
  scanMessage,
  isBusy,
  appInfo,
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
  appInfo: AppInfo;
  onJoinIpChange: (value: string) => void;
  onScan: () => void;
  onBack: () => void;
  onContinue: (ip: string) => void;
}) {
  const hasHosts = servers.length > 0;
  const trimmedIp = joinIp.trim();

  return (
    <section className="join-panel">
      <header className="panel-heading join-panel-heading">
        <div>
          <h3>LAN Hosts</h3>
          <span>{hasHosts ? `${servers.length} game${servers.length === 1 ? '' : 's'} nearby` : 'Scan or connect manually'}</span>
        </div>
        <button
          type="button"
          className={`scan-button secondary-button ${isScanning ? 'scanning' : ''}`}
          onClick={onScan}
          disabled={isScanning}
        >
          <span className="scan-button-dot" aria-hidden />
          {isScanning ? 'Scanning…' : 'Scan LAN'}
        </button>
      </header>

      <div className={`join-hosts ${hasHosts ? 'has-hosts' : 'is-empty'}`}>
        {hasHosts ? (
          <ul className="host-list" role="list">
            {servers.map((server) => {
              const fill = playerFillRatio(server.player_count, server.max_players);
              const isFull = server.player_count >= server.max_players;
              const compatibility = describeHostCompatibility(appInfo, server);
              const blocked = !compatibility.ok || isFull;
              const hostVersion = server.app_version ? `v${server.app_version}` : `protocol ${server.version}`;

              return (
                <li key={`${server.address}:${server.game_port}`}>
                  <button
                    type="button"
                    className={`host-card ${!compatibility.ok ? 'host-card-incompatible' : ''}`}
                    disabled={isBusy || blocked}
                    title={!compatibility.ok ? compatibility.reason : compatibility.warning}
                    onClick={() => {
                      onJoinIpChange(server.address);
                      onContinue(server.address);
                    }}
                  >
                    <span className="host-card-main">
                      <span className="host-card-title">
                        <strong>{server.name}</strong>
                        <span className="lan-badge">LAN</span>
                        <span className={`host-version-badge ${!compatibility.ok ? 'bad' : ''}`}>
                          {hostVersion}
                        </span>
                      </span>
                      <span className="host-card-address">
                        {server.address}:{server.game_port}
                      </span>
                      {!compatibility.ok && (
                        <span className="host-card-warning">{compatibility.reason}</span>
                      )}
                      {compatibility.ok && compatibility.warning && (
                        <span className="host-card-warning soft">{compatibility.warning}</span>
                      )}
                    </span>

                    <span className="host-card-meta">
                      <span className="host-slots" aria-label={`${server.player_count} of ${server.max_players} players`}>
                        <span className="host-slots-label">Mates</span>
                        <span className="host-slots-count">
                          {server.player_count}/{server.max_players}
                        </span>
                        <span className="host-slots-bar" aria-hidden>
                          <span className="host-slots-fill" style={{ width: `${fill * 100}%` }} />
                        </span>
                      </span>
                      <span className="host-join-label">
                        {!compatibility.ok ? 'Update' : isFull ? 'Full' : 'Join'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="join-empty">
            <div className={`join-empty-radar ${isScanning ? 'active' : ''}`} aria-hidden>
              <span className="join-empty-ring" />
              <span className="join-empty-ring delay" />
              <span className="join-empty-core" />
            </div>
            <p className="join-empty-title">{isScanning ? 'Searching the LAN…' : 'No hosts found yet'}</p>
            <p className="join-empty-message">{scanMessage}</p>
            {!isScanning && (
              <button type="button" className="secondary-button join-empty-scan" onClick={onScan}>
                Scan LAN
              </button>
            )}
          </div>
        )}
      </div>

      <section className="direct-connect">
        <header className="panel-heading">
          <h3>Direct Connect</h3>
          <span>IP or IP:port if broadcast is blocked</span>
        </header>
        <label className="field-label direct-connect-field">
          Host address
          <input
            value={joinIp}
            onChange={(event) => onJoinIpChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && trimmedIp && !isBusy) {
                onContinue(trimmedIp);
              }
            }}
            inputMode="decimal"
            placeholder="192.168.1.42 or 192.168.1.42:5555"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <p className="setting-hint">
          Direct connect still requires matching protocol {appInfo.protocol_version}. Update if join fails.
        </p>
      </section>

      <footer className="join-footer">
        <button type="button" className="ghost-button" onClick={onBack} disabled={isBusy}>
          Back
        </button>
        <button
          type="button"
          className="primary-action"
          onClick={() => onContinue(trimmedIp || '127.0.0.1')}
          disabled={isBusy || !trimmedIp}
        >
          {isBusy ? 'Joining…' : 'Join Game'}
        </button>
      </footer>
    </section>
  );
}
