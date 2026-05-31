export function MainMenu({
  onHost,
  onJoin,
  onProfile,
  onSettings,
  isBusy,
  error,
}: {
  onHost: () => void;
  onJoin: () => void;
  onProfile: () => void;
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
        <button className="secondary-button menu-character-button" onClick={onProfile} disabled={isBusy}>
          Character
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button
        type="button"
        className="menu-settings-corner"
        onClick={onSettings}
        disabled={isBusy}
        aria-label="Settings"
      >
        Settings
      </button>
    </section>
  );
}
