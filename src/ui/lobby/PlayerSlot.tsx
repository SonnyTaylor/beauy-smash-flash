import { type CSSProperties } from 'react';
import { getWeapon } from '../../content/weapons';
import { resolvePlayerDisplayName } from '../../shared/playerName';
import { TEAM_OPTIONS } from '../constants';
import { getCharacter, rgbCss } from '../character';
import { EditableName } from '../components/EditableName';
import type { LobbyPlayerView } from './types';

export function PlayerSlot({
  player,
  isMe,
  isHost,
  showTeamPicker,
  onNameSubmit,
  onReadyToggle,
  onTeamChange,
  onKick,
}: {
  player: LobbyPlayerView;
  isMe: boolean;
  isHost: boolean;
  showTeamPicker: boolean;
  onNameSubmit: (name: string) => void;
  onReadyToggle: () => void;
  onTeamChange: (team: number) => void;
  onKick?: () => void;
}) {
  const character = getCharacter(player.character_id);
  const weapon = getWeapon(player.primary_weapon_id);
  const accent = rgbCss(character.color);
  const displayName = resolvePlayerDisplayName(player.name, player.character_id);
  const canEditTeam = showTeamPicker && (isHost || isMe);
  const teamChoice = player.team ?? 0;

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
            displayName
          )}
          {player.is_host ? <span className="host-tag">Host</span> : null}
          {player.is_bot ? <span className="host-tag">Bot</span> : null}
        </strong>
        <span className="slot-ability">{character.abilityName}</span>
        <span className="slot-ability-desc">{character.abilityDescription}</span>
        <span className="slot-weapon">{weapon.name}</span>
        {showTeamPicker && (
          <div className="slot-team-row" role="group" aria-label={`Team for ${player.name}`}>
            {TEAM_OPTIONS.map((option) => {
              const selected = teamChoice === option.id;
              const disabled = !canEditTeam;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`slot-team-btn ${selected ? 'is-selected' : ''}`}
                  style={{ '--team-color': option.color } as CSSProperties}
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => onTeamChange(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
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
        <div className="slot-actions">
          <span className={`ready-pill ${player.ready ? 'ready' : ''}`}>
            {player.ready ? 'Ready' : 'Not ready'}
          </span>
          {isHost && onKick && !player.is_host && !player.is_bot ? (
            <button type="button" className="ghost-button slot-kick-btn" onClick={onKick}>
              Kick
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
