export function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <div className="setting-control">{children}</div>
    </div>
  );
}

export function Cycle({
  value,
  values,
  disabled,
  onChange,
  fallback,
}: {
  value: string;
  values: Array<{ id: string; label: string; disabled?: boolean }>;
  disabled?: boolean;
  onChange: (id: string) => void;
  fallback?: string;
}) {
  const selectable = values.filter((option) => !option.disabled);

  if (disabled || selectable.length <= 1) {
    const current = values.find((option) => option.id === value)?.label ?? fallback ?? value;
    const locked = values.find((option) => option.id === value)?.disabled;
    return (
      <span className="cycle-static">
        {current}
        {locked && <span className="cycle-soon">Soon</span>}
      </span>
    );
  }

  const currentIndex = Math.max(
    0,
    selectable.findIndex((option) => option.id === value),
  );

  function step(delta: number) {
    const nextIndex = (currentIndex + delta + selectable.length) % selectable.length;
    onChange(selectable[nextIndex].id);
  }

  return (
    <div className="cycle">
      <button type="button" className="cycle-arrow" onClick={() => step(-1)} aria-label="Previous">
        ‹
      </button>
      <span className="cycle-value">{selectable[currentIndex].label}</span>
      <button type="button" className="cycle-arrow" onClick={() => step(1)} aria-label="Next">
        ›
      </button>
    </div>
  );
}
