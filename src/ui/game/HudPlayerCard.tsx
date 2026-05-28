import type { CharacterDefinition } from '../../shared/types';
import { rgbCss } from '../character';

export function HudPlayerCard({
  name,
  hp,
  maxHp,
  character,
}: {
  name: string;
  hp: number;
  maxHp: number;
  character: CharacterDefinition;
}) {
  const safeMax = Math.max(maxHp, 1);
  const hpRatio = Math.max(0, Math.min(1, hp / safeMax));
  const low = hpRatio <= 0.3;
  const critical = hpRatio <= 0.15;

  return (
    <div
      className={`hud-card hud-card-player ${low ? 'is-low' : ''} ${critical ? 'is-critical' : ''}`}
      style={{ '--accent': rgbCss(character.color) } as React.CSSProperties}
    >
      <div className="hud-card-portrait" aria-hidden>
        <img
          src={`/assets/${character.sprite}`}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <span>{character.initials}</span>
      </div>
      <div className="hud-card-body">
        <div className="hud-card-name">{name}</div>
        <div className="hud-card-hp-row">
          <span className="hud-card-hp-num">{Math.max(0, Math.round(hp))}</span>
          <span className="hud-card-hp-max">/ {safeMax}</span>
        </div>
        <div className="hud-card-hp-track">
          <div
            className="hud-card-hp-fill"
            style={{ width: `${hpRatio * 100}%` }}
          />
          <div className="hud-card-hp-tick" style={{ left: '50%' }} />
          <div className="hud-card-hp-tick" style={{ left: '25%' }} />
          <div className="hud-card-hp-tick" style={{ left: '75%' }} />
        </div>
      </div>
    </div>
  );
}
