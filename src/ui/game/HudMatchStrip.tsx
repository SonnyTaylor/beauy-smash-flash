import type { PlayerSnapshot, StateSnapshot } from '../../shared/types';
import { formatMatchTime } from '../constants';

export function HudMatchStrip({
  state,
  me,
  timeRemaining,
}: {
  state: StateSnapshot;
  me: PlayerSnapshot | null;
  timeRemaining: number | null;
}) {
  const showScore = state.win_condition !== 'time';
  const showTime = timeRemaining != null;
  const timeLow = timeRemaining != null && timeRemaining <= 30;

  return (
    <div className="hud-match-strip" role="status">
      {showScore && (
        <div className="hud-strip-cell">
          <span className="hud-strip-label">Score</span>
          <span className="hud-strip-value">
            {me?.score ?? 0}
            {state.score_limit > 0 && (
              <span className="hud-strip-meta"> / {state.score_limit}</span>
            )}
          </span>
        </div>
      )}
      <div className="hud-strip-cell hud-strip-kd">
        <span className="hud-strip-label">K · D</span>
        <span className="hud-strip-value">
          {me?.kills ?? 0}
          <span className="hud-strip-meta"> · {me?.deaths ?? 0}</span>
        </span>
      </div>
      {showTime && (
        <div className={`hud-strip-cell ${timeLow ? 'is-low' : ''}`}>
          <span className="hud-strip-label">Time</span>
          <span className="hud-strip-value">{formatMatchTime(timeRemaining ?? 0)}</span>
        </div>
      )}
    </div>
  );
}
