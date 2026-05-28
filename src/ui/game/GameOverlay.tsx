import { useEffect, useState } from 'react';
import type { CharacterDefinition, StateSnapshot } from '../../shared/types';
import { getCharacter } from '../character';

export function GameOverlay({
  state,
  myId,
  selectedCharacter,
  onLeaveToMenu,
}: {
  state: StateSnapshot | null;
  myId: number;
  selectedCharacter: CharacterDefinition;
  onLeaveToMenu: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const me = state?.players.find((player) => player.id === myId);
  const character = getCharacter(me?.character_id ?? selectedCharacter.id);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPaused((open) => !open);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <div className={`game-overlay ${paused ? 'paused' : ''}`}>
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
          <div className="hud-pill hud-stats">
            <span>Mates {state?.players.length ?? 0}</span>
          </div>
        </div>

        <button type="button" className="game-menu-button" onClick={() => setPaused(true)}>
          Menu
        </button>
      </div>

      {paused && (
        <div className="game-pause-backdrop" role="dialog" aria-label="Pause menu">
          <div className="game-pause-panel">
            <p className="screen-kicker">Paused</p>
            <h2>Game Menu</h2>
            <div className="game-pause-actions">
              <button type="button" className="primary-action" onClick={() => setPaused(false)}>
                Resume
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPaused(false);
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
    </>
  );
}
