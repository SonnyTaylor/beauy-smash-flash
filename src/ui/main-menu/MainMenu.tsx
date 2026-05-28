export function MainMenu({
  onHost,
  onJoin,
  onSettings,
  isBusy,
  error,
}: {
  onHost: () => void;
  onJoin: () => void;
  onSettings: () => void;
  isBusy: boolean;
  error: string | null;
}) {
  return (
    <section className="menu-zone">
      <div className="title-stack">
        <h1 className="menu-title">Beauy Smash Flash</h1>
        <p className="tagline">Shoot your mates. No internet required.</p>
      </div>

      <div className="menu-actions">
        <button className="primary-action" onClick={onHost} disabled={isBusy}>
          {isBusy ? 'Starting…' : 'Host Game'}
        </button>
        <button className="secondary-button" onClick={onJoin} disabled={isBusy}>
          Join Game
        </button>
        <button className="ghost-button menu-settings-button" onClick={onSettings} disabled={isBusy}>
          Settings
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
