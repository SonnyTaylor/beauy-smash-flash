import type { PlayerSnapshot, StateSnapshot } from '../../shared/types';
import { formatMatchTime, TEAM_OPTIONS } from '../constants';

export function HudMatchStrip({
  state,
  me,
  timeRemaining,
  layout = 'horizontal',
}: {
  state: StateSnapshot;
  me: PlayerSnapshot | null;
  timeRemaining: number | null;
  layout?: 'horizontal' | 'vertical';
}) {
  const showScore = state.win_condition !== 'time';
  const showTime = timeRemaining != null;
  const timeLow = timeRemaining != null && timeRemaining <= 30;
  const isTDM = state.gamemode === 'team_deathmatch';
  const teamScores = state.team_scores ?? [0, 0];

  return (
    <div
      className={`hud-match-strip ${layout === 'vertical' ? 'is-vertical' : ''}`}
      role="status"
    >
      {isTDM && (
        <div className="hud-strip-cell hud-strip-team">
          <span className="hud-strip-label" style={{ color: TEAM_OPTIONS[0].color }}>
            Alpha
          </span>
          <span className="hud-strip-value">{teamScores[0]}</span>
        </div>
      )}
      {isTDM && (
        <div className="hud-strip-cell hud-strip-team">
          <span className="hud-strip-label" style={{ color: TEAM_OPTIONS[1].color }}>
            Bravo
          </span>
          <span className="hud-strip-value">{teamScores[1]}</span>
        </div>
      )}
      {showScore && !isTDM && (
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
