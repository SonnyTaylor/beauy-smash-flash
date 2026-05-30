import type { PlayerSnapshot, StateSnapshot } from '../../shared/types';
import { resolvePlayerDisplayName } from '../../shared/playerName';
import { TEAM_OPTIONS } from '../constants';

function PlayerRow({
  player,
  myId,
  index,
}: {
  player: PlayerSnapshot;
  myId: number;
  index: number;
}) {
  const team = player.team ?? 0;
  const teamColor =
    team === 1 ? TEAM_OPTIONS[0].color : team === 2 ? TEAM_OPTIONS[1].color : undefined;
  return (
    <div
      key={player.id}
      className={`match-scoreboard-row ${player.id === myId ? 'me' : ''}`}
    >
      <span className="match-scoreboard-rank">{index + 1}</span>
      <span
        className="match-scoreboard-name"
        style={teamColor ? { borderLeft: `3px solid ${teamColor}`, paddingLeft: 6 } : undefined}
      >
        {resolvePlayerDisplayName(player.name, player.character_id)}
        {player.is_bot ? <span className="match-scoreboard-bot">Bot</span> : null}
      </span>
      <span className="match-scoreboard-stats">
        {player.score} · {player.kills}K / {player.deaths}D
      </span>
    </div>
  );
}

export function MatchScoreboard({
  state,
  myId,
}: {
  state: StateSnapshot;
  myId: number;
}) {
  const isTDM = state.gamemode === 'team_deathmatch';
  const players = state.players.filter((p) => !p.is_zombie);
  const teamScores = state.team_scores ?? [0, 0];

  if (isTDM) {
    const alpha = [...players]
      .filter((p) => p.team === 1)
      .sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
    const bravo = [...players]
      .filter((p) => p.team === 2)
      .sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);

    return (
      <div className="match-scoreboard" role="dialog" aria-label="Live scoreboard">
        <header>
          <h3>Scoreboard</h3>
          <span className="match-scoreboard-hint">Hold Tab</span>
        </header>
        <div className="match-scoreboard-teams">
          <div className="match-scoreboard-team">
            <div
              className="match-scoreboard-team-header"
              style={{ color: TEAM_OPTIONS[0].color }}
            >
              <strong>Alpha</strong>
              <span>{teamScores[0]} kills</span>
            </div>
            <div className="match-scoreboard-rows">
              {alpha.map((player, index) => (
                <PlayerRow key={player.id} player={player} myId={myId} index={index} />
              ))}
              {alpha.length === 0 && (
                <div className="match-scoreboard-empty">No players</div>
              )}
            </div>
          </div>
          <div className="match-scoreboard-team">
            <div
              className="match-scoreboard-team-header"
              style={{ color: TEAM_OPTIONS[1].color }}
            >
              <strong>Bravo</strong>
              <span>{teamScores[1]} kills</span>
            </div>
            <div className="match-scoreboard-rows">
              {bravo.map((player, index) => (
                <PlayerRow key={player.id} player={player} myId={myId} index={index} />
              ))}
              {bravo.length === 0 && (
                <div className="match-scoreboard-empty">No players</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sorted = [...players].sort(
    (a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths,
  );

  return (
    <div className="match-scoreboard" role="dialog" aria-label="Live scoreboard">
      <header>
        <h3>Scoreboard</h3>
        <span className="match-scoreboard-hint">Hold Tab</span>
      </header>
      <div className="match-scoreboard-rows">
        {sorted.map((player, index) => (
          <PlayerRow key={player.id} player={player} myId={myId} index={index} />
        ))}
      </div>
    </div>
  );
}
