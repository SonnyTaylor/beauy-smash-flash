/** True when `candidate` is strictly newer than `current` (semver-ish x.y.z). */
export function isVersionNewer(candidate: string, current: string): boolean {
  const parse = (value: string) =>
    value
      .trim()
      .replace(/^v/i, '')
      .split('.')
      .map((part) => {
        const digits = part.match(/^\d+/);
        return digits ? Number.parseInt(digits[0], 10) : 0;
      });

  const next = parse(candidate);
  const base = parse(current);
  const length = Math.max(next.length, base.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (next[i] ?? 0) - (base[i] ?? 0);
    if (diff !== 0) {
      return diff > 0;
    }
  }
  return false;
}
