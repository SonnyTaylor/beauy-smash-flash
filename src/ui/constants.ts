import type { Gamemode, WinCondition } from '../shared/types';

export const TEAM_ALPHA = 1;
export const TEAM_BRAVO = 2;

export const TEAM_OPTIONS: Array<{ id: number; label: string; color: string }> = [
  { id: TEAM_ALPHA, label: 'Alpha', color: '#ff5a5a' },
  { id: TEAM_BRAVO, label: 'Bravo', color: '#5a9eff' },
];

export function teamLabel(team: number | undefined): string {
  if (team === TEAM_ALPHA) return 'Alpha';
  if (team === TEAM_BRAVO) return 'Bravo';
  return 'Unassigned';
}

export const GAMEMODE_OPTIONS: Array<{ id: Gamemode; label: string; available: boolean }> = [
  { id: 'deathmatch', label: 'Deathmatch', available: true },
  { id: 'team_deathmatch', label: 'Team Deathmatch', available: true },
  { id: 'last_mate_standing', label: 'Last Mate Standing', available: true },
  { id: 'zombie_horde', label: 'Zombie Horde', available: true },
];

export const BOT_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];
export const WAVE_GOAL_OPTIONS = [
  { value: 0, label: 'Endless' },
  { value: 5, label: '5 waves' },
  { value: 10, label: '10 waves' },
  { value: 15, label: '15 waves' },
  { value: 20, label: '20 waves' },
];

export const GLOCK_RELOAD_SECS = 1.2;

export const SCORE_LIMIT_OPTIONS = [10, 15, 20, 30, 50];
export const MAX_PLAYERS_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];

export const TIME_LIMIT_OPTIONS: Array<{ secs: number; label: string }> = [
  { secs: 0, label: 'Off' },
  { secs: 180, label: '3 min' },
  { secs: 300, label: '5 min' },
  { secs: 600, label: '10 min' },
  { secs: 900, label: '15 min' },
];

export const WIN_CONDITION_OPTIONS: Array<{ id: WinCondition; label: string; hint: string }> = [
  { id: 'kills', label: 'Kills', hint: 'First to score limit wins' },
  { id: 'time', label: 'Time', hint: 'Highest score when timer ends' },
  { id: 'either', label: 'Either', hint: 'First kill cap or timer' },
];

export function formatMatchTime(totalSecs: number): string {
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
