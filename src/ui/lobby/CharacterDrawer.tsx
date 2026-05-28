import { type CSSProperties, useEffect } from 'react';
import { CHARACTERS } from '../../content/characters';
import { rgbCss } from '../character';

export function CharacterDrawer({
  open,
  selectedCharacterId,
  onSelect,
  onClose,
}: {
  open: boolean;
  selectedCharacterId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        className="drawer-panel"
        role="dialog"
        aria-label="Pick a character"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div>
            <p className="screen-kicker">Pick your mate</p>
            <h2>Character</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="character-grid">
          {CHARACTERS.map((character) => (
            <button
              key={character.id}
              className={`character-card ${character.id === selectedCharacterId ? 'selected' : ''}`}
              style={{ '--accent': rgbCss(character.color) } as CSSProperties & Record<'--accent', string>}
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
              <span className="ability-desc">{character.abilityDescription}</span>
              <span className="selected-tag">Selected</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
