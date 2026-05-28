import type { StateSnapshot } from '../../shared/types';

export function MatchScoreboard({
  state,
  myId,
}: {
  state: StateSnapshot;
  myId: number;
}) {
  const sorted = [...state.players].sort(
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
          <div
            key={player.id}
            className={`match-scoreboard-row ${player.id === myId ? 'me' : ''}`}
          >
            <span className="match-scoreboard-rank">{index + 1}</span>
            <span className="match-scoreboard-name">{player.name}</span>
            <span className="match-scoreboard-stats">
              {player.score} · {player.kills}K / {player.deaths}D
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
