import { useEffect, useState } from 'react';
import type { CharacterDefinition, StateSnapshot } from '../../shared/types';
import { getCharacter } from '../character';

export function GameOverlay({
  state,
  myId,
  sessionKind,
  selectedCharacter,
  paused,
  onPauseChange,
  onLeaveToMenu,
  onReturnToLobby,
}: {
  state: StateSnapshot | null;
  myId: number;
  sessionKind: 'host' | 'join';
  selectedCharacter: CharacterDefinition;
  paused: boolean;
  onPauseChange: (paused: boolean) => void;
  onLeaveToMenu: () => void;
  onReturnToLobby: () => void;
}) {
  const me = state?.players.find((player) => player.id === myId);
  const character = getCharacter(me?.character_id ?? selectedCharacter.id);
  const matchEnded = state?.match_ended ?? false;
  const winner =
    state?.winner_id != null
      ? state.players.find((player) => player.id === state.winner_id) ?? null
      : null;
  const sortedScores = [...(state?.players ?? [])].sort((a, b) => b.score - a.score || b.kills - a.kills);
  const hpRatio = me ? me.hp / Math.max(me.max_hp, 1) : 0;
  const ammoLabel = me?.reloading ? 'Reloading...' : `${me?.ammo ?? 0} / ${me?.max_ammo ?? 0}`;

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
              <span className={me?.reloading ? 'hud-reloading' : ''}>{ammoLabel}</span>
            </div>
          </div>

          <div className="hud-pill hud-stats">
            <span>
              Score {me?.score ?? 0} / {state?.score_limit ?? 20}
            </span>
            <span>
              K {me?.kills ?? 0} · D {me?.deaths ?? 0}
            </span>
          </div>
        </div>

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

      {!me?.alive && me && me.respawn_in > 0 && !matchEnded && (
        <div className="game-respawn-banner">
          <p>You were eliminated</p>
          <strong>Respawning in {me.respawn_in.toFixed(1)}s</strong>
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
          <div className="game-over-panel">
            <p className="screen-kicker">Match Over</p>
            <h2>{winner ? `${winner.name} wins` : 'Draw'}</h2>
            <p className="game-over-subtitle">First to {state?.score_limit ?? 20} frags</p>

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
                <button type="button" className="primary-action" onClick={onReturnToLobby}>
                  Back to Lobby
                </button>
              ) : (
                <p className="game-over-wait">Waiting for host to return to lobby...</p>
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
