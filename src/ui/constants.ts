import type { Gamemode, WinCondition } from '../shared/types';

export const GAMEMODE_OPTIONS: Array<{ id: Gamemode; label: string; available: boolean }> = [
  { id: 'deathmatch', label: 'Deathmatch', available: true },
  { id: 'team_deathmatch', label: 'Team Deathmatch', available: false },
  { id: 'last_mate_standing', label: 'Last Mate Standing', available: true },
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
