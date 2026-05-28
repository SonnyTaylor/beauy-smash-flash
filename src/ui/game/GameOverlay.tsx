import { useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterDefinition, GameSettings, PlayerSnapshot, StateSnapshot } from '../../shared/types';
import { formatMatchTime } from '../constants';
import { getCharacter } from '../character';
import { MatchScoreboard } from './MatchScoreboard';
import { HudPlayerCard } from './HudPlayerCard';
import { HudAbilityButton } from './HudAbilityButton';
import { HudAmmoReadout } from './HudAmmoReadout';
import { HudWeaponBar } from './HudWeaponBar';
import { HudMatchStrip } from './HudMatchStrip';
import { HudCrosshair } from './HudCrosshair';
import { useArenaLayout } from '../hooks/useArenaLayout';
import { worldToScreen } from '../../game/Viewport';
import { GAME_SAFE_AREA_INSETS } from '../../game/safeArea';

interface HitMarker {
  id: number;
  text: string;
  kind: 'taken' | 'dealt';
  worldX: number;
  worldY: number;
}

const CONTROLS_HINT_VISIBLE_MS = 6500;

function matchGoalLabel(state: StateSnapshot | null): string {
  if (!state) return '';
  if (state.gamemode === 'zombie_horde') {
    const waveGoal = state.wave_goal ?? 0;
    if (waveGoal > 0) {
      return `Survive ${waveGoal} waves — co-op horde`;
    }
    if ((state.time_limit_secs ?? 0) > 0) {
      return `Horde survival · ${formatMatchTime(state.time_limit_secs)}`;
    }
    return 'Survive the zombie horde';
  }
  if (state.gamemode === 'last_mate_standing') {
    if (state.time_limit_secs > 0) {
      return `Last standing wins · ${formatMatchTime(state.time_limit_secs)} tiebreaker`;
    }
    return 'Last mate standing — no respawns';
  }
  if (state.win_condition === 'time') {
    return state.time_limit_secs > 0
      ? `Highest score after ${formatMatchTime(state.time_limit_secs)}`
      : 'Highest score when time runs out';
  }
  if (state.win_condition === 'either') {
    const parts: string[] = [];
    if (state.score_limit > 0) parts.push(`first to ${state.score_limit} kills`);
    if (state.time_limit_secs > 0) parts.push(formatMatchTime(state.time_limit_secs));
    return parts.length > 0 ? parts.join(' or ') : 'Most kills wins';
  }
  return `First to ${state.score_limit} kills`;
}

function endReasonLabel(state: StateSnapshot | null): string {
  if (!state?.match_end_reason) return matchGoalLabel(state);
  if (state.match_end_reason === 'time') {
    return 'Time limit reached';
  }
  return `Reached ${state.score_limit} kills`;
}

function timeRemaining(state: StateSnapshot | null): number | null {
  if (!state || state.time_limit_secs <= 0) return null;
  return Math.max(0, Math.ceil(state.time_limit_secs - state.match_elapsed_secs));
}

function Podium({
  players,
  winnerId,
}: {
  players: PlayerSnapshot[];
  winnerId: number | null;
}) {
  const sorted = [...players].sort(
    (a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths,
  );
  const top = sorted.slice(0, 3);
  const order = top.length >= 3 ? [top[1], top[0], top[2]] : top;

  return (
    <div className={`game-podium game-podium-${order.length}`}>
      {order.map((player) => {
        const place = top.indexOf(player) + 1;
        const character = getCharacter(player.character_id);
        const isWinner = player.id === winnerId;
        return (
          <div
            key={player.id}
            className={`podium-slot podium-place-${place} ${isWinner ? 'podium-winner' : ''}`}
            style={
              {
                '--accent': `rgb(${character.color.join(' ')})`,
                '--podium-delay': `${place * 0.12}s`,
              } as React.CSSProperties
            }
          >
            <span className="podium-rank">{place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'}</span>
            <div className="podium-avatar">
              <img
                src={`/assets/${character.sprite}`}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
              <span>{character.initials}</span>
            </div>
            <strong>{player.name}</strong>
            <span className="podium-stats">
              {player.score} · {player.kills}K / {player.deaths}D
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function GameOverlay({
  state,
  myId,
  sessionKind,
  selectedCharacter,
  paused,
  isBusy,
  onPauseChange,
  onExitGame,
  onReturnToLobby,
  onRematch,
  onChangeLoadout,
  gameSettings,
  onSaveGameSettings,
  onTestSound,
  showControlsHint = true,
}: {
  state: StateSnapshot | null;
  myId: number;
  sessionKind: 'host' | 'join';
  selectedCharacter: CharacterDefinition;
  paused: boolean;
  isBusy?: boolean;
  showControlsHint?: boolean;
  onPauseChange: (paused: boolean) => void;
  onExitGame: () => void;
  onReturnToLobby: () => void;
  onRematch: () => void;
  onChangeLoadout: () => void;
  gameSettings: GameSettings;
  onSaveGameSettings: (settings: GameSettings) => void;
  onTestSound?: (volume: number) => void;
}) {
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [pauseView, setPauseView] = useState<'menu' | 'settings'>('menu');
  const me = state?.players.find((player) => player.id === myId) ?? null;
  const character = getCharacter(me?.character_id ?? selectedCharacter.id);
  const pendingCharacter = me?.pending_character_id
    ? getCharacter(me.pending_character_id)
    : null;
  const matchEnded = state?.match_ended ?? false;
  const winner =
    state?.winner_id != null
      ? (state.players.find((player) => player.id === state.winner_id) ?? null)
      : null;
  const sortedScores = [...(state?.players ?? [])].sort(
    (a, b) => b.score - a.score || b.kills - a.kills,
  );
  const reloadRemaining = me?.reload_remaining ?? 0;
  const isReloading = reloadRemaining > 0 || (me?.reloading ?? false);
  const abilityCharge = me?.ability_charge ?? 0;
  const abilityWindup = me?.ability_windup ?? 0;
  const isHacked = (me?.hacked_remaining ?? 0) > 0;
  const isSlowed = (me?.slowed_remaining ?? 0) > 0;
  const isMarked = (me?.marked_remaining ?? 0) > 0;
  const isPoisoned = (me?.poison_remaining ?? 0) > 0;
  const isSpawnProtected = (me?.spawn_protected ?? false) && (me?.alive ?? false);
  const inBoatMode = (me?.boat_mode_remaining ?? 0) > 0;
  const isLastMateStanding = state?.gamemode === 'last_mate_standing';
  const isZombieHorde = state?.gamemode === 'zombie_horde';
  const hordeWave = state?.wave ?? 0;
  const hordeRemaining = state?.zombies_remaining ?? 0;
  const hordeIntermission = state?.wave_intermission_secs ?? 0;
  const hordeActive = state?.wave_state === 'active';
  const inDirectorsCut = (me?.directors_cut_remaining ?? 0) > 0;
  const directorsCutActive = (state?.players ?? []).some(
    (player) => (player.directors_cut_remaining ?? 0) > 0,
  );
  const remaining = timeRemaining(state);
  const showTimer = (state?.time_limit_secs ?? 0) > 0 && state?.win_condition !== 'kills';
  const isDead = me && !me.alive && me.respawn_in > 0 && !matchEnded;
  const arenaLayout = useArenaLayout(state?.world);

  const [showScoreboard, setShowScoreboard] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const [hitMarkers, setHitMarkers] = useState<HitMarker[]>([]);
  const [truthFlash, setTruthFlash] = useState(false);
  const [hintFading, setHintFading] = useState(false);
  const hpRef = useRef<Map<number, number>>(new Map());
  const markerIdRef = useRef(0);
  const knownTruthExplosionsRef = useRef<Set<number>>(new Set());

  const lastKiller = useMemo(() => {
    if (!state || !me) return null;
    const entry = [...state.kill_feed]
      .reverse()
      .find((line) => line.victim_id === myId);
    if (!entry) return null;
    if (entry.killer_id === myId) return 'You';
    return entry.killer_name;
  }, [state?.kill_feed, me, myId]);

  useEffect(() => {
    if (!state || matchEnded) return;

    const nextMarkers: HitMarker[] = [];
    let tookDamage = false;

    for (const player of state.players) {
      const prevHp = hpRef.current.get(player.id);
      hpRef.current.set(player.id, player.hp);
      if (prevHp === undefined || player.hp >= prevHp) continue;

      const damage = prevHp - player.hp;
      if (player.id === myId) {
        tookDamage = true;
        nextMarkers.push({
          id: markerIdRef.current++,
          text: `-${damage}`,
          kind: 'taken',
          worldX: player.x,
          worldY: player.y,
        });
      } else if (player.id !== myId && damage > 0) {
        nextMarkers.push({
          id: markerIdRef.current++,
          text: `-${damage}`,
          kind: 'dealt',
          worldX: player.x,
          worldY: player.y,
        });
      }
    }

    if (tookDamage) {
      setHitFlash(true);
      window.setTimeout(() => setHitFlash(false), 180);
    }

    if (nextMarkers.length > 0) {
      setHitMarkers((current) => [...current, ...nextMarkers].slice(-6));
      const ids = nextMarkers.map((marker) => marker.id);
      window.setTimeout(() => {
        setHitMarkers((current) => current.filter((marker) => !ids.includes(marker.id)));
      }, 900);
    }
  }, [state, matchEnded, myId]);

  useEffect(() => {
    if (!state || matchEnded) return;

    for (const effect of state.effects ?? []) {
      if (effect.kind !== 'truth_explosion') {
        continue;
      }
      if (knownTruthExplosionsRef.current.has(effect.id)) {
        continue;
      }
      knownTruthExplosionsRef.current.add(effect.id);
      if (effect.owner_id === myId) {
        continue;
      }
      setTruthFlash(true);
      window.setTimeout(() => setTruthFlash(false), 1400);
    }

    const liveIds = new Set((state.effects ?? []).map((effect) => effect.id));
    for (const id of knownTruthExplosionsRef.current) {
      if (!liveIds.has(id)) {
        knownTruthExplosionsRef.current.delete(id);
      }
    }
  }, [state, matchEnded, myId]);

  useEffect(() => {
    if (matchEnded) {
      hpRef.current.clear();
      setHitMarkers([]);
      setHitFlash(false);
      setTruthFlash(false);
      knownTruthExplosionsRef.current.clear();
    }
  }, [matchEnded]);

  // Auto-fade the controls hint once the match has been going a few seconds.
  // Re-show on pause; hide again when unpaused. This keeps the bottom strip
  // clean during real combat without hiding the cheatsheet from a player who
  // alt-tabbed away and forgot the keys.
  useEffect(() => {
    if (!showControlsHint || matchEnded) return;
    if (paused) {
      setHintFading(false);
      return;
    }
    setHintFading(false);
    const timer = window.setTimeout(() => setHintFading(true), CONTROLS_HINT_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [showControlsHint, paused, matchEnded]);

  useEffect(() => {
    if (!paused) {
      setExitConfirmOpen(false);
      setPauseView('menu');
    }
  }, [paused]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Tab' && state && !matchEnded && !paused) {
        event.preventDefault();
        setShowScoreboard(true);
      }
      if (event.key === 'Escape' && !matchEnded) {
        onPauseChange(!paused);
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        setShowScoreboard(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [matchEnded, onPauseChange, paused, state]);

  return (
    <>
      <div
        className={`game-overlay ${paused || matchEnded ? 'is-paused' : ''} ${isHacked ? 'is-hacked' : ''} ${isSlowed ? 'is-slowed' : ''} ${directorsCutActive ? 'is-directors-cut' : ''}`}
        style={arenaLayout as React.CSSProperties}
      >
        {isSpawnProtected && !matchEnded && (
          <div className="hud-spawn-banner" role="status">
            Spawn protected
          </div>
        )}

        {inBoatMode && !matchEnded && (
          <div className="hud-boat-banner" role="status">
            Cheeky Dinghy — ram enemies · {me?.boat_mode_remaining?.toFixed(1)}s
          </div>
        )}

        {isHacked && !matchEnded && (
          <div className="hud-hack-banner" role="status">
            Reverse shell — flipped inputs · +30% damage taken · {me?.hacked_remaining.toFixed(1)}s
          </div>
        )}

        {isSlowed && !matchEnded && !isHacked && (
          <div className="hud-slow-banner" role="status">
            Gooed up — {me?.slowed_remaining?.toFixed(1)}s
          </div>
        )}

        {isMarked && !matchEnded && !isHacked && (
          <div className="hud-mark-banner" role="status">
            Marked — +40% damage taken · {me?.marked_remaining?.toFixed(1)}s
          </div>
        )}

        {isPoisoned && !matchEnded && !isHacked && (
          <div className="hud-poison-banner" role="status">
            Poisoned — {me?.poison_remaining?.toFixed(1)}s
          </div>
        )}

        {inDirectorsCut && !matchEnded && (
          <div className="hud-directors-banner" role="status">
            Director&apos;s Cut — {me?.directors_cut_shots ?? 0} popcorn left · kills refund 3
          </div>
        )}

        {isZombieHorde && !matchEnded && (
          <div className="hud-directors-banner" role="status">
            {hordeWave === 0
              ? `Horde incoming in ${Math.ceil(hordeIntermission)}s`
              : hordeActive
                ? `Wave ${hordeWave} — ${hordeRemaining} zombies left`
                : `Wave ${hordeWave} cleared — next wave in ${Math.ceil(hordeIntermission)}s`}
          </div>
        )}

        {!matchEnded && state && (
          <div className="hud-zone hud-zone-side-left">
            <HudMatchStrip
              state={state}
              me={me}
              timeRemaining={showTimer ? remaining : null}
              layout="vertical"
            />
          </div>
        )}

        {!matchEnded && (
          <div className="hud-zone hud-zone-side-right">
            <button
              type="button"
              className="hud-menu-button"
              onClick={() => onPauseChange(true)}
              aria-label="Open menu"
            >
              <span className="hud-menu-icon" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span className="hud-menu-text">Menu</span>
            </button>
            <div className="hud-kill-feed">
              {(state?.kill_feed ?? []).length === 0 ? (
                <div className="kill-feed-empty">No frags yet</div>
              ) : (
                (state?.kill_feed ?? []).slice().reverse().slice(0, 5).map((entry, index) => (
                  <div
                    key={`${entry.killer_id}-${entry.victim_id}-${index}`}
                    className="kill-feed-line"
                  >
                    <strong>{entry.killer_name}</strong>
                    <span> fragged </span>
                    <strong>{entry.victim_name}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!matchEnded && me && (
          <>
            <div className="hud-zone hud-zone-bottom-left">
              <div className="hud-bottom-left-cluster">
                {me.alive && pendingCharacter && (
                  <p className="hud-pending-class">
                    Next respawn: <strong>{pendingCharacter.name}</strong>
                  </p>
                )}
                <div className="hud-bottom-left-row">
                  <HudPlayerCard
                    name={me.name || 'Player'}
                    hp={me.hp}
                    maxHp={me.max_hp}
                    character={character}
                  />
                  <HudWeaponBar
                    activeWeapon={me.active_weapon ?? 'glock'}
                    activeSlot={me.active_slot ?? 0}
                    primary={me.primary_weapon}
                    secondary={me.secondary_weapon}
                  />
                </div>
              </div>
            </div>

            <div className="hud-zone hud-zone-bottom-center">
              <HudAbilityButton
                character={character}
                charge={abilityCharge}
                windup={abilityWindup}
                hacked={isHacked}
                directorsCutShots={inDirectorsCut ? (me?.directors_cut_shots ?? 0) : null}
                boatModeRemaining={me?.boat_mode_remaining ?? 0}
                reelShieldRemaining={me?.reel_shield_remaining ?? 0}
                stillnessStacks={me?.stillness_stacks ?? 0}
              />
            </div>

            <div className="hud-zone hud-zone-bottom-right">
              <HudAmmoReadout
                ammo={me.ammo}
                maxAmmo={me.max_ammo}
                reloading={isReloading}
                reloadRemaining={reloadRemaining}
                reloadDuration={me.reload_duration ?? 1.2}
              />
            </div>
          </>
        )}

        {!matchEnded && !paused && me && me.alive && (
          <HudCrosshair
            character={character}
            reloading={isReloading}
            empty={!isReloading && me.ammo <= 0}
            hacked={isHacked}
            playerWorld={me ? { x: me.x, y: me.y } : null}
            world={state?.world ?? null}
          />
        )}

        {showControlsHint && !matchEnded && (
          <div
            className={`hud-controls-hint ${hintFading && !paused ? 'is-faded' : ''}`}
            aria-hidden={hintFading && !paused}
          >
            <kbd>WASD</kbd> move
            <span className="dot">·</span>
            <kbd>Mouse</kbd> aim
            <span className="dot">·</span>
            <kbd>LMB</kbd> fire
            <span className="dot">·</span>
            <kbd>R</kbd> reload
            <span className="dot">·</span>
            <kbd>Q</kbd> swap
            <span className="dot">·</span>
            <kbd>G</kbd> drop
            <span className="dot">·</span>
            <kbd>F</kbd> pick up
            <span className="dot">·</span>
            <kbd>E</kbd> {character.abilityName.toLowerCase()}
            <span className="dot">·</span>
            <kbd>Tab</kbd> scores
            <span className="dot">·</span>
            <kbd>Esc</kbd> menu
          </div>
        )}
      </div>

      {showScoreboard && state && !matchEnded && (
        <MatchScoreboard state={state} myId={myId} />
      )}

      {hitFlash && <div className="hit-vignette" aria-hidden />}

      {truthFlash && !matchEnded && (
        <div className="truth-flash" aria-hidden />
      )}

      <div className="hit-marker-layer" aria-hidden>
        {state?.world &&
          hitMarkers.map((marker) => {
            const screen = worldToScreen(
              marker.worldX,
              marker.worldY,
              state.world,
              window.innerWidth,
              window.innerHeight,
              GAME_SAFE_AREA_INSETS,
            );
            return (
              <span
                key={marker.id}
                className={`hit-marker hit-marker-${marker.kind}`}
                style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
              >
                {marker.text}
              </span>
            );
          })}
      </div>

      {isDead && (
        <div className="death-screen" role="status" aria-live="polite">
          <p className="screen-kicker">Eliminated</p>
          <h2>You&apos;re down</h2>
          {isLastMateStanding ? (
            <p className="death-killer">Spectating — last mate standing</p>
          ) : lastKiller && lastKiller !== 'You' ? (
            <p className="death-killer">
              Taken out by <strong>{lastKiller}</strong>
            </p>
          ) : (
            <p className="death-killer">Respawning soon</p>
          )}
          {!isLastMateStanding && (
            <div className="death-timer">
              <span>Respawn</span>
              <strong>{me.respawn_in.toFixed(1)}s</strong>
            </div>
          )}
        </div>
      )}

      {paused && !matchEnded && (
        <div className="game-pause-backdrop" role="dialog" aria-label="Pause menu">
          <div className="game-pause-panel">
            {!exitConfirmOpen && pauseView === 'menu' ? (
              <>
                <p className="screen-kicker">Paused</p>
                <h2>Game Menu</h2>
                {state && (
                  <div className="game-pause-stats">
                    <span>{state.map.name}</span>
                    {isLastMateStanding && <span>Last mate standing</span>}
                    {remaining !== null && <span>{formatMatchTime(remaining)} left</span>}
                    {me && (
                      <span>
                        {me.score} pts · {me.kills}K / {me.deaths}D
                      </span>
                    )}
                  </div>
                )}
                <div className="game-pause-actions">
                  <button type="button" className="primary-action" onClick={() => onPauseChange(false)}>
                    Resume
                  </button>
                  <button type="button" className="secondary-button" onClick={onChangeLoadout}>
                    Change Loadout
                  </button>
                  {sessionKind === 'host' && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isBusy}
                      onClick={() => {
                        onPauseChange(false);
                        onReturnToLobby();
                      }}
                    >
                      {isBusy ? 'Returning…' : 'Back to Lobby'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setPauseView('settings')}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => setExitConfirmOpen(true)}
                  >
                    Exit Game
                  </button>
                </div>
                <p className="game-pause-hint">Esc to resume</p>
              </>
            ) : !exitConfirmOpen && pauseView === 'settings' ? (
              <>
                <p className="screen-kicker">Paused</p>
                <h2>Settings</h2>
                <div className="game-pause-settings">
                  <div className="setting-row settings-volume-row">
                    <span className="setting-label">Master Volume</span>
                    <div className="setting-control settings-volume-control">
                      <input
                        type="range"
                        className="settings-volume-slider"
                        min={0}
                        max={100}
                        value={Math.round(gameSettings.masterVolume * 100)}
                        onChange={(event) =>
                          onSaveGameSettings({
                            ...gameSettings,
                            masterVolume: Number(event.target.value) / 100,
                          })
                        }
                      />
                      <span className="settings-volume-value">
                        {Math.round(gameSettings.masterVolume * 100)}%
                      </span>
                    </div>
                  </div>
                  {onTestSound && (
                    <button
                      type="button"
                      className="secondary-button settings-test-sound"
                      onClick={() => onTestSound(gameSettings.masterVolume)}
                    >
                      Test sound
                    </button>
                  )}
                  <button
                    type="button"
                    className={`toggle-pill ${gameSettings.musicEnabled ? 'on' : 'off'}`}
                    onClick={() =>
                      onSaveGameSettings({
                        ...gameSettings,
                        musicEnabled: !gameSettings.musicEnabled,
                      })
                    }
                  >
                    Music: {gameSettings.musicEnabled ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    className={`toggle-pill ${gameSettings.showControlsHint ? 'on' : 'off'}`}
                    onClick={() =>
                      onSaveGameSettings({
                        ...gameSettings,
                        showControlsHint: !gameSettings.showControlsHint,
                      })
                    }
                  >
                    Control hints: {gameSettings.showControlsHint ? 'On' : 'Off'}
                  </button>
                </div>
                <div className="game-pause-actions">
                  <button type="button" className="secondary-button" onClick={() => setPauseView('menu')}>
                    Back
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="screen-kicker">Confirm</p>
                <h2>Exit game?</h2>
                <p className="game-pause-warning">
                  {sessionKind === 'host'
                    ? "You're hosting this match. Exiting will shut down the session for everyone on your LAN."
                    : "You'll disconnect from the match and close Beauy Smash Flash."}
                </p>
                <div className="game-pause-actions">
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void onExitGame()}
                  >
                    Yes, exit
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setExitConfirmOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {matchEnded && (
        <div className="game-over-backdrop" role="dialog" aria-label="Match over">
          <div className="game-over-panel game-over-panel-wide">
            <p className="screen-kicker">Match Over</p>
            <h2>{winner ? `${winner.name} wins` : 'Draw'}</h2>
            <p className="game-over-subtitle">{endReasonLabel(state)}</p>

            <Podium players={state?.players ?? []} winnerId={state?.winner_id ?? null} />

            <div className="game-over-scores">
              {sortedScores.map((player) => (
                <div
                  key={player.id}
                  className={`game-over-row ${player.id === winner?.id ? 'winner' : ''}`}
                >
                  <span>{player.name}</span>
                  <span>
                    {player.score} · {player.kills}K / {player.deaths}D
                  </span>
                </div>
              ))}
            </div>

            <div className="game-pause-actions">
              {sessionKind === 'host' ? (
                <>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={onRematch}
                    disabled={isBusy}
                  >
                    {isBusy ? 'Starting…' : 'Rematch'}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={onReturnToLobby}
                    disabled={isBusy}
                  >
                    Back to Lobby
                  </button>
                </>
              ) : (
                <p className="game-over-wait">
                  {isBusy ? 'Rematch starting…' : 'Waiting for host to rematch or return to lobby…'}
                </p>
              )}
              <button type="button" className="secondary-button" onClick={() => void onExitGame()}>
                Exit Game
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
