export function ArenaLoadingOverlay() {
  return (
    <div className="arena-loading-overlay" role="status" aria-live="polite">
      <div className="arena-loading-panel">
        <span className="arena-loading-spinner" aria-hidden />
        <p className="screen-kicker">Loading</p>
        <h2>Arena</h2>
        <p className="arena-loading-hint">Pulling in maps, sprites, and VFX…</p>
      </div>
    </div>
  );
}
