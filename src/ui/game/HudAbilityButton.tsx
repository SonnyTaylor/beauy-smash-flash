import type { CharacterDefinition } from '../../shared/types';
import { JACOB_DIRECTORS_CUT_SHOTS } from '../../content/jacob-directors-cut';
import { TAJ_SHIELD_DURATION_SECS } from '../../content/reels';
import { rgbCss } from '../character';

const BAILEY_WINDUP_SECS = 1.25;
const ISAAC_WINDUP_SECS = 1.4;

export function HudAbilityButton({
  character,
  charge,
  windup,
  hacked,
  directorsCutShots,
  boatModeRemaining,
  reelShieldRemaining,
  stillnessStacks,
}: {
  character: CharacterDefinition;
  charge: number;
  windup: number;
  hacked: boolean;
  directorsCutShots?: number | null;
  boatModeRemaining?: number;
  reelShieldRemaining?: number;
  stillnessStacks?: number;
}) {
  const clampedCharge = Math.max(0, Math.min(100, charge));
  const ready = clampedCharge >= 100;
  const casting = windup > 0;
  const inDirectorsCut = directorsCutShots != null && directorsCutShots > 0;
  const inBoat = (boatModeRemaining ?? 0) > 0;
  const hasShield = (reelShieldRemaining ?? 0) > 0;
  const windupTotal =
    character.id === 'isaak' ? ISAAC_WINDUP_SECS : BAILEY_WINDUP_SECS;
  const windupRatio = casting
    ? Math.max(0, Math.min(1, 1 - windup / windupTotal))
    : 0;
  const popcornRatio = inDirectorsCut
    ? Math.max(0, Math.min(1, (directorsCutShots ?? 0) / JACOB_DIRECTORS_CUT_SHOTS))
    : 0;
  const shieldRatio = hasShield
    ? Math.max(0, Math.min(1, (reelShieldRemaining ?? 0) / TAJ_SHIELD_DURATION_SECS))
    : 0;

  const ringStyle = {
    background: inDirectorsCut
      ? `conic-gradient(#32ff32 ${popcornRatio * 100}%, rgba(255, 255, 255, 0.08) ${popcornRatio * 100}% 100%)`
      : hasShield
        ? `conic-gradient(#ff5050 ${shieldRatio * 100}%, rgba(255, 255, 255, 0.08) ${shieldRatio * 100}% 100%)`
        : casting
          ? `conic-gradient(#ffcc00 ${windupRatio * 100}%, rgba(255, 255, 255, 0.08) ${windupRatio * 100}% 100%)`
          : `conic-gradient(var(--accent) ${clampedCharge}%, rgba(255, 255, 255, 0.08) ${clampedCharge}% 100%)`,
  } as React.CSSProperties;

  let statusLabel = character.abilityName;
  if (inDirectorsCut) statusLabel = 'Rolling…';
  else if (inBoat) statusLabel = 'Boating…';
  else if (hasShield) statusLabel = 'E to post';
  else if (casting) statusLabel = character.id === 'isaak' ? 'Channeling…' : 'Arming…';

  const isaakStackLabel =
    (stillnessStacks ?? 0) >= 3
      ? '85 dmg + slow'
      : (stillnessStacks ?? 0) === 2
        ? '75 dmg + slow'
        : (stillnessStacks ?? 0) === 1
          ? '65 dmg'
          : 'Stillness';

  return (
    <div
      className={`hud-ability-wrap ${ready ? 'is-ready' : ''} ${casting ? 'is-casting' : ''} ${inDirectorsCut ? 'is-directors-cut' : ''} ${inBoat ? 'is-boating' : ''} ${hasShield ? 'is-shielded' : ''} ${hacked ? 'is-hacked' : ''}`}
      style={{ '--accent': rgbCss(character.color) } as React.CSSProperties}
    >
      {character.id === 'isaak' && !casting && !inBoat && (
        <div
          className={`hud-ability-stacks ${(stillnessStacks ?? 0) >= 3 ? 'is-full' : ''}`}
          aria-label={`${stillnessStacks ?? 0} of 3 stillness stacks — ${isaakStackLabel}`}
        >
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={index < (stillnessStacks ?? 0) ? 'hud-ability-stack is-filled' : 'hud-ability-stack'}
              aria-hidden
            />
          ))}
          <span className="hud-ability-stack-label">{isaakStackLabel}</span>
        </div>
      )}
      <div className="hud-ability">
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
          {!ready && !casting && !inDirectorsCut && !inBoat && !hasShield && (
            <div className="hud-ability-percent">{Math.round(clampedCharge)}%</div>
          )}
          {inDirectorsCut && (
            <div className="hud-ability-percent">{directorsCutShots}</div>
          )}
          {hasShield && (
            <div className="hud-ability-percent">{Math.ceil(reelShieldRemaining ?? 0)}s</div>
          )}
        </div>
        <div className="hud-ability-key" aria-hidden>E</div>
        <div className="hud-ability-name">{statusLabel}</div>
      </div>
      <p className="hud-ability-desc">{character.abilityDescription}</p>
    </div>
  );
}
