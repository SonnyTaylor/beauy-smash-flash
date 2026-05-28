import { type CSSProperties } from 'react';
import { CHARACTERS } from '../../content/characters';
import { rgbCss } from '../character';

export function CharacterGrid({
  selectedCharacterId,
  onSelect,
}: {
  selectedCharacterId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="character-grid">
      {CHARACTERS.map((character) => (
        <button
          key={character.id}
          type="button"
          className={`character-card ${character.id === selectedCharacterId ? 'selected' : ''}`}
          style={
            { '--accent': rgbCss(character.color) } as CSSProperties & Record<'--accent', string>
          }
          onClick={() => onSelect(character.id)}
        >
          <span className="head-placeholder">
            <img
              src={`/assets/${character.sprite}`}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
            <span>{character.initials}</span>
          </span>
          <strong>{character.name}</strong>
          <span className="ability-name">{character.abilityName}</span>
          <span className="selected-tag">Picked</span>
        </button>
      ))}
    </div>
  );
}
