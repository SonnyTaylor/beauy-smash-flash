import type { AppInfo, ServerInfo } from './types';

export type CompatibilityResult =
  | { ok: true; warning?: string }
  | { ok: false; reason: string; kind: 'protocol' | 'full' };

export function describeHostCompatibility(
  local: AppInfo,
  host: ServerInfo,
): CompatibilityResult {
  if (host.version !== local.protocol_version) {
    return {
      ok: false,
      kind: 'protocol',
      reason: `Host protocol v${host.version} — you are v${local.protocol_version}. Update the game to play together.`,
    };
  }

  const hostAppVersion = host.app_version?.trim();
  if (hostAppVersion && hostAppVersion !== local.app_version) {
    return {
      ok: true,
      warning: `Host v${hostAppVersion} · you v${local.app_version}`,
    };
  }

  return { ok: true };
}

export function formatAppVersionLabel(info: AppInfo): string {
  return `v${info.app_version} · protocol ${info.protocol_version}`;
}
