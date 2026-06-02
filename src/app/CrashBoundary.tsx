import { Component, type ErrorInfo, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface CrashBoundaryProps {
  children: ReactNode;
}

interface CrashBoundaryState {
  error: Error | null;
}

function logCrash(error: Error, info: ErrorInfo): void {
  const stack = error.stack ?? `${error.name}: ${error.message}`;
  const componentStack = info.componentStack ?? '';
  const message = `react render: ${stack}\ncomponentStack:${componentStack}`;
  try {
    void invoke('write_client_log', { tag: 'crash', message }).catch(() => {
      /* logging must not throw */
    });
  } catch {
    /* invoke bridge unavailable */
  }
}

/**
 * Catches render-time crashes in any screen (e.g. the lobby after a join) so
 * the webview shows a recoverable error instead of going blank, and the stack
 * trace is mirrored to the durable Rust log.
 */
export class CrashBoundary extends Component<CrashBoundaryProps, CrashBoundaryState> {
  state: CrashBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): CrashBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logCrash(error, info);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="crash-overlay">
          <div className="crash-card">
            <h1>Something broke</h1>
            <p>The game hit an unexpected error and recovered the menu.</p>
            <pre className="crash-detail">{error.message}</pre>
            <button type="button" onClick={this.handleReset}>
              Back to safety
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
