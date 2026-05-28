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
  values: Array<{ id: string; label: string }>;
  disabled?: boolean;
  onChange: (id: string) => void;
  fallback?: string;
}) {
  if (disabled || values.length <= 1) {
    const current = values.find((option) => option.id === value)?.label ?? fallback ?? value;
    return <span className="cycle-static">{current}</span>;
  }

  const currentIndex = Math.max(
    0,
    values.findIndex((option) => option.id === value),
  );

  function step(delta: number) {
    const nextIndex = (currentIndex + delta + values.length) % values.length;
    onChange(values[nextIndex].id);
  }

  return (
    <div className="cycle">
      <button type="button" className="cycle-arrow" onClick={() => step(-1)} aria-label="Previous">
        ‹
      </button>
      <span className="cycle-value">{values[currentIndex].label}</span>
      <button type="button" className="cycle-arrow" onClick={() => step(1)} aria-label="Next">
        ›
      </button>
    </div>
  );
}
