import type { CharacterDefinition } from '../../shared/types';
import { rgbCss } from '../character';

const WINDUP_TOTAL_SECS = 1.2;

export function HudAbilityButton({
  character,
  charge,
  windup,
  hacked,
}: {
  character: CharacterDefinition;
  charge: number;
  windup: number;
  hacked: boolean;
}) {
  const clampedCharge = Math.max(0, Math.min(100, charge));
  const ready = clampedCharge >= 100;
  const casting = windup > 0;
  const windupRatio = casting
    ? Math.max(0, Math.min(1, 1 - windup / WINDUP_TOTAL_SECS))
    : 0;

  const ringStyle = {
    background: casting
      ? `conic-gradient(#ff4d6d ${windupRatio * 100}%, rgba(255, 255, 255, 0.08) ${windupRatio * 100}% 100%)`
      : `conic-gradient(var(--accent) ${clampedCharge}%, rgba(255, 255, 255, 0.08) ${clampedCharge}% 100%)`,
  } as React.CSSProperties;

  return (
    <div
      className={`hud-ability ${ready ? 'is-ready' : ''} ${casting ? 'is-casting' : ''} ${hacked ? 'is-hacked' : ''}`}
      style={{ '--accent': rgbCss(character.color) } as React.CSSProperties}
    >
      <div className="hud-ability-ring" style={ringStyle} aria-hidden />
      <div className="hud-ability-core">
        <img
          src={`/assets/${character.sprite}`}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <span aria-hidden>{character.initials}</span>
        {!ready && !casting && (
          <div className="hud-ability-percent">{Math.round(clampedCharge)}%</div>
        )}
      </div>
      <div className="hud-ability-key" aria-hidden>E</div>
      <div className="hud-ability-name">
        {casting ? 'Arming…' : character.abilityName}
      </div>
    </div>
  );
}
