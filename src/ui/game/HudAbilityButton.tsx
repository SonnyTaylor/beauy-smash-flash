import type { CharacterDefinition } from '../../shared/types';
import { rgbCss } from '../character';

const WINDUP_TOTAL_SECS = 1.25;

export function HudAbilityButton({
  character,
  charge,
  windup,
  hacked,
  directorsCutShots,
}: {
  character: CharacterDefinition;
  charge: number;
  windup: number;
  hacked: boolean;
  directorsCutShots?: number | null;
}) {
  const clampedCharge = Math.max(0, Math.min(100, charge));
  const ready = clampedCharge >= 100;
  const casting = windup > 0;
  const inDirectorsCut = directorsCutShots != null && directorsCutShots > 0;
  const windupRatio = casting
    ? Math.max(0, Math.min(1, 1 - windup / WINDUP_TOTAL_SECS))
    : 0;
  const popcornRatio = inDirectorsCut
    ? Math.max(0, Math.min(1, directorsCutShots / 15))
    : 0;

  const ringStyle = {
    background: inDirectorsCut
      ? `conic-gradient(#32ff32 ${popcornRatio * 100}%, rgba(255, 255, 255, 0.08) ${popcornRatio * 100}% 100%)`
      : casting
        ? `conic-gradient(#ff4d6d ${windupRatio * 100}%, rgba(255, 255, 255, 0.08) ${windupRatio * 100}% 100%)`
        : `conic-gradient(var(--accent) ${clampedCharge}%, rgba(255, 255, 255, 0.08) ${clampedCharge}% 100%)`,
  } as React.CSSProperties;

  return (
    <div
      className={`hud-ability ${ready ? 'is-ready' : ''} ${casting ? 'is-casting' : ''} ${inDirectorsCut ? 'is-directors-cut' : ''} ${hacked ? 'is-hacked' : ''}`}
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
        {!ready && !casting && !inDirectorsCut && (
          <div className="hud-ability-percent">{Math.round(clampedCharge)}%</div>
        )}
        {inDirectorsCut && (
          <div className="hud-ability-percent">{directorsCutShots}</div>
        )}
      </div>
      <div className="hud-ability-key" aria-hidden>E</div>
      <div className="hud-ability-name">
        {inDirectorsCut ? 'Rolling…' : casting ? 'Arming…' : character.abilityName}
      </div>
    </div>
  );
}
