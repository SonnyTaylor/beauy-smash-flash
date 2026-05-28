import { useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterDefinition, PlayerSnapshot, StateSnapshot } from '../../shared/types';
import { formatMatchTime, GLOCK_RELOAD_SECS } from '../constants';
import { getCharacter } from '../character';

interface HitMarker {
  id: number;
  text: string;
  kind: 'taken' | 'dealt';
}

function matchGoalLabel(state: StateSnapshot | null): string {
  if (!state) return '';
  if (state.win_condition === 'time') {
    return state.time_limit_secs > 0
      ? `Highest score after ${formatMatchTime(state.time_limit_secs)}`
      : 'Highest score when time runs out';
  }
  if (state.win_condition === 'either') {
    const parts: string[] = [];
    if (state.score_limit > 0) parts.push(`first to ${state.score_limit} kills`);
    if (state.time_limit_secs > 0) parts.push(formatMatchTime(state.time_limit_secs));
    return parts.length > 0 ? parts.join(' or ') : 'Most kills wins';
  }
  return `First to ${state.score_limit} kills`;
}

function endReasonLabel(state: StateSnapshot | null): string {
  if (!state?.match_end_reason) return matchGoalLabel(state);
  if (state.match_end_reason === 'time') {
    return 'Time limit reached';
  }
  return `Reached ${state.score_limit} kills`;
}

function timeRemaining(state: StateSnapshot | null): number | null {
  if (!state || state.time_limit_secs <= 0) return null;
  return Math.max(0, Math.ceil(state.time_limit_secs - state.match_elapsed_secs));
}

function Podium({
  players,
  winnerId,
}: {
  players: PlayerSnapshot[];
  winnerId: number | null;
}) {
  const sorted = [...players].sort(
    (a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths,
  );
  const top = sorted.slice(0, 3);
  const order = top.length >= 3 ? [top[1], top[0], top[2]] : top;

  return (
    <div className={`game-podium game-podium-${order.length}`}>
      {order.map((player) => {
        const place = top.indexOf(player) + 1;
        const character = getCharacter(player.character_id);
        const isWinner = player.id === winnerId;
        return (
          <div
            key={player.id}
            className={`podium-slot podium-place-${place} ${isWinner ? 'podium-winner' : ''}`}
            style={
              { '--accent': `rgb(${character.color.join(' ')})` } as React.CSSProperties
            }
          >
            <span className="podium-rank">{place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'}</span>
            <div className="podium-avatar">
              <img
                src={`/assets/${character.sprite}`}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
              <span>{character.initials}</span>
            </div>
            <strong>{player.name}</strong>
            <span className="podium-stats">
              {player.score} · {player.kills}K / {player.deaths}D
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function GameOverlay({
  state,
  myId,
  sessionKind,
  selectedCharacter,
  paused,
  isBusy,
  onPauseChange,
  onLeaveToMenu,
  onReturnToLobby,
  onRematch,
}: {
  state: StateSnapshot | null;
  myId: number;
  sessionKind: 'host' | 'join';
  selectedCharacter: CharacterDefinition;
  paused: boolean;
  isBusy?: boolean;
  onPauseChange: (paused: boolean) => void;
  onLeaveToMenu: () => void;
  onReturnToLobby: () => void;
  onRematch: () => void;
}) {
  const me = state?.players.find((player) => player.id === myId);
  const character = getCharacter(me?.character_id ?? selectedCharacter.id);
  const matchEnded = state?.match_ended ?? false;
  const winner =
    state?.winner_id != null
      ? (state.players.find((player) => player.id === state.winner_id) ?? null)
      : null;
  const sortedScores = [...(state?.players ?? [])].sort(
    (a, b) => b.score - a.score || b.kills - a.kills,
  );
  const hpRatio = me ? me.hp / Math.max(me.max_hp, 1) : 0;
  const reloadRemaining = me?.reload_remaining ?? 0;
  const isReloading = reloadRemaining > 0 || (me?.reloading ?? false);
  const reloadRatio = isReloading
    ? 1 - reloadRemaining / GLOCK_RELOAD_SECS
    : 0;
  const ammoLabel = isReloading ? 'Reloading...' : `${me?.ammo ?? 0} / ${me?.max_ammo ?? 0}`;
  const remaining = timeRemaining(state);
  const showTimer = (state?.time_limit_secs ?? 0) > 0 && state?.win_condition !== 'kills';
  const isDead = me && !me.alive && me.respawn_in > 0 && !matchEnded;

  const [hitFlash, setHitFlash] = useState(false);
  const [hitMarkers, setHitMarkers] = useState<HitMarker[]>([]);
  const hpRef = useRef<Map<number, number>>(new Map());
  const markerIdRef = useRef(0);

  const lastKiller = useMemo(() => {
    if (!state || !me) return null;
    const entry = [...state.kill_feed]
      .reverse()
      .find((line) => line.victim_id === myId);
    if (!entry) return null;
    if (entry.killer_id === myId) return 'You';
    return entry.killer_name;
  }, [state?.kill_feed, me, myId]);

  useEffect(() => {
    if (!state || matchEnded) return;

    const nextMarkers: HitMarker[] = [];
    let tookDamage = false;

    for (const player of state.players) {
      const prevHp = hpRef.current.get(player.id);
      hpRef.current.set(player.id, player.hp);
      if (prevHp === undefined || player.hp >= prevHp) continue;

      const damage = prevHp - player.hp;
      if (player.id === myId) {
        tookDamage = true;
        nextMarkers.push({
          id: markerIdRef.current++,
          text: `-${damage}`,
          kind: 'taken',
        });
      } else if (player.id !== myId && damage > 0) {
        nextMarkers.push({
          id: markerIdRef.current++,
          text: `-${damage}`,
          kind: 'dealt',
        });
      }
    }

    if (tookDamage) {
      setHitFlash(true);
      window.setTimeout(() => setHitFlash(false), 180);
    }

    if (nextMarkers.length > 0) {
      setHitMarkers((current) => [...current, ...nextMarkers].slice(-6));
      const ids = nextMarkers.map((marker) => marker.id);
      window.setTimeout(() => {
        setHitMarkers((current) => current.filter((marker) => !ids.includes(marker.id)));
      }, 900);
    }
  }, [state, matchEnded, myId]);

  useEffect(() => {
    if (matchEnded) {
      hpRef.current.clear();
      setHitMarkers([]);
      setHitFlash(false);
    }
  }, [matchEnded]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !matchEnded) {
        onPauseChange(!paused);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [matchEnded, onPauseChange, paused]);

  return (
    <>
      <div className={`game-overlay ${paused || matchEnded ? 'paused' : ''}`}>
        <div className="hud-left">
          <div className="hud-pill hud-player">
            <span
              className="hud-avatar"
              style={{ '--accent': `rgb(${character.color.join(' ')})` } as React.CSSProperties}
            >
              <img
                src={`/assets/${character.sprite}`}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
              <span>{character.initials}</span>
            </span>
            <span className="hud-player-text">
              <strong>{me?.name || 'Player'}</strong>
              <span>{character.abilityName}</span>
            </span>
          </div>

          <div className="hud-pill hud-combat">
            <div className="hud-bar-label">
              <span>Health</span>
              <span>{me?.hp ?? 0}</span>
            </div>
            <div className="hud-bar-track">
              <div className="hud-bar-fill hud-bar-health" style={{ width: `${hpRatio * 100}%` }} />
            </div>
            <div className="hud-bar-label hud-ammo-row">
              <span>Ammo</span>
              <span className={isReloading ? 'hud-reloading' : ''}>{ammoLabel}</span>
            </div>
            {isReloading && (
              <div className="hud-bar-track hud-reload-track">
                <div
                  className="hud-bar-fill hud-bar-reload"
                  style={{ width: `${Math.min(1, Math.max(0, reloadRatio)) * 100}%` }}
                />
              </div>
            )}
          </div>

          <div className="hud-pill hud-stats">
            {state?.win_condition !== 'time' && (
              <span>
                Score {me?.score ?? 0}
                {state?.score_limit ? ` / ${state.score_limit}` : ''}
              </span>
            )}
            <span>
              K {me?.kills ?? 0} · D {me?.deaths ?? 0}
            </span>
          </div>
        </div>

        {showTimer && remaining != null && !matchEnded && (
          <div className={`hud-timer ${remaining <= 30 ? 'hud-timer-low' : ''}`}>
            <span className="hud-timer-label">Time</span>
            <strong>{formatMatchTime(remaining)}</strong>
          </div>
        )}

        <div className="hud-right">
          <div className="hud-pill hud-kill-feed">
            {(state?.kill_feed ?? []).slice().reverse().map((entry, index) => (
              <div key={`${entry.killer_id}-${entry.victim_id}-${index}`} className="kill-feed-line">
                <strong>{entry.killer_name}</strong>
                <span> fragged </span>
                <strong>{entry.victim_name}</strong>
              </div>
            ))}
          </div>
        </div>

        {!matchEnded && (
          <button type="button" className="game-menu-button" onClick={() => onPauseChange(true)}>
            Menu
          </button>
        )}
      </div>

      {hitFlash && <div className="hit-vignette" aria-hidden />}

      <div className="hit-marker-layer" aria-hidden>
        {hitMarkers.map((marker) => (
          <span key={marker.id} className={`hit-marker hit-marker-${marker.kind}`}>
            {marker.text}
          </span>
        ))}
      </div>

      {isDead && (
        <div className="death-screen" role="status" aria-live="polite">
          <p className="screen-kicker">Eliminated</p>
          <h2>You&apos;re down</h2>
          {lastKiller && lastKiller !== 'You' ? (
            <p className="death-killer">
              Taken out by <strong>{lastKiller}</strong>
            </p>
          ) : (
            <p className="death-killer">Respawning soon</p>
          )}
          <div className="death-timer">
            <span>Respawn</span>
            <strong>{me.respawn_in.toFixed(1)}s</strong>
          </div>
        </div>
      )}

      {paused && !matchEnded && (
        <div className="game-pause-backdrop" role="dialog" aria-label="Pause menu">
          <div className="game-pause-panel">
            <p className="screen-kicker">Paused</p>
            <h2>Game Menu</h2>
            <div className="game-pause-actions">
              <button type="button" className="primary-action" onClick={() => onPauseChange(false)}>
                Resume
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  onPauseChange(false);
                  onLeaveToMenu();
                }}
              >
                Main Menu
              </button>
            </div>
            <p className="game-pause-hint">Esc to resume</p>
          </div>
        </div>
      )}

      {matchEnded && (
        <div className="game-over-backdrop" role="dialog" aria-label="Match over">
          <div className="game-over-panel game-over-panel-wide">
            <p className="screen-kicker">Match Over</p>
            <h2>{winner ? `${winner.name} wins` : 'Draw'}</h2>
            <p className="game-over-subtitle">{endReasonLabel(state)}</p>

            <Podium players={state?.players ?? []} winnerId={state?.winner_id ?? null} />

            <div className="game-over-scores">
              {sortedScores.map((player) => (
                <div
                  key={player.id}
                  className={`game-over-row ${player.id === winner?.id ? 'winner' : ''}`}
                >
                  <span>{player.name}</span>
                  <span>
                    {player.score} · {player.kills}K / {player.deaths}D
                  </span>
                </div>
              ))}
            </div>

            <div className="game-pause-actions">
              {sessionKind === 'host' ? (
                <>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={onRematch}
                    disabled={isBusy}
                  >
                    {isBusy ? 'Starting…' : 'Rematch'}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={onReturnToLobby}
                    disabled={isBusy}
                  >
                    Back to Lobby
                  </button>
                </>
              ) : (
                <p className="game-over-wait">Waiting for host to rematch or return to lobby…</p>
              )}
              <button type="button" className="secondary-button" onClick={onLeaveToMenu}>
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
