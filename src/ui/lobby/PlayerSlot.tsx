import { type CSSProperties } from 'react';
import { getWeapon } from '../../content/weapons';
import { getCharacter, rgbCss } from '../character';
import { EditableName } from '../components/EditableName';
import type { LobbyPlayerView } from './types';

export function PlayerSlot({
  player,
  isMe,
  onNameSubmit,
  onReadyToggle,
}: {
  player: LobbyPlayerView;
  isMe: boolean;
  onNameSubmit: (name: string) => void;
  onReadyToggle: () => void;
}) {
  const character = getCharacter(player.character_id);
  const weapon = getWeapon(player.primary_weapon_id);
  const accent = rgbCss(character.color);

  return (
    <div
      className={`slot ${isMe ? 'slot-me' : ''} ${player.ready ? 'slot-ready' : ''}`}
      style={{ '--accent': accent } as CSSProperties & Record<'--accent', string>}
    >
      <div className="slot-avatar" aria-hidden>
        <img
          src={`/assets/${character.sprite}`}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <span>{character.initials}</span>
      </div>

      <div className="slot-text">
        <strong className="slot-name">
          {isMe ? (
            <EditableName value={player.name} onSubmit={onNameSubmit} />
          ) : (
            player.name
          )}
          {player.is_host ? <span className="host-tag">Host</span> : null}
          {player.is_bot ? <span className="host-tag">Bot</span> : null}
        </strong>
        <span className="slot-ability">{character.abilityName}</span>
        <span className="slot-ability-desc">{character.abilityDescription}</span>
        <span className="slot-weapon">{weapon.name}</span>
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
