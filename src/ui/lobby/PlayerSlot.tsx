import { type CSSProperties } from 'react';
import { getCharacter, rgbCss } from '../character';
import { EditableName } from '../components/EditableName';
import type { LobbyPlayerView } from './types';

export function PlayerSlot({
  player,
  isMe,
  onCharacterClick,
  onNameSubmit,
  onReadyToggle,
}: {
  player: LobbyPlayerView;
  isMe: boolean;
  onCharacterClick: () => void;
  onNameSubmit: (name: string) => void;
  onReadyToggle: () => void;
}) {
  const character = getCharacter(player.character_id);
  const accent = rgbCss(character.color);

  return (
    <div
      className={`slot ${isMe ? 'slot-me' : ''} ${player.ready ? 'slot-ready' : ''}`}
      style={{ '--accent': accent } as CSSProperties & Record<'--accent', string>}
    >
      <button
        type="button"
        className="slot-avatar"
        onClick={onCharacterClick}
        disabled={!isMe}
        aria-label={isMe ? 'Change character' : `${player.name}'s character`}
      >
        <img
          src={`/assets/${character.sprite}`}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <span>{character.initials}</span>
        {isMe && <span className="slot-avatar-hint">Change</span>}
      </button>

      <div className="slot-text">
        <strong className="slot-name">
          {isMe ? (
            <EditableName value={player.name} onSubmit={onNameSubmit} />
          ) : (
            player.name
          )}
          {player.is_host ? <span className="host-tag">Host</span> : null}
        </strong>
        <span className="slot-ability">{character.abilityName}</span>
      </div>

      {isMe ? (
        <button
          type="button"
          className={`ready-toggle ${player.ready ? 'ready' : ''}`}
          onClick={onReadyToggle}
        >
          {player.ready ? 'Ready' : 'Ready Up'}
        </button>
      ) : (
        <span className={`ready-pill ${player.ready ? 'ready' : ''}`}>
          {player.ready ? 'Ready' : 'Not ready'}
        </span>
      )}
    </div>
  );
}
