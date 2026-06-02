import { invoke } from '@tauri-apps/api/core';

/**
 * Durable crash capture. JS errors and unhandled promise rejections are mirrored
 * to the Rust-side game.log (which is flushed per-line and survives a webview
 * crash), so a join/render crash on any machine leaves a stack trace behind.
 *
 * This is intentionally dependency-free and best-effort: logging must never
 * throw, or it could mask the original error.
 */

let installed = false;

function safeInvokeLog(tag: string, message: string): void {
  try {
    // Fire-and-forget. We cannot await inside a sync error handler, and the
    // Rust command opens+appends+closes per line, so the write is durable even
    // if the webview dies immediately after.
    void invoke('write_client_log', { tag, message }).catch(() => {
      /* swallow — logging must not throw */
    });
  } catch {
    /* swallow — invoke bridge may be unavailable */
  }
}

function describeError(value: unknown): string {
  if (value instanceof Error) {
    const stack = value.stack ?? '';
    return stack ? `${value.name}: ${value.message}\n${stack}` : `${value.name}: ${value.message}`;
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function installCrashLogging(): void {
  if (installed || typeof window === 'undefined') {
    return;
  }
  installed = true;

  window.addEventListener('error', (event) => {
    const detail = event.error
      ? describeError(event.error)
      : `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`;
    safeInvokeLog('crash', `window.error: ${detail}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    safeInvokeLog('crash', `unhandledrejection: ${describeError(event.reason)}`);
  });

  safeInvokeLog('crash', 'crash logging installed');
}
