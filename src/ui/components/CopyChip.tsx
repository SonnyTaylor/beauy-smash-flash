import { useState } from 'react';

export function CopyChip({
  label,
  value,
  className = 'meta-chip',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for environments without clipboard API.
      const input = document.createElement('textarea');
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <span className={`${className} meta-chip-copy`}>
      <span className="meta-chip-body">
        <span className="meta-label">{label}</span>
        <strong>{value}</strong>
      </span>
      <button type="button" className="copy-chip-button" onClick={() => void copy()}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </span>
  );
}
