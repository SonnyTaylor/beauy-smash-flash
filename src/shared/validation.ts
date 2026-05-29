export function isValidHostAddress(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  // IPv4 with optional port (e.g. 192.168.1.42 or 192.168.1.42:5555)
  const match = trimmed.match(
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?::\d{1,5})?$/
  );
  if (!match) return false;

  if (trimmed.includes(':')) {
    const port = parseInt(trimmed.split(':')[1], 10);
    if (port > 65535) return false;
  }

  return true;
}
