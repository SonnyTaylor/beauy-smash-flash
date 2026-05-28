export function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function randomSignedBetween(min: number, max: number) {
  const value = randomBetween(min, max);
  return Math.random() > 0.5 ? value : -value;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
